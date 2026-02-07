import { planRevisionSlots, addDays, daysBetween } from "./revisionEngine";

export type DayPlan = {
  date: string;
  weekly: { minutes: number; items: any[] };
  homework: { minutes: number; actualCompletedMinutes: number; items: any[] };
  revision: { minutes: number; slots: any[] };
  projects: { minutes: number; items: any[] };
  baseCapacity: number;
  totalPlanned: number;   
  totalCompleted: number; 
  plannedTaskCount: number;   
  completedTaskCount: number; 
  spare: number;
};

export type WeekPlan = { days: DayPlan[] };

export function buildWeekPlan({
  today,
  numDays = 30,
  weeklyTasks,
  deadlines,
  exams,
  projects,
  completions = [],
  capacityData,
}: any): WeekPlan {
  const windowDates = Array.from({ length: numDays }, (_, i) => addDays(today, i));
  
  // 🎯 1. HARMONIZE IDs (Match DailyChecklist.tsx keys)
  const todayCompletionKeys = new Set<string>();
  const historicalIds = new Set<string>();

  completions?.forEach((c: any) => {
    const key = `${c.source_type}:${c.source_id}`;
    if (c.date === today) {
      todayCompletionKeys.add(key);
      todayCompletionKeys.add(c.source_id); 
    } else if (c.date < today) {
      historicalIds.add(c.source_id);
    }
  });

  // 2. CAPACITY MAP
  const baseCapMap: Record<string, number> = {};
  windowDates.forEach(d => {
    const dow = new Date(d + "T00:00:00").getDay();
    let budget = 150; 
    if (capacityData?.weeklyPattern?.[dow] !== undefined) budget = capacityData.weeklyPattern[dow];
    if (capacityData?.dateOverrides?.[d] !== undefined) budget = capacityData.dateOverrides[d];
    baseCapMap[d] = budget;
  });

  // 3. WEEKLY ITEMS
  const weeklyItems: Record<string, any[]> = {};
  windowDates.forEach(d => {
    const dow = new Date(d + "T00:00:00").getDay();
    weeklyItems[d] = (weeklyTasks || [])
      .filter((t: any) => t.day_of_week === dow && t.name?.trim())
      .map((t: any) => ({ 
        id: t.id, 
        name: t.name, 
        minutes: t.duration_minutes,
        isDone: todayCompletionKeys.has(`weekly_task:${t.id}`),
        type: 'weekly_task' 
      }));
  });

  // 4. HOMEWORK (The Iron Curtain Lock)
  const homeworkItems: Record<string, any[]> = {};
  const occupiedCap: Record<string, number> = {};
  
  windowDates.forEach(d => {
    homeworkItems[d] = [];
    const wkMins = (weeklyItems[d] || []).reduce((sum: number, i: any) => sum + (i.minutes || 0), 0);
    // 🎯 INITIAL LOAD: Capacity starts at base minus weekly
    occupiedCap[d] = wkMins; 
  });

  const sortedHw = [...(deadlines || [])].sort((a: any, b: any) => 
    daysBetween(today, a.due_date) - daysBetween(today, b.due_date)
  );

  for (const task of sortedHw) {
    const isDoneToday = todayCompletionKeys.has(`deadline_task:${task.id}`);
    const isDoneHistory = historicalIds.has(task.id) || (task.status === 'completed' && !isDoneToday);

    if (isDoneHistory) continue;

    const mapped = { 
      id: task.id, 
      name: task.name, 
      subject: task.subject,
      minutes: task.estimated_minutes, 
      dueDate: task.due_date,
      isDone: isDoneToday,
      type: 'deadline_task'
    };

    // 🎯 IF IT WAS PLANNED FOR TODAY OR IS DONE TODAY, IT STAYS TODAY
    if (isDoneToday) {
      homeworkItems[today].push(mapped);
      occupiedCap[today] += task.estimated_minutes;
      continue;
    }

    const candidates = windowDates.filter(d => d <= task.due_date);
    for (const d of candidates) {
      // 🎯 THE HYDRA KILLER: We only add if occupiedCap + this task is <= base budget
      if (occupiedCap[d] + task.estimated_minutes <= baseCapMap[d]) {
        homeworkItems[d].push(mapped);
        occupiedCap[d] += task.estimated_minutes;
        break;
      }
    }
  }

  // 5. REVISION (Static Allocation)
  const revisionCap: Record<string, number> = {};
  windowDates.forEach(d => revisionCap[d] = Math.max(0, baseCapMap[d] - occupiedCap[d]));
  
  const revisionPlan = planRevisionSlots(exams, { 
    startDate: today, numDays, capacityByDate: revisionCap, includeExamDay: false 
  });

  // 6. FINAL ASSEMBLY
// 6. FINAL ASSEMBLY (The "Static 5" Accountant)
  const days: DayPlan[] = revisionPlan.days.map((rDay: any) => {
    const d = rDay.date;
    
    // 🎯 1. Create the Live Checklist
    // We map every item we found in the static planning phase to its current status
    const wk = (weeklyItems[d] || []).map((i: any) => ({
      ...i,
      isDone: todayCompletionKeys.has(`weekly_task:${i.id}`)
    }));

    const hw = (homeworkItems[d] || []).map((i: any) => ({
      ...i,
      isDone: todayCompletionKeys.has(`deadline_task:${i.id}`)
    }));

    const rv = (rDay.slots || []).map((s: any) => ({
      ...s,
      id: s.examId,
      minutes: s.slotMinutes || 30,
      isDone: todayCompletionKeys.has(`revision:${s.examId}`),
      type: 'revision'
    }));

    // 🎯 2. THE DENOMINATOR (The "Locked" 5)
    // We count the items as they exist in the arrays BEFORE checking completion.
    // This ensures that even if a task is "Done", it stays in the count.
    const plannedCount = wk.length + hw.length + rv.length;

    // 🎯 3. THE NUMERATOR (The "Live" 7)
    // We count EVERYTHING that is marked as isDone.
    // (Note: If you have bonus tasks from other days, they must be in the 'hw' array for today)
    const doneCount = wk.filter((i: any) => i.isDone).length + 
                      hw.filter((i: any) => i.isDone).length + 
                      rv.filter((i: any) => i.isDone).length;

    // 🎯 4. THE STUDY LOAD (The Blue Bar)
    const doneMinutes = wk.filter((i: any) => i.isDone).reduce((s: number, i: any) => s + (i.minutes || 0), 0) +
                        hw.filter((i: any) => i.isDone).reduce((s: number, i: any) => s + (i.minutes || 0), 0) +
                        rv.filter((i: any) => i.isDone).reduce((s: number, i: any) => s + (i.minutes || 0), 0);

    const totalPlannedMins = wk.reduce((s: number, i: any) => s + (i.minutes || 0), 0) +
                             hw.reduce((s: number, i: any) => s + (i.minutes || 0), 0) +
                             rv.reduce((s: number, i: any) => s + (i.minutes || 0), 0);

    return {
      date: d,
      baseCapacity: baseCapMap[d],
      weekly: { minutes: wk.reduce((s: number, i: any) => s + (i.minutes || 0), 0), items: wk },
      homework: { 
        minutes: hw.reduce((s: number, i: any) => s + (i.minutes || 0), 0), 
        actualCompletedMinutes: hw.filter((i: any) => i.isDone).reduce((s: number, i: any) => s + (i.minutes || 0), 0), 
        items: hw 
      },
      revision: { minutes: rv.reduce((s: number, i: any) => s + (i.minutes || 0), 0), slots: rv },
      projects: { minutes: 0, items: [] },
      
      // Target bar stays at setting (e.g. 150m)
      totalPlanned: baseCapMap[d], 
      totalCompleted: doneMinutes,

      // 📊 Denominator is the length of the lists. 
      // 📊 Numerator is the count of isDone.
      plannedTaskCount: plannedCount,   
      completedTaskCount: doneCount,
      
      spare: Math.max(0, baseCapMap[d] - totalPlannedMins)
    };
  });

  return { days };
}