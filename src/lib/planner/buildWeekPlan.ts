import { addDays, daysBetween } from "./revisionEngine";

export type DayPlan = {
  date: string;
  weekly: { minutes: number; items: any[] };
  homework: { minutes: number; actualCompletedMinutes: number; items: any[] };
  revision: { minutes: number; items: any[] };
  projects: { minutes: number; items: any[] };
  baseCapacity: number;
  totalPlanned: number;   
  totalCompleted: number; 
  plannedTaskCount: number;   
  completedTaskCount: number; 
  spare: number;
};

export type WeekPlan = { days: DayPlan[] };

// ... (imports and types same as your snippet)

export function buildWeekPlan({
  today,
  numDays = 30,
  weeklyTasks,
  deadlines,
  exams,
  projects,
  completions = [],
  capacityData,
  revisionSlots = [],
}: any): WeekPlan {
  const windowDates = Array.from({ length: numDays }, (_, i) => addDays(today, i));
  
  // 1. HARMONIZE IDs
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

// 4. HOMEWORK (Earliest Best Fit + Stability shiled + N-1 Deadline Guard)
  const homeworkItems: Record<string, any[]> = {};
  const occupiedCap: Record<string, number> = {};
  windowDates.forEach(d => {
    homeworkItems[d] = [];
    occupiedCap[d] = (weeklyItems[d] || []).reduce((sum: number, i: any) => sum + (i.minutes || 0), 0);
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
      minutes: task.estimated_minutes, 
      dueDate: task.due_date,
      isDone: isDoneToday,
      type: 'deadline_task',
      isBonus: false 
    };

    if (isDoneToday) {
      homeworkItems[today].push(mapped);
      occupiedCap[today] += task.estimated_minutes;
      continue;
    }

    // 🎯 THE "N-1" WINDOW
    const dayBeforeDeadline = addDays(task.due_date, -1);
    const possibleDays = windowDates.filter(date => date >= today && date <= dayBeforeDeadline);
    let placedDate: string | null = null;

    // PASS 1: Best Fit (The "Polite" Search)
    for (const d of possibleDays) {
      const buffer = 45;
      if (occupiedCap[d] + task.estimated_minutes + buffer <= baseCapMap[d]) {
        placedDate = d;
        break;
      }
    }

    // PASS 2: Emergency Fit (The "Strict" Search)
    if (!placedDate) {
      for (const d of possibleDays) {
        if (occupiedCap[d] + task.estimated_minutes <= baseCapMap[d]) {
          placedDate = d;
          break;
        }
      }
    }

    // PASS 3: Guarantee (The "Last Minute" Force)
    if (!placedDate) {
      // If due tomorrow, it stays today. If due later, it forces onto day-before.
      placedDate = possibleDays.length > 0 ? dayBeforeDeadline : today;
    }

    if (placedDate && homeworkItems[placedDate]) {
      // Bonus logic based on the "Pass 1" ideal
      const wouldFitTodayNormally = (occupiedCap[today] + task.estimated_minutes + 45 <= baseCapMap[today]);
      mapped.isBonus = (placedDate === today && !wouldFitTodayNormally);
      
      homeworkItems[placedDate].push(mapped);
      occupiedCap[placedDate] += task.estimated_minutes;
    }
  }

// --- 5. REVISION (The Iron-Clad Unified Architect) ---
const revisionItems: Record<string, any[]> = {};
windowDates.forEach(d => revisionItems[d] = []);

const allSlots = (revisionSlots || []) as any[];

// Separating the "Done" from "Pending" using your completion keys
const doneSlots = allSlots.filter(s => todayCompletionKeys.has(`revision:${s.id}`) || s.is_completed);
const pendingSlots = allSlots.filter(s => !todayCompletionKeys.has(`revision:${s.id}`) && !s.is_completed);

// --- STEP 1: Process Done Items (The Hydra Guard) ---
doneSlots.forEach(s => {
  // Completed items are visually pinned to "Today" regardless of original assigned date
  if (revisionItems[today]) {
    const mins = s.duration_minutes || s.slotMinutes || 30;
    revisionItems[today].push({ 
      ...s, 
      id: s.id,
      name: s.label || s.description || s.displayName || "Revision",
      subject: s.subject || "Revision",
      type: 'revision', 
      isDone: true, 
      minutes: mins 
    });
    // Record capacity so the progress bar reflects work done
    occupiedCap[today] += mins;
  }
});

// --- STEP 2: Place Pending Slots (Trust the Database) ---
// We no longer "calculate" eligibility. If the Engine put it on a date, we show it there.
pendingSlots.forEach(slot => {
  // Normalize the date from ISO or DB string to YYYY-MM-DD
  const assignedDate = slot.date ? String(slot.date).split('T')[0] : null;

  // Only render if the date falls within our current 60-day window
  if (assignedDate && revisionItems[assignedDate]) {
    const mins = slot.slotMinutes || slot.duration_minutes || 30;
    
    revisionItems[assignedDate].push({
      id: slot.id,
      // 'name' is what the WeeklyView/DayColumn looks for
      name: slot.label || slot.displayName || slot.description || "Revision",
      subject: slot.subject || (slot.exam ? slot.exam.subject : "Revision"),
      minutes: mins,
      isDone: false,
      type: 'revision',
      examId: slot.exam_id
    });
    
    // Increment the capacity tracker for that specific day
    occupiedCap[assignedDate] += mins;
  }
});

// --- STEP 3: Cleanup / Sorting ---
// Optional: Sort each day so "FINAL" blocks or larger blocks appear at the top
windowDates.forEach(d => {
  if (revisionItems[d]) {
    revisionItems[d].sort((a, b) => {
      // Put "Done" at the bottom
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      // Put "FINAL" blocks at the top
      const aFinal = a.name.includes("FINAL") ? 1 : 0;
      const bFinal = b.name.includes("FINAL") ? 1 : 0;
      return bFinal - aFinal;
    });
  }
});

// 6. FINAL ASSEMBLY (Stable Progress Logic)
const days: DayPlan[] = windowDates.map((d: string) => {
  const isToday = d === today;
  const wk = weeklyItems[d] || [];
  const hw = homeworkItems[d] || [];
  const rv = revisionItems[d] || [];
  const allItems = [...wk, ...hw, ...rv];
  
  // 🎯 1. STABLE TARGET (The Denominator)
  // We only count items that were ACTUALLY scheduled for this day.
  // We exclude any item marked 'isBonus'.
  const dayTotalPlannedMinutes = occupiedCap[d] || 0;

  // 🎯 2. ACTUAL PROGRESS (The Numerator)
  // We count EVERYTHING that is checked off.
  const dayTotalDoneMinutes = [...wk, ...hw, ...rv]
    .filter(i => i.isDone)
    .reduce((sum, i) => sum + (i.minutes || 0), 0);

  // 🎯 3. TASK COUNTS (e.g. 6 / 5)
  const totalCount = wk.length + hw.length + rv.length;
  const completedCount = [...wk, ...hw, ...rv].filter(i => i.isDone).length;

  return {
    date: d,
    baseCapacity: baseCapMap[d],
    weekly: { minutes: wk.reduce((s, i) => s + (i.minutes || 0), 0), items: wk },
    homework: { 
      minutes: hw.reduce((s, i) => s + (i.minutes || 0), 0), 
      actualCompletedMinutes: hw.filter(i => i.isDone).reduce((s, i) => s + (i.minutes || 0), 0), 
      items: hw 
    },
    revision: { minutes: rv.reduce((s, i) => s + (i.minutes || 0), 0), items: rv },
    projects: { minutes: 0, items: [] },
    
    totalPlanned: dayTotalPlannedMinutes, 
    totalCompleted: dayTotalDoneMinutes,
    plannedTaskCount: totalCount,   
    completedTaskCount: completedCount,
    // Spare now correctly shows negative if the new task caused an overload
    spare: Math.max(0, baseCapMap[d] - dayTotalPlannedMinutes) 
  };
});

  return { days };
}