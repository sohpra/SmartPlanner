import { planRevisionSlots, addDays, daysBetween, toDateOnly } from "./revisionEngine";

export type DayPlan = {
  date: string;
  weekly: { minutes: number; items: any[] };
  homework: { minutes: number; items: any[] };
  revision: { minutes: number; slots: any[] };
  projects: { minutes: number; items: any[] };
  baseCapacity: number;
  totalUsed: number;
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
}: any): WeekPlan {
  const windowDates = Array.from({ length: numDays }, (_, i) => addDays(today, i));
  
  // 1. Base Capacity (4h weekends, 2.5h weekdays)
  const baseCapMap: Record<string, number> = {};
  windowDates.forEach(d => {
    const dow = new Date(d + "T00:00:00").getDay();
    baseCapMap[d] = (dow === 0 || dow === 6) ? 240 : 150;
  });

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

  // 3. Homework (Strict No-Jump Logic)
  const orderedDeadlines = [...deadlines].sort((a, b) => daysBetween(today, a.due_date) - daysBetween(today, b.due_date));
  
 // Inside buildWeekPlan.ts
// 2. Homework Allocation (Earliest Full Slot Logic)
for (const task of orderedDeadlines) {
  // Find all available days before the due date
  const candidates = windowDates.filter(d => d < task.due_date);
  if (candidates.length === 0) continue;

  let assigned = false;

  // Search for the EARLIEST day that can fit the WHOLE task
  for (const date of candidates) {
    if (remainingCap[date] >= task.estimated_minutes) {
      homeworkItems[date].push({ 
        id: task.id, 
        name: task.name, 
        subject: task.subject, 
        dueDate: task.due_date, 
        minutes: task.estimated_minutes 
      });
      remainingCap[date] -= task.estimated_minutes;
      assigned = true;
      break; // Task is fully placed, stop searching
    }
  }

  // FALLBACK: If no single day fits it (unlikely with small tasks), 
  // place it on the latest possible day to avoid losing the task.
  if (!assigned) {
    const latestDate = candidates[candidates.length - 1];
    homeworkItems[latestDate].push({ 
      id: task.id, 
      name: task.name, 
      subject: task.subject, 
      dueDate: task.due_date, 
      minutes: task.estimated_minutes 
    });
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
  const days: DayPlan[] = revisionPlan.days.map(rDay => {
    const date = rDay.date;
    const weeklyMins = weeklyItems[date].reduce((s, i) => s + i.minutes, 0);
    const hwMins = homeworkItems[date].reduce((s, i) => s + i.minutes, 0);
    const totalUsed = weeklyMins + hwMins + rDay.usedMinutes;

    return {
      date,
      baseCapacity: baseCapMap[date],
      weekly: { minutes: weeklyMins, items: weeklyItems[date] },
      homework: { minutes: hwMins, items: homeworkItems[date] },
      revision: { minutes: rDay.usedMinutes, slots: rDay.slots },
      projects: { minutes: 0, items: [] }, // Simplified for now
      totalUsed,
      spare: Math.max(0, baseCapMap[date] - totalUsed)
    };
  });

  return { days };
}