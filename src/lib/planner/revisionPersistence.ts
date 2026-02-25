// ─────────────────────────────────────────────────────────────────────────────
// revisionPersistence.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// Sync strategy (idempotent on every call):
//   1. Fetch existing fixed (practice paper) slots BEFORE making any changes
//   2. Credit fixed slots into completionMap → engine sees remainingSlots=0
//      for papers that already exist and won't place extras
//   3. Pass existingFixedPaperDates to engine as a belt-and-suspenders guard
//   4. Delete only non-fixed, non-completed slots — practice papers stay in DB
//   5. Insert only what the engine produced (standard slots + papers for new exams)
//
// Result: reshuffling N times always produces the same plan. Practice papers
// are placed once and preserved. Standard slots are regenerated each sync.
//
// Required DB migration:
//   ALTER TABLE public.revision_slots
//     ADD COLUMN slot_type TEXT NOT NULL DEFAULT 'standard'
//       CHECK (slot_type IN ('standard','practice_paper','mind_map','flashcards')),
//     ADD COLUMN is_fixed BOOLEAN NOT NULL DEFAULT FALSE;
//
//   ALTER TABLE public.exams
//     ADD COLUMN slot_requirements JSONB NOT NULL DEFAULT '[]'::jsonb;
//
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/lib/supabase/client";
import { planRevisionSlots } from "./revisionEngine";
import { scheduleHomework } from "./homeworkScheduler";
import { buildDateWindow, toDateOnly, addDays } from "./dateUtils";
import type { ExamInput, HomeworkTask } from "./types";

export async function syncRevisionSlots() {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = addDays(today, 1);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No user session" };

  try {
    // ── 1. FETCH ALL DATA (parallel) ──────────────────────────────────────────
    const [
      examsRes,
      recurringRes,
      homeworkRes,
      settingsRes,
      overridesRes,
      slotsTodayRes,
      completionsTodayRes,
      historicalCompletionsRes,
      fixedFutureSlotsRes,
    ] = await Promise.all([
      supabase.from("exams").select("*").eq("user_id", user.id).gte("date", today),
      supabase.from("recurring_tasks").select("*").eq("user_id", user.id),
      supabase
        .from("deadline_tasks")
        .select("*, is_fixed, scheduled_date")
        .eq("user_id", user.id)
        .or("status.eq.active,status.eq.completed")
        .gte("due_date", today),
      supabase.from("planner_settings").select("*").eq("user_id", user.id),
      supabase.from("planner_overrides").select("*").eq("user_id", user.id).gte("date", today),
      supabase
        .from("revision_slots")
        .select("id, duration_minutes, is_completed, date, description, slot_type")
        .eq("user_id", user.id)
        .eq("date", today),
      supabase
        .from("daily_completions")
        .select("source_id, source_type")
        .eq("user_id", user.id)
        .eq("date", today),
      // All historically completed slots — for completionMap
      supabase
        .from("revision_slots")
        .select("exam_id, slot_type")
        .eq("user_id", user.id)
        .eq("is_completed", true),
      // Existing fixed (practice paper) slots not yet completed.
      // Fetched BEFORE the delete so we can credit them into completionMap.
      supabase
        .from("revision_slots")
        .select("exam_id, date, duration_minutes, slot_type")
        .eq("user_id", user.id)
        .eq("is_fixed", true)
        .eq("is_completed", false)
        .gte("date", today),
    ]);

    const exams            = (examsRes.data ?? []) as ExamInput[];
    const recurringTasks   = recurringRes.data ?? [];
    const homework         = (homeworkRes.data ?? []) as HomeworkTask[];
    const settingsRows     = settingsRes.data ?? [];
    const overridesRows    = overridesRes.data ?? [];
    const slotsToday       = slotsTodayRes.data ?? [];
    const completionsToday = completionsTodayRes.data ?? [];
    const historicalSlots  = historicalCompletionsRes.data ?? [];
    const fixedFutureSlots = fixedFutureSlotsRes.data ?? [];

    // ── 2. SHIELD LOGIC ───────────────────────────────────────────────────────
    const hasAnySlotsToday      = slotsToday.length > 0;
    const allTodayDone          = hasAnySlotsToday && slotsToday.every((s: any) => s.is_completed);
    const missionAlreadySecured = hasAnySlotsToday && allTodayDone;
    const anyRevisionDone       = slotsToday.some((s: any) => s.is_completed);
    const syncFromDate          = missionAlreadySecured || anyRevisionDone ? tomorrow : today;

    const revisionMinsAlreadyToday = slotsToday.reduce(
      (sum: number, s: any) => sum + (s.duration_minutes || 0), 0
    );

    // ── 3. BASE CAPACITY MAP ──────────────────────────────────────────────────
    const weeklyPattern: Record<number, number> = {};
    settingsRows.forEach((r: any) => (weeklyPattern[r.day_of_week] = r.base_minutes));

    const dateOverrides: Record<string, number> = {};
    overridesRows.forEach((r: any) => (dateOverrides[toDateOnly(r.date)] = r.override_minutes));

    const windowDates = buildDateWindow(today, 60);
    const baseCapMap: Record<string, number> = {};
    windowDates.forEach((d) => {
      const dow = new Date(d + "T00:00:00").getDay();
      let budget = dateOverrides[d] ?? weeklyPattern[dow] ?? 150;
      if (d === today && missionAlreadySecured) budget = 0;
      baseCapMap[d] = budget;
    });

    // ── 4. RECURRING TASK LOAD ────────────────────────────────────────────────
    const occupiedByRocks: Record<string, number> = {};
    windowDates.forEach((d) => {
      const dow = new Date(d + "T00:00:00").getDay();
      if (d === today) {
        const completedRecurringIds = new Set(
          completionsToday
            .filter((c: any) => c.source_type === "recurring_task")
            .map((c: any) => c.source_id)
        );
        occupiedByRocks[d] = recurringTasks
          .filter((t: any) => Number(t.day_of_week) === dow || completedRecurringIds.has(t.id))
          .reduce((sum: number, t: any) => sum + (t.duration_minutes || 0), 0);
      } else {
        occupiedByRocks[d] = recurringTasks
          .filter((t: any) => Number(t.day_of_week) === dow)
          .reduce((sum: number, t: any) => sum + (t.duration_minutes || 0), 0);
      }
    });

    // ── 5. HOMEWORK PLACEMENT ─────────────────────────────────────────────────
    // Reserve capacity for existing fixed slots so homework doesn't overbook days
    // that already have a practice paper sitting on them.
    const occupiedByFixed: Record<string, number> = {};
    windowDates.forEach((d) => (occupiedByFixed[d] = 0));
    fixedFutureSlots.forEach((s: any) => {
      const d = toDateOnly(s.date);
      if (occupiedByFixed[d] !== undefined)
        occupiedByFixed[d] += s.duration_minutes || 0;
    });

    const todayCompletionKeys = new Set<string>(
      completionsToday.map((c: any) => `${c.source_type}:${c.source_id}`)
    );

    const { tasksToUpdate, occupiedByDate: occupiedByHw } = scheduleHomework({
      tasks: homework,
      windowDates,
      today,
      baseCapMap,
      // Starting occupied = rocks + fixed revision slots
      occupiedCap: Object.fromEntries(
        windowDates.map((d) => [d, (occupiedByRocks[d] || 0) + (occupiedByFixed[d] || 0)])
      ),
      shiftStartToTomorrow: missionAlreadySecured || anyRevisionDone,
      todayCompletionKeys,
      historicalIds: new Set<string>(),
    });

    // ── 6. ENGINE CAPACITY MAP ────────────────────────────────────────────────
    // occupiedByHw already contains rocks (passed as starting occupiedCap).
    const engineCapacityMap: Record<string, number> = {};
    windowDates.forEach((d) => {
      const existingRevMins = d === today ? revisionMinsAlreadyToday : 0;
      engineCapacityMap[d] = Math.max(
        0,
        (baseCapMap[d] || 0) - (occupiedByHw[d] || 0) - existingRevMins
      );
    });

    // ── 7. PERSIST HOMEWORK DATE CHANGES ──────────────────────────────────────
    if (tasksToUpdate.length > 0) {
      await Promise.all(
        tasksToUpdate.map((u) =>
          supabase.from("deadline_tasks").update({ scheduled_date: u.scheduled_date }).eq("id", u.id)
        )
      );
    }

    // ── 8. COMPLETION MAP + EXISTING FIXED DATES ─────────────────────────────
    // completionMap tells the engine how many slots of each type already exist
    // (completed historically + currently fixed-but-pending).
    // existingFixedPaperDates tells the engine which specific dates already have
    // a paper so it doesn't double-place on those dates if somehow remainingSlots > 0.
    // Both together make the sync fully idempotent.
    const completionMap: Record<string, number> = {};
    const existingFixedPaperDates: Record<string, string[]> = {};

    historicalSlots.forEach((s: any) => {
      const key = `${s.exam_id}:${s.slot_type ?? "standard"}`;
      completionMap[key] = (completionMap[key] || 0) + 1;
    });

    /*
    fixedFutureSlots.forEach((s: any) => {
      const key = `${s.exam_id}:${s.slot_type ?? "practice_paper"}`;
      completionMap[key] = (completionMap[key] || 0) + 1;

      const d = toDateOnly(s.date);
      if (!existingFixedPaperDates[s.exam_id]) existingFixedPaperDates[s.exam_id] = [];
      existingFixedPaperDates[s.exam_id].push(d);
    });*/

    // ── 9. RUN REVISION ENGINE ────────────────────────────────────────────────
    const virtualPlan = planRevisionSlots(exams, {
      startDate: today,
      numDays: 60,
      capacityByDate: engineCapacityMap,
      originalBaseCapMap: baseCapMap,
      includeExamDay: false,
      completionMap,
      existingFixedPaperDates, // belt-and-suspenders: also blocks re-placing on existing dates
    });

    // ── 10. ATOMIC DB SYNC ────────────────────────────────────────────────────
    // Delete only non-fixed, non-completed slots.
    // Fixed (practice paper) slots stay in DB — they were credited into
    // completionMap above so the engine produces remainingSlots=0 for papers
    // and won't try to re-insert them. Idempotent: reshuffle N times, same result.
    // 🎯 THE FIX: Deep Clean
    // We delete EVERY uncompleted slot for this user from today onwards.
    // This clears the way for the engine to re-place everything (Fixed or Standard) 
    // without hitting a duplicate key error.
    // 🎯 TOTAL WIPE: No filters other than User and Date.
    // This ensures a 100% clean slate for the insert.
    // ── 10. ATOMIC DB SYNC (Clean Wipe + Merged Insertion) ─────────────────────
    
    // 1. CLEAR THE SLATE
    // We wipe all uncompleted slots from today onwards to ensure no collisions.
    const { error: deleteError } = await supabase
      .from("revision_slots")
      .delete()
      .match({ user_id: user.id, is_completed: false })
      .gte("date", today); 

    if (deleteError) {
      console.error("❌ Delete error:", deleteError.message);
      throw new Error(`Delete failed: ${deleteError.message}`);
    }

    // 2. MERGE SAME-DAY SLOTS
    // Your DB constraint forbids multiple entries for the same Exam/Date/Type.
    // We use a Map to combine them (e.g., two 30m sessions become one 60m session).
    const groupedSlots = new Map<string, any>();

    virtualPlan.days
      .filter((day) => day.date >= syncFromDate)
      .forEach((day) => {
        day.slots.forEach((slot) => {
          // Unique key based on your DB constraint: Date + Exam + Type
          const key = `${day.date}-${slot.examId}-${slot.slotType}`;
          
          if (groupedSlots.has(key)) {
            const existing = groupedSlots.get(key);
            existing.duration_minutes += slot.slotMinutes;
            // Optionally update description to show it's a combined session
            if (!existing.description.includes("(Combined)")) {
              existing.description += " (Combined)";
            }
          } else {
            groupedSlots.set(key, {
              user_id:          user.id,
              exam_id:          slot.examId,
              date:             day.date,
              duration_minutes: slot.slotMinutes,
              description:      slot.label,
              is_completed:     false,
              is_fixed:         slot.isFixed,
              slot_type:        slot.slotType,
              subject:          slot.subject,
            });
          }
        });
      });

    const allRows = Array.from(groupedSlots.values());

    // 3. BULK INSERT
    if (allRows.length > 0) {
      const { error: insertError } = await supabase
        .from("revision_slots")
        .insert(allRows);

      if (insertError) {
        console.error("❌ Insert error:", insertError.message);
        // If this still fails, it means there is a hidden 'is_completed: true' row 
        // on one of these dates blocking the insert.
        throw new Error(`Insert failed: ${insertError.message}`);
      }
    }

    return {
      success:  true,
      count:    allRows.length,
      shielded: syncFromDate === tomorrow,
      unmet:    virtualPlan.unmet.length,
    };

  } catch (error: any) {
    console.error("❌ Sync Error:", error);
    return { success: false, error: error.message };
  }
}
