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
// --- 4. HOMEWORK (Persistent Anchors + Fixed Date Support) ---
const homeworkItems: Record<string, any[]> = {};
const occupiedCap: Record<string, number> = {};
windowDates.forEach(d => {
  homeworkItems[d] = [];
  occupiedCap[d] = (weeklyItems[d] || []).reduce((sum: number, i: any) => sum + (i.minutes || 0), 0);
});

// Sort by fixed status first, then by deadline
const sortedHw = [...(deadlines || [])].sort((a: any, b: any) => {
  if (a.is_fixed !== b.is_fixed) return a.is_fixed ? -1 : 1;
  return daysBetween(today, a.due_date) - daysBetween(today, b.due_date);
});

for (const task of sortedHw) {
  const isDoneToday = todayCompletionKeys.has(`deadline_task:${task.id}`);
  const isDoneHistory = historicalIds.has(task.id) || (task.status === 'completed' && !isDoneToday);
  if (isDoneHistory) continue;

  // 🎯 THE STABILITY ANCHOR
  let dbScheduledDate = task.scheduled_date ? String(task.scheduled_date).split('T')[0] : null;

  const mapped = { 
    id: task.id, 
    name: task.name, 
    minutes: task.estimated_minutes, 
    dueDate: task.due_date,
    isDone: isDoneToday,
    subject: task.subject_name || task.subject || "",
    type: 'deadline_task',
    is_fixed: task.is_fixed,
    scheduledDate: dbScheduledDate,
    // Bonus logic: Done today but was meant for the future
    isBonus: isDoneToday && dbScheduledDate && dbScheduledDate > today 
  };

  // --- CASE A: Task is already done today ---
  if (isDoneToday) {
    homeworkItems[today].push(mapped);
    occupiedCap[today] += task.estimated_minutes;
    continue; // Move to next task
  }

  // --- CASE B: Task has a Database Anchor (Fixed or Saved) ---
  if (dbScheduledDate && homeworkItems[dbScheduledDate]) {
    // 🎯 THE OVERACHIEVER LOGIC
    // 1. It is ONLY a bonus if it's being completed TODAY 
    //    and was scheduled for a FUTURE date.
    const isBonus = isDoneToday && dbScheduledDate > today;

    const mapped = { 
      id: task.id, 
      name: task.name, 
      minutes: task.estimated_minutes, 
      dueDate: task.due_date,
      isDone: isDoneToday,
      subject: task.subject_name || task.subject || "",
      type: 'deadline_task',
      is_fixed: task.is_fixed,
      scheduledDate: dbScheduledDate,
      isBonus: isBonus // 👈 This is the trigger for the 4/3 math
    };

    // 2. If it's a bonus (done early), we physically move the item 
    //    to TODAY's list so the user sees their progress.
    if (isBonus) {
      homeworkItems[today].push(mapped);
      occupiedCap[today] += task.estimated_minutes;
    } else {
      // Otherwise, put it exactly where the DB says
      homeworkItems[dbScheduledDate].push(mapped);
      occupiedCap[dbScheduledDate] += task.estimated_minutes;
    }
    
    continue; // 🛑 Hard stop! Case B is handled.
  }

  // --- CASE C: Simulation (Only runs for tasks with NO scheduled_date) ---
  let placedDate: string | null = null;
  const dayBeforeDeadline = addDays(task.due_date, -1);
  const possibleDays = windowDates.filter(date => date >= today && date <= dayBeforeDeadline);

  // Pass 1: Polite Search (45m buffer)
  for (const d of possibleDays) {
    if (occupiedCap[d] + task.estimated_minutes + 45 <= baseCapMap[d]) {
      placedDate = d;
      break;
    }
  }

  // Pass 2: Emergency Search (Strict)
  if (!placedDate) {
    for (const d of possibleDays) {
      if (occupiedCap[d] + task.estimated_minutes <= baseCapMap[d]) {
        placedDate = d;
        break;
      }
    }
  }

  // Pass 3: Force (Last Resort)
  if (!placedDate) {
    placedDate = possibleDays.length > 0 ? dayBeforeDeadline : today;
  }

  // Final Placement for simulated tasks
  if (placedDate && homeworkItems[placedDate]) {
    const wouldFitTodayNormally = (occupiedCap[today] + task.estimated_minutes + 45 <= baseCapMap[today]);
    if (placedDate === today && !dbScheduledDate && !wouldFitTodayNormally) {
        mapped.isBonus = true;
    }

    homeworkItems[placedDate].push(mapped);
    occupiedCap[placedDate] += task.estimated_minutes;
  }
}

// --- 5. REVISION (The Iron-Clad Unified Architect) ---
// --- 5. REVISION (The Iron-Clad Unified Architect) ---
const revisionItems: Record<string, any[]> = {};
windowDates.forEach(d => revisionItems[d] = []);

const allSlots = (revisionSlots || []) as any[];

// 🎯 THE FIX: Use a consistent key to filter out completed items
const isSlotDone = (s: any) => 
  s.is_completed === true || 
  todayCompletionKeys.has(`revision:${s.id}`) || 
  todayCompletionKeys.has(s.id);

const doneSlots = allSlots.filter(s => isSlotDone(s));
const pendingSlots = allSlots.filter(s => !isSlotDone(s));

// --- STEP 1: Process Done Items (Pin to Today) ---
doneSlots.forEach(s => {
  if (revisionItems[today]) {
    const mins = s.duration_minutes || s.slotMinutes || 30;
    revisionItems[today].push({ 
      ...s, 
      id: s.id,
      name: s.label || s.description || s.displayName || "Revision",
      subject: s.subject || "Revision",
      type: 'revision', 
      isDone: true, 
      minutes: mins,
      isBonus: s.date > today // Typically, revision isn't a "bonus" in the same way HW is
    });
    occupiedCap[today] += mins;
  }
});

// --- STEP 2: Place Pending Slots (Strict DB Obedience) ---
pendingSlots.forEach(slot => {
  const assignedDate = slot.date ? String(slot.date).split('T')[0] : null;

  // 🎯 SAFETY CHECK: Ensure we don't show pending slots from the past
  if (assignedDate && assignedDate >= today && revisionItems[assignedDate]) {
    const mins = slot.slotMinutes || slot.duration_minutes || 30;
    
    revisionItems[assignedDate].push({
      id: slot.id,
      name: slot.label || slot.displayName || slot.description || "Revision",
      subject: slot.subject || "Revision",
      minutes: mins,
      isDone: false,
      type: 'revision',
      examId: slot.exam_id
    });
    
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
// 6. FINAL ASSEMBLY (The "6/5" Overachiever Logic)
const days: DayPlan[] = windowDates.map((d: string) => {
  const wk = weeklyItems[d] || [];
  const hw = homeworkItems[d] || [];
  const rv = revisionItems[d] || [];
  const allItems = [...wk, ...hw, ...rv];
  
  // 🎯 1. PLANNED MINUTES (The Target)
  // We exclude bonuses so the target doesn't move when you do extra work.
  const dayTotalPlannedMinutes = allItems
    .filter(i => !i.isBonus) 
    .reduce((sum, i) => sum + (i.minutes || 0), 0);

  // 🎯 2. ACTUAL MINUTES (The Progress)
  const dayTotalDoneMinutes = allItems
    .filter(i => i.isDone)
    .reduce((sum, i) => sum + (i.minutes || 0), 0);

  // 🎯 3. TASK COUNTS (The "6/5" Logic)
  // completedCount: Counts EVERY item that is done.
  const completedCount = allItems.filter(i => i.isDone).length;
  
  // plannedCount: Only counts items that were meant for today.
  const plannedCount = allItems.filter(i => !i.isBonus).length;

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
    plannedTaskCount: plannedCount,   // This becomes the '5'
    completedTaskCount: completedCount, // This becomes the '6'
    spare: Math.max(0, baseCapMap[d] - dayTotalPlannedMinutes)
  };
});

  return { days };
}