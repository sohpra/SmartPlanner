import { supabase } from "@/lib/supabase/client";
import { planRevisionSlots, ExamInput, addDays, daysBetween } from "./revisionEngine";

// ... (imports remain the same)

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
      supabase.from("deadline_tasks").select("*").gte("due_date", today),
      supabase.from("planner_settings").select("*").eq("user_id", user.id),
      supabase.from("planner_overrides").select("*").eq("user_id", user.id).gte("date", today),
      // 🎯 Fetch ACTUAL slots to see how many minutes are currently planned
      supabase.from("revision_slots")
        .select("duration_minutes")
        .match({ user_id: user.id, is_completed: false, date: today })
    ]);

    const exams = (examsRes.data || []) as ExamInput[];
    const recurringTasks = recurringRes.data || [];
    const homework = homeworkRes.data || [];
    const settingsRows = settingsRes.data || [];
    const overridesRows = overridesRes.data || [];
    
    // Existing DB state for today
    const activeSlotsToday = existingSlotsToday.data || [];
    const hasTodaySlots = activeSlotsToday.length > 0;
    const currentPlannedRevisionMins = activeSlotsToday.reduce((sum, s) => sum + s.duration_minutes, 0);

    // 2. MAP CAPACITY & OVERRIDES (Same as before)
    const weeklyPattern: Record<number, number> = {};
    settingsRows.forEach(r => weeklyPattern[r.day_of_week] = r.base_minutes);
    const dateOverrides: Record<string, number> = {};
    overridesRows.forEach(r => dateOverrides[String(r.date)] = r.override_minutes);

    // 3. SIMULATE NON-REVISION LOAD (The "Rocks")
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

    // 4. DYNAMIC HOMEWORK PLACEMENT (Earliest Best Fit)
    // ... (Keep your 3-pass loop logic exactly as it is)

    // Calculate final gap
    windowDates.forEach(d => {
      engineCapacityMap[d] = Math.max(0, engineCapacityMap[d] - occupiedByRocks[d]);
    });

    // 🎯 5. THE SHIELD BREAKER LOGIC
    // We compare: 
    // A) The gap we just calculated for today (engineCapacityMap[today])
    // B) The revision minutes currently in the DB (currentPlannedRevisionMins)
    
    // If the new gap is larger than current planning + 30 mins, it means 
    // something significant (like Sinfonia) was deleted. Break the shield.
    const isSignificantTimeFreedUp = engineCapacityMap[today] >= (currentPlannedRevisionMins + 30);
    
    const syncFromDate = (hasTodaySlots && !isSignificantTimeFreedUp) ? tomorrow : today;

    // 6. RUN ENGINE
    const virtualPlan = planRevisionSlots(exams, {
      startDate: today,
      numDays: 60,
      capacityByDate: engineCapacityMap, 
      includeExamDay: false
    });

    // 7. ATOMIC DB OPERATIONS
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

    return { 
      success: true, 
      count: rows.length, 
      shielded: syncFromDate === tomorrow,
      shieldBroken: isSignificantTimeFreedUp && hasTodaySlots 
    };
  } catch (error: any) {
    console.error("❌ Sync Error:", error);
    return { success: false, error: error.message };
  }
}