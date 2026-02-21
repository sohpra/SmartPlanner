import { supabase } from "@/lib/supabase/client";
import { planRevisionSlots, ExamInput, addDays, daysBetween } from "./revisionEngine";

// 🎯 Interface for Supabase responses
interface RevisionSlotRow {
  id: string;
  duration_minutes: number;
  is_completed: boolean;
  date: string;
  description: string;
}

export async function syncRevisionSlots() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = addDays(today, 1);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No user session" };

  try {
    // 1. FETCH ALL DATA
    const [
      examsRes, 
      recurringRes, 
      homeworkRes, 
      settingsRes, 
      overridesRes, 
      allSlotsToday, 
      completionsTodayRes,
      historicalCompletionsRes
    ] = await Promise.all([
      supabase.from("exams").select("*").gte("date", today),
      supabase.from("recurring_tasks").select("*").eq("user_id", user.id),
      supabase.from("deadline_tasks")
        .select("*, is_fixed, scheduled_date")
        .or(`status.eq.active,status.eq.completed`)
        .gte("due_date", today), 
      supabase.from("planner_settings").select("*").eq("user_id", user.id),
      supabase.from("planner_overrides").select("*").eq("user_id", user.id).gte("date", today),
      supabase.from("revision_slots")
        .select("id, duration_minutes, is_completed, date, description")
        .match({ user_id: user.id, date: today }),
      supabase.from("daily_completions").select("source_id, source_type").eq("user_id", user.id).eq("date", today),
      supabase.from("revision_slots")
        .select("exam_id")
        .eq("user_id", user.id)
        .eq("is_completed", true) // 🎯 Get the "Debt" context
    ]);

    const exams = (examsRes.data || []) as ExamInput[];
    const recurringTasks = recurringRes.data || [];
    const homework = (homeworkRes.data || []);
    const settingsRows = settingsRes.data || [];
    const overridesRows = overridesRes.data || [];
    const completionsToday = completionsTodayRes.data || [];
    const historicalCompletions = historicalCompletionsRes.data || [];
    
    const slotsToday = (allSlotsToday.data || []) as RevisionSlotRow[];
    const hasAnySlotsToday = slotsToday.length > 0;

    // 🎯 SHIELD LOGIC: Is today already finished?
    const allTodayDone = slotsToday.length > 0 && slotsToday.every(s => s.is_completed);
    const missionAlreadySecured = hasAnySlotsToday && allTodayDone;
    const anyRevisionDone = slotsToday.some(s => s.is_completed);

    // 🎯 THE GHOST SLOT FIX: Count minutes ALREADY assigned to today's revision
    const revisionMinsAlreadyToday = slotsToday.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

    // 2. MAP CAPACITY
    const weeklyPattern: Record<number, number> = {};
    settingsRows.forEach(r => weeklyPattern[r.day_of_week] = r.base_minutes);
    const dateOverrides: Record<string, number> = {};
    overridesRows.forEach(r => dateOverrides[String(r.date)] = r.override_minutes);

    const windowDates = Array.from({ length: 60 }, (_, i) => addDays(today, i));
    const engineCapacityMap: Record<string, number> = {};
    const occupiedByRocks: Record<string, number> = {};

    // 3. CALCULATE "ROCK" LOAD (Recurring/Weekly)
    windowDates.forEach(d => {
      const dow = new Date(d + "T00:00:00").getDay();
      let budget = dateOverrides[d] ?? weeklyPattern[dow] ?? 150;
      
      if (d === today && missionAlreadySecured) {
        budget = 0;
      }

      let nonRevisionLoad = 0;
      if (d === today) {
        const completedRecurringIds = new Set(completionsToday.filter(c => c.source_type === 'recurring_task').map(c => c.source_id));
        nonRevisionLoad = recurringTasks
          .filter((t: any) => Number(t.day_of_week) === dow || completedRecurringIds.has(t.id))
          .reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
      } else {
        nonRevisionLoad = recurringTasks
          .filter((t: any) => Number(t.day_of_week) === dow)
          .reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
      }

      occupiedByRocks[d] = nonRevisionLoad;
      engineCapacityMap[d] = budget;
    });

    // 4. HOMEWORK PLACEMENT (Simulation)
    const tasksToUpdate: { id: string, scheduled_date: string }[] = [];
    const occupiedByHw: Record<string, number> = {};
    windowDates.forEach(d => occupiedByHw[d] = 0);

    const sortedHw = [...homework].sort((a, b) => {
      if (a.is_fixed !== b.is_fixed) return a.is_fixed ? -1 : 1;
      return daysBetween(today, a.due_date) - daysBetween(today, b.due_date);
    });

    const searchStartDate = (missionAlreadySecured || anyRevisionDone) ? tomorrow : today;

    for (const task of sortedHw) {
      if (task.status === 'completed') {
        const taskDate = task.scheduled_date?.split('T')[0];
        if (taskDate === today) occupiedByHw[today] += (task.estimated_minutes || 30);
        continue; 
      }

      let placedDate: string | null = null;
      const taskMins = task.estimated_minutes || 30;

      if (task.scheduled_date) {
        const preferredDate = task.scheduled_date.split('T')[0];
        if (task.is_fixed || (preferredDate === today && !missionAlreadySecured)) {
          if (occupiedByHw[preferredDate] !== undefined) placedDate = preferredDate;
        }
      }

      if (!placedDate) {
        const dayBeforeDeadline = addDays(task.due_date, -1);
        const possibleDays = windowDates.filter(date => date >= searchStartDate && date <= dayBeforeDeadline);

        for (const d of possibleDays) {
          if (occupiedByRocks[d] + occupiedByHw[d] + taskMins + 45 <= engineCapacityMap[d]) {
            placedDate = d; break;
          }
        }
        if (!placedDate) {
          for (const d of possibleDays) {
            if (occupiedByRocks[d] + occupiedByHw[d] + taskMins <= engineCapacityMap[d]) {
              placedDate = d; break;
            }
          }
        }
        if (!placedDate) {
          placedDate = (dayBeforeDeadline >= searchStartDate) ? dayBeforeDeadline : searchStartDate;
        }
      }

      const currentDbDate = task.scheduled_date ? task.scheduled_date.split('T')[0] : null;
      if (placedDate && placedDate !== currentDbDate) {
        tasksToUpdate.push({ id: task.id, scheduled_date: placedDate });
      }
      if (placedDate) occupiedByHw[placedDate] += taskMins;
    }

    // 5. UPDATE DB & PREP REVISION GAPS
    windowDates.forEach(d => {
      const existingRevisionMins = (d === today) ? revisionMinsAlreadyToday : 0;
      engineCapacityMap[d] = Math.max(0, engineCapacityMap[d] - occupiedByRocks[d] - occupiedByHw[d] - existingRevisionMins);
    });

    if (tasksToUpdate.length > 0) {
      await Promise.all(tasksToUpdate.map(u => 
        supabase.from("deadline_tasks").update({ scheduled_date: u.scheduled_date }).eq("id", u.id)
      ));
    }

    // 🎯 6. THE IRON SHIELD EVALUATION (Data-Driven)
    const completionMap = (historicalCompletions || []).reduce((acc: any, curr: any) => {
      acc[curr.exam_id] = (acc[curr.exam_id] || 0) + 1;
      return acc;
    }, {});

    const virtualPlanFull = planRevisionSlots(exams, { 
      startDate: today,
      numDays: 60,
      capacityByDate: engineCapacityMap, 
      includeExamDay: false,
      completionMap: completionMap 
    });

    // 🎯 7. ATOMIC DB SYNC
    let syncFromDate = today;
    if (missionAlreadySecured || anyRevisionDone) {
      syncFromDate = tomorrow;
    }

    // Always clear uncompleted slots from Today onwards to prevent stacking
    await supabase.from("revision_slots")
      .delete()
      .match({ user_id: user.id, is_completed: false })
      .gte("date", today); 

    const rowsToInsert = virtualPlanFull.days
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

    if (rowsToInsert.length > 0) {
      await supabase.from("revision_slots").insert(rowsToInsert);
    }

    return { success: true, count: rowsToInsert.length, shielded: syncFromDate === tomorrow };

  } catch (error: any) {
    console.error("❌ Sync Error:", error);
    return { success: false, error: error.message };
  }
}