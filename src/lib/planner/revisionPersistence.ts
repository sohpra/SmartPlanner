import { supabase } from "@/lib/supabase/client";
import { planRevisionSlots, ExamInput, addDays, daysBetween } from "./revisionEngine";

export async function syncRevisionSlots() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = addDays(today, 1);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "No user session" };

  try {
    // 1. FETCH ALL CORE DATA
    const [examsRes, recurringRes, homeworkRes, settingsRes, overridesRes, existingTodayRes] = await Promise.all([
      supabase.from("exams").select("*").gte("date", today),
      supabase.from("recurring_tasks").select("*").eq("user_id", user.id),
      supabase.from("deadline_tasks").select("*").gte("due_date", today),
      supabase.from("planner_settings").select("*").eq("user_id", user.id),
      supabase.from("planner_overrides").select("*").eq("user_id", user.id).gte("date", today),
      // Check if Today already has active revision slots
      supabase.from("revision_slots")
        .select("id")
        .match({ user_id: user.id, is_completed: false, date: today })
    ]);

    const exams = (examsRes.data || []) as ExamInput[];
    const recurringTasks = recurringRes.data || [];
    const homework = homeworkRes.data || [];
    const settingsRows = settingsRes.data || [];
    const overridesRows = overridesRes.data || [];
    const hasTodaySlots = (existingTodayRes.data || []).length > 0;

    // 2. MAP CAPACITY & OVERRIDES
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

    const sortedHw = [...homework]
      .filter(h => h.status !== 'completed')
      .sort((a, b) => daysBetween(today, a.due_date) - daysBetween(today, b.due_date));

    // 4. DYNAMIC HOMEWORK PLACEMENT (Earliest Best Fit + Guaranteed slotting + N-1 Deadline)
    for (const hw of sortedHw) {
      const mins = hw.estimated_minutes || 0;
      const dueDate = hw.due_date;
      
      // 🎯 Define this here so it's available to ALL passes below
      const dayBeforeDeadline = addDays(dueDate, -1);
      const possibleDays = windowDates.filter(date => date >= today && date <= dayBeforeDeadline);

      let placed = false;

      // PASS 1: The "Best Fit" (Protects Revision)
      for (const d of possibleDays) {
        const buffer = 45; 
        if (occupiedByRocks[d] + mins + buffer <= engineCapacityMap[d]) {
          occupiedByRocks[d] += mins;
          placed = true;
          break; 
        }
      }

      // PASS 2: The "Emergency Fit" (Ignores Revision, respects 150m cap)
      if (!placed) {
        for (const d of possibleDays) {
          if (occupiedByRocks[d] + mins <= engineCapacityMap[d]) {
            occupiedByRocks[d] += mins;
            placed = true;
            break;
          }
        }
      }

      // PASS 3: THE GUARANTEE (Ignore the cap entirely)
      if (!placed) {
        // Fallback logic: If the deadline is tomorrow, use today. 
        // Otherwise, use the day before the deadline.
        const targetDate = possibleDays.length > 0 ? dayBeforeDeadline : today;
        
        occupiedByRocks[targetDate] = (occupiedByRocks[targetDate] || 0) + mins;
        console.log(`🔥 URGENT: ${hw.name} forced onto: ${targetDate}`);
      }
    }
    // Calculate final gap
    windowDates.forEach(d => {
      engineCapacityMap[d] = Math.max(0, engineCapacityMap[d] - occupiedByRocks[d]);
    });

    // 4. RUN ENGINE
    const virtualPlan = planRevisionSlots(exams, {
      startDate: today,
      numDays: 60,
      capacityByDate: engineCapacityMap, 
      includeExamDay: false
    });

    // 5. ATOMIC DB OPERATIONS (The "Smart Shield")
    // Determine the "Cut-off" date for the update
    const syncFromDate = hasTodaySlots ? tomorrow : today;

    // A. Wipe only what needs to be replaced
    await supabase
      .from("revision_slots")
      .delete()
      .match({ user_id: user.id, is_completed: false })
      .gte("date", syncFromDate);

    // B. Map rows for insertion, respecting the shield
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

    return { success: true, count: rows.length, shielded: hasTodaySlots };
  } catch (error: any) {
    console.error("❌ Sync Error:", error);
    return { success: false, error: error.message };
  }
}