import { supabase } from "@/lib/supabase/client";
import { planRevisionSlots, ExamInput, addDays, daysBetween } from "./revisionEngine";

export async function syncRevisionSlots() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = addDays(today, 1);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No user session" };

  try {
    // 1. FETCH ALL DATA (Including Completed Items to prevent "Time Refunding")
    const [examsRes, recurringRes, homeworkRes, settingsRes, overridesRes, allSlotsToday, completionsTodayRes] = await Promise.all([
      supabase.from("exams").select("*").gte("date", today),
      supabase.from("recurring_tasks").select("*").eq("user_id", user.id),
      // 🔍 Fetch both active and completed to see today's true weight
      supabase.from("deadline_tasks").select("*, is_fixed, scheduled_date").or(`status.eq.active,status.eq.completed`).gte("due_date", today), 
      supabase.from("planner_settings").select("*").eq("user_id", user.id),
      supabase.from("planner_overrides").select("*").eq("user_id", user.id).gte("date", today),
      supabase.from("revision_slots").select("duration_minutes, is_completed").match({ user_id: user.id, date: today }),
      // 🔍 Fetch daily completions to track Recurring/Weekly work done
      supabase.from("daily_completions").select("source_id, source_type").eq("user_id", user.id).eq("date", today)
    ]);

    const exams = (examsRes.data || []) as ExamInput[];
    const recurringTasks = recurringRes.data || [];
    const homework = (homeworkRes.data || []);
    const settingsRows = settingsRes.data || [];
    const overridesRows = overridesRes.data || [];
    const completionsToday = completionsTodayRes.data || [];
    
    const slotsToday = allSlotsToday.data || [];
    const hasAnySlotsToday = slotsToday.length > 0;
    const currentPlannedRevisionMins = slotsToday.reduce((sum, s) => sum + s.duration_minutes, 0);

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
      const budget = dateOverrides[d] ?? weeklyPattern[dow] ?? 150;
      
      let nonRevisionLoad = 0;
      if (d === today) {
        // Today: Count anything in the completions ledger + any remaining pending recurring
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

    // 4. HOMEWORK PLACEMENT & WEIGHTING
    const tasksToUpdate: { id: string, scheduled_date: string }[] = [];
    const occupiedByHw: Record<string, number> = {};
    windowDates.forEach(d => occupiedByHw[d] = 0);

    const sortedHw = [...homework].sort((a, b) => {
      if (a.is_fixed !== b.is_fixed) return a.is_fixed ? -1 : 1;
      return daysBetween(today, a.due_date) - daysBetween(today, b.due_date);
    });

    for (const task of sortedHw) {
      // 🎯 If task is completed TODAY, we must count its weight against today's budget
      if (task.status === 'completed') {
        const taskDate = task.scheduled_date?.split('T')[0];
        if (taskDate === today) occupiedByHw[today] += (task.estimated_minutes || 30);
        continue; 
      }

      let placedDate: string | null = null;
      const taskMins = task.estimated_minutes || 30;

      if (task.scheduled_date) {
        const preferredDate = task.scheduled_date.split('T')[0];
        if (task.is_fixed || preferredDate === today) {
          if (occupiedByHw[preferredDate] !== undefined) placedDate = preferredDate;
        }
      }

      if (!placedDate) {
        const dayBeforeDeadline = addDays(task.due_date, -1);
        const possibleDays = windowDates.filter(date => date >= today && date <= dayBeforeDeadline);
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
        if (!placedDate) placedDate = possibleDays.length > 0 ? dayBeforeDeadline : today;
      }

      const currentDbDate = task.scheduled_date ? task.scheduled_date.split('T')[0] : null;
      if (placedDate && placedDate !== currentDbDate) {
        tasksToUpdate.push({ id: task.id, scheduled_date: placedDate });
      }
      if (placedDate) occupiedByHw[placedDate] += taskMins;
    }

    // 5. UPDATE DB & PREP REVISION GAPS
    windowDates.forEach(d => {
      engineCapacityMap[d] = Math.max(0, engineCapacityMap[d] - occupiedByRocks[d] - occupiedByHw[d]);
    });

    if (tasksToUpdate.length > 0) {
      await Promise.all(tasksToUpdate.map(u => 
        supabase.from("deadline_tasks").update({ scheduled_date: u.scheduled_date }).eq("id", u.id)
      ));
    }

    // 6. THE IRON SHIELD EVALUATION
    const virtualPlanFull = planRevisionSlots(exams, {
      startDate: today,
      numDays: 60,
      capacityByDate: engineCapacityMap, 
      includeExamDay: false
    });

    const totalMinsNeeded = virtualPlanFull.days.reduce((sum, d) => sum + d.slots.reduce((s, slot) => s + slot.slotMinutes, 0), 0);
    const futureCapacity = windowDates.filter(d => d > today).reduce((sum, d) => sum + engineCapacityMap[d], 0);
    const isCrisisMode = totalMinsNeeded > futureCapacity;

    const totalTodayBudget = dateOverrides[today] ?? weeklyPattern[new Date(today).getDay()] ?? 150;
    
    // 🛡️ SHIELD RULES:
    // 1. If we have used ANY revision slots (even done ones)
    // 2. OR if we have less than 90m total capacity left
    // 3. OR if we've used > 25% of the day (1 - 0.75)
    const hasLittleCapacityLeft = engineCapacityMap[today] < 90;
    const isDayStarted = engineCapacityMap[today] < (totalTodayBudget * 0.75);
    
    let syncFromDate = today;
    if (!isCrisisMode) {
      if (hasAnySlotsToday || hasLittleCapacityLeft || isDayStarted) {
        syncFromDate = tomorrow;
      }
    }

    console.log(`🛡️ Final Decision: ${syncFromDate} | Remaining: ${engineCapacityMap[today]}/${totalTodayBudget}`);

    // 7. ATOMIC DB SYNC
    await supabase.from("revision_slots")
      .delete()
      .match({ user_id: user.id, is_completed: false })
      .gte("date", syncFromDate);

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