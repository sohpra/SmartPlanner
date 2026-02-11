import { supabase } from "@/lib/supabase/client";
import { planRevisionSlots, ExamInput, addDays, daysBetween } from "./revisionEngine";

export async function syncRevisionSlots() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = addDays(today, 1);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No user session" };

  try {
    // 1. FETCH ALL CORE DATA
    const [examsRes, recurringRes, homeworkRes, settingsRes, overridesRes, existingSlotsToday] = await Promise.all([
      supabase.from("exams").select("*").gte("date", today),
      supabase.from("recurring_tasks").select("*").eq("user_id", user.id),
      supabase.from("deadline_tasks").select("*, is_fixed, scheduled_date").gte("due_date", today), 
      supabase.from("planner_settings").select("*").eq("user_id", user.id),
      supabase.from("planner_overrides").select("*").eq("user_id", user.id).gte("date", today),
      supabase.from("revision_slots")
        .select("duration_minutes")
        .match({ user_id: user.id, is_completed: false, date: today })
    ]);

    const exams = (examsRes.data || []) as ExamInput[];
    const recurringTasks = recurringRes.data || [];
    const homework = (homeworkRes.data || []);
    const settingsRows = settingsRes.data || [];
    const overridesRows = overridesRes.data || [];
    
    const activeSlotsToday = existingSlotsToday.data || [];
    const hasTodaySlots = activeSlotsToday.length > 0;
    const currentPlannedRevisionMins = activeSlotsToday.reduce((sum, s) => sum + s.duration_minutes, 0);

    // 2. MAP CAPACITY
    const weeklyPattern: Record<number, number> = {};
    settingsRows.forEach(r => weeklyPattern[r.day_of_week] = r.base_minutes);
    const dateOverrides: Record<string, number> = {};
    overridesRows.forEach(r => dateOverrides[String(r.date)] = r.override_minutes);

    // 3. SIMULATE NON-REVISION LOAD
    const windowDates = Array.from({ length: 60 }, (_, i) => addDays(today, i));
    const engineCapacityMap: Record<string, number> = {};
    const occupiedByRocks: Record<string, number> = {};

    windowDates.forEach(d => {
      const dow = new Date(d + "T00:00:00").getDay();
      const budget = dateOverrides[d] ?? weeklyPattern[dow] ?? 150;
      const recurringMins = recurringTasks
        .filter((t: any) => Number(t.day_of_week) === dow)
        .reduce((sum, t) => sum + (t.duration_minutes || 0), 0);

      occupiedByRocks[d] = recurringMins;
      engineCapacityMap[d] = budget;
    });

    // --- 4. PERSISTENT HOMEWORK PLACEMENT ---
    const tasksToUpdate: { id: string, scheduled_date: string }[] = [];
    const occupiedByHw: Record<string, number> = {};
    windowDates.forEach(d => occupiedByHw[d] = 0);

    const sortedHw = [...homework].sort((a, b) => {
      if (a.is_fixed !== b.is_fixed) return a.is_fixed ? -1 : 1;
      return daysBetween(today, a.due_date) - daysBetween(today, b.due_date);
    });

    for (const task of sortedHw) {
      if (task.status === 'completed') continue;

      let placedDate: string | null = null;
      const taskMins = task.estimated_minutes || 30;

      // RULE 1: Anchor Shield
      if (task.scheduled_date) {
        const preferredDate = task.scheduled_date.split('T')[0];
        if (task.is_fixed || preferredDate === today) {
          if (occupiedByHw[preferredDate] !== undefined) {
            placedDate = preferredDate;
          }
        }
      }

      // RULE 2: Simulation
      if (!placedDate) {
        const dayBeforeDeadline = addDays(task.due_date, -1);
        const possibleDays = windowDates.filter(date => date >= today && date <= dayBeforeDeadline);

        for (const d of possibleDays) {
          const currentLoad = occupiedByRocks[d] + occupiedByHw[d];
          if (currentLoad + taskMins + 45 <= engineCapacityMap[d]) {
            placedDate = d;
            break;
          }
        }
        if (!placedDate) {
          for (const d of possibleDays) {
            const currentLoad = occupiedByRocks[d] + occupiedByHw[d];
            if (currentLoad + taskMins <= engineCapacityMap[d]) {
              placedDate = d;
              break;
            }
          }
        }
        if (!placedDate) placedDate = possibleDays.length > 0 ? dayBeforeDeadline : today;
      }

      // RULE 3: Sync check
      const currentDbDate = task.scheduled_date ? task.scheduled_date.split('T')[0] : null;
      if (placedDate && placedDate !== currentDbDate) {
        tasksToUpdate.push({ id: task.id, scheduled_date: placedDate });
      }

      if (placedDate && occupiedByHw[placedDate] !== undefined) {
        occupiedByHw[placedDate] += taskMins;
      }
    }

    // --- 5. THE MISSING SYNC STEP ---
    // Update capacity map for revision slots
    windowDates.forEach(d => {
      engineCapacityMap[d] = Math.max(0, engineCapacityMap[d] - occupiedByRocks[d] - occupiedByHw[d]);
    });

    // 🎯 ACTUALLY SAVE TO DATABASE
    if (tasksToUpdate.length > 0) {
      console.log("🚀 Anchoring tasks:", tasksToUpdate);
      await Promise.all(
        tasksToUpdate.map(u => 
          supabase
            .from("deadline_tasks")
            .update({ scheduled_date: u.scheduled_date })
            .eq("id", u.id)
        )
      );
    }

    // 5A. SHIELD BREAKER
    const isSignificantTimeFreedUp = engineCapacityMap[today] >= (currentPlannedRevisionMins + 30);
    const syncFromDate = (hasTodaySlots && !isSignificantTimeFreedUp) ? tomorrow : today;

    // 6. RUN ENGINE
    const virtualPlan = planRevisionSlots(exams, {
      startDate: today,
      numDays: 60,
      capacityByDate: engineCapacityMap, 
      includeExamDay: false
    });

    // 7. DB OPERATIONS
    await supabase
      .from("revision_slots")
      .delete()
      .match({ user_id: user.id, is_completed: false })
      .gte("date", syncFromDate);

    const rows = virtualPlan.days
      .filter(day => day.date >= syncFromDate)
      .flatMap(day => 
        day.slots.map(slot => ({
          user_id: user.id,
          exam_id: slot.examId,
          date: day.date, 
          duration_minutes: slot.slotMinutes,
          description: slot.label,
          is_completed: false,
          subject: slot.subject
        }))
      );

    if (rows.length > 0) {
      await supabase.from("revision_slots").insert(rows);
    }

    return { success: true, count: rows.length };
  } catch (error: any) {
    console.error("❌ Sync Error:", error);
    return { success: false, error: error.message };
  }
}