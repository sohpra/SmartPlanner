import { planRevisionSlots, addDays, daysBetween, toDateOnly } from "./revisionEngine";

export type DayPlan = {
  date: string;
  weekly: { minutes: number; items: any[] };
  homework: { 
    minutes: number; 
    actualCompletedMinutes: number; // 🎯 Added this
    items: any[] 
  };
  revision: { minutes: number; slots: any[] };
  projects: { minutes: number; items: any[] };
  baseCapacity: number;
  totalPlanned: number;   // 🎯 Changed from totalUsed
  totalCompleted: number; // 🎯 Added this
  plannedTaskCount: number;   // 🎯 Added this
  completedTaskCount: number; // 🎯 Added this
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
  capacityData, // 🎯 Receive the new data here
}: any): WeekPlan {
  const windowDates = Array.from({ length: numDays }, (_, i) => addDays(today, i));
  
  // 1. Capacity Strategy (Waterfall Logic)
  const baseCapMap: Record<string, number> = {};

  windowDates.forEach(d => {
    const dateObj = new Date(d + "T00:00:00");
    const dow = dateObj.getDay();
    
    // Tier 3: Hardcoded Fallback
    let budget = 150;

    // Tier 2: Global Weekly Pattern (from DB)
    if (capacityData?.weeklyPattern && capacityData.weeklyPattern[dow] !== undefined) {
      budget = capacityData.weeklyPattern[dow];
    }

    // Tier 1: Specific Date Override (Highest Priority - e.g. Half Term)
    if (capacityData?.dateOverrides && capacityData.dateOverrides[d] !== undefined) {
      budget = capacityData.dateOverrides[d];
    }

    baseCapMap[d] = budget;
  });

  // Initialize homework and remaining capacity maps
  const homeworkItems: Record<string, any[]> = {};
  const remainingCap: Record<string, number> = {};
  
  windowDates.forEach(d => {
    homeworkItems[d] = [];
    remainingCap[d] = baseCapMap[d];
  });

  // 2. Weekly Fixed Tasks
  const weeklyItems: Record<string, any[]> = {};
  windowDates.forEach(d => {
    const dow = new Date(d + "T00:00:00").getDay();
    weeklyItems[d] = weeklyTasks
      .filter((t: any) => t.day_of_week === dow)
      .map((t: any) => ({ 
        id: t.id, 
        name: t.name, 
        subject: t.subject, // ENSURE THIS LINE IS HERE
        minutes: t.duration_minutes 
      }));
    
    const weeklyMins = weeklyItems[d].reduce((sum, item) => sum + item.minutes, 0);
    remainingCap[d] -= weeklyMins;
  });

  
  // --- STEP 3: Homework (Status-Aware & Stability-Locked) ---
  // --- Homework (Strict Priority Sort) ---
  const orderedDeadlines = [...deadlines].sort((a, b) => {
    // Primary Sort: Due Date (Earliest first)
    const dateDiff = daysBetween(today, a.due_date) - daysBetween(today, b.due_date);
    if (dateDiff !== 0) return dateDiff;

    // Secondary Sort (Tie-breaker): Minutes (Longest first)
    // 🎯 This ensures Dr Frost (30m) is evaluated BEFORE Greek (20m)
    return b.estimated_minutes - a.estimated_minutes;
  });

  // 1. Identify anything completed PRIOR to today
  const completedBeforeToday = new Set(
    completions
      ?.filter((c: any) => c.date < today)
      .map((c: any) => c.source_id)
  );

  for (const task of orderedDeadlines) {
    // 🎯 EXORCISM: If it was finished yesterday or earlier, it stays in the past.
    if (completedBeforeToday.has(task.id)) {
      continue; 
    }

    const mappedTask = { 
      id: task.id, 
      name: task.name, 
      subject: task.subjects?.name || task.subject, 
      dueDate: task.due_date, 
      minutes: task.estimated_minutes,
      status: task.status,
      isOverdue: task.due_date < today
    };

    // 2. Handle Overdue (Only Active ones reach here now)
    if (task.due_date < today) {
      homeworkItems[today].push(mappedTask);
      // Subtract minutes to keep capacity occupied
      remainingCap[today] -= task.estimated_minutes;
      continue;
    }

    const candidates = windowDates.filter(d => d <= task.due_date);
    if (candidates.length === 0) continue;

    let assigned = false;
    for (const date of candidates) {
      const isToday = date === today;

      // 1. Handle Completed Tasks (The "Memory")
      // 🎯 THE "NO-HYDRA" STABILITY LOCK
      if (task.status === 'completed') {
        if (isToday) {
          // Add to the list so it shows in "Finalized Today"
          homeworkItems[date].push(mappedTask);
          
          // 🛑 NOTICE: We REMOVED "remainingCap[date] -= task.estimated_minutes"
          // By NOT subtracting minutes, today's 150m budget remains 150m.
          // This stops the engine from pulling in extra tasks to fill a gap.
          
          assigned = true;
          break;
        }
      }

      // 2. Handle Active Tasks (The "Gatekeeper")
      // 🎯 THE FIX: If it's Today, and the task doesn't fit PERFECTLY into remainingCap, 
      // don't pull it in from the future. 
      if (remainingCap[date] >= task.estimated_minutes) {
        homeworkItems[date].push(mappedTask);
        remainingCap[date] -= task.estimated_minutes;
        assigned = true;
        break; 
      }
      
      // If we are looking at Today but the task is too big, 
      // do NOT let it "check" today anymore. Move to the next candidate date.
      if (isToday) continue; 
    }

    // 5. Fallback for overflow
    if (!assigned) {
      const latestDate = candidates[candidates.length - 1];
      homeworkItems[latestDate].push(mappedTask);
      remainingCap[latestDate] -= task.estimated_minutes;
    }
  }

  // 4. Revision (Uses leftover capacity)
  const revisionCap: Record<string, number> = {};
  windowDates.forEach(d => revisionCap[d] = Math.max(0, remainingCap[d]));
  
  const revisionPlan = planRevisionSlots(exams, {
    startDate: today,
    numDays,
    capacityByDate: revisionCap,
    includeExamDay: false,
  });

  // 5. Final Assembly
// Inside buildWeekPlan.ts -> Final Assembly map function
const days: DayPlan[] = revisionPlan.days.map(rDay => {
  const date = rDay.date;
  
  const weeklyMins = weeklyItems[date].reduce((s, i) => s + i.minutes, 0);
  const hwItems = homeworkItems[date];

  // 🎯 Calculate PLANNED metrics (Stuff actually due today or active)
  const plannedHwItems = hwItems.filter(i => i.dueDate <= date || i.status === 'active');
  const plannedHwMins = plannedHwItems.reduce((s, i) => s + i.minutes, 0);
  
  // 🎯 Calculate COMPLETED metrics (Regardless of when it was due)
  const completedHwItems = hwItems.filter(i => i.status === 'completed');
  const completedHwMins = completedHwItems.reduce((s, i) => s + i.minutes, 0);

  // totalUsed for the 'Planned' Card should be the original goal
  const totalPlanned = weeklyMins + plannedHwMins + rDay.usedMinutes;
  // minutesCompleted is everything actually finished
  const totalCompleted = weeklyMins + completedHwMins + rDay.usedMinutes;

  return {
    date,
    baseCapacity: baseCapMap[date],
    weekly: { minutes: weeklyMins, items: weeklyItems[date] },
    homework: { 
      minutes: plannedHwMins, 
      actualCompletedMinutes: completedHwMins,
      items: hwItems 
    },
    revision: { minutes: rDay.usedMinutes, slots: rDay.slots },
    projects: { minutes: 0, items: [] }, 
    totalPlanned, // 🎯 Pass this to the Card
    totalCompleted, // 🎯 Pass this to the Card
    plannedTaskCount: weeklyItems[date].length + plannedHwItems.length,
    completedTaskCount: weeklyItems[date].filter(i => i.isDone).length + completedHwItems.length,
    spare: Math.max(0, baseCapMap[date] - totalPlanned)
  };
});

  return { days };
}