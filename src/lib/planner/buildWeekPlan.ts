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

  // 4. HOMEWORK
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
      isBonus: isDoneToday && task.due_date > today 
    };

    // Hold the seat for today's completed homework to prevent Hydra
    if (isDoneToday) {
      homeworkItems[today].push(mapped);
      occupiedCap[today] += task.estimated_minutes;
      continue;
    }

    for (const d of windowDates.filter(date => date <= task.due_date)) {
      if (occupiedCap[d] + task.estimated_minutes <= baseCapMap[d]) {
        homeworkItems[d].push(mapped);
        occupiedCap[d] += task.estimated_minutes;
        break;
      }
    }
  }

// 5. REVISION (The Iron-Clad Unified Architect)
const revisionItems: Record<string, any[]> = {};
windowDates.forEach(d => revisionItems[d] = []);

const allSlots = (revisionSlots || []) as any[];

const doneSlots = allSlots.filter(s => todayCompletionKeys.has(`revision:${s.id}`));
const pendingSlots = allSlots.filter(s => !todayCompletionKeys.has(`revision:${s.id}`));

// --- STEP 1: Process Done Items ONCE (The Hydra Guard) ---
doneSlots.forEach(s => {
  if (revisionItems[today]) {
    const mins = s.duration_minutes || 60;
    revisionItems[today].push({ 
      ...s, 
      name: s.displayName || s.description || "Revision",
      type: 'revision', 
      isDone: true, 
      minutes: mins 
    });
    occupiedCap[today] += mins; // This holds the seat and stops the Hydra
  }
});

const bigBlocks = pendingSlots.filter(s => 
  (s.duration_minutes || 0) >= 120 || 
  (s.displayName || "").includes("FINAL")
);

const drillSlots = pendingSlots.filter(s => 
  (s.duration_minutes || 0) < 120 && 
  !(s.displayName || "").includes("FINAL")
);

// --- STEP 2: Place Big Blocks (Exam Eve Anchor) ---
bigBlocks.forEach(slot => {
  const rawExamDate = slot.exam?.date || slot.date;
  const examDate = rawExamDate ? String(rawExamDate).split('T')[0] : null;
  const eligibleDates = windowDates.filter(d => !examDate || d < examDate);
  if (eligibleDates.length === 0) return;

  const examEve = eligibleDates[eligibleDates.length - 1];
  const mins = slot.duration_minutes || 120;
  
  revisionItems[examEve].push({
    id: slot.id,
    name: slot.displayName || "Final Prep",
    subject: slot.subject || slot.exam?.subject || "Revision",
    minutes: mins,
    isDone: false,
    type: 'revision'
  });
  occupiedCap[examEve] += mins;
});

// --- STEP 3: Place Drill Slots (Aggressive Fill with Capacity Guard) ---
drillSlots.forEach(slot => {
  const rawExamDate = slot.exam?.date || slot.date;
  const examDate = rawExamDate ? String(rawExamDate).split('T')[0] : null;
  const eligibleDates = windowDates.filter(d => !examDate || d < examDate);
  const mins = slot.duration_minutes || 60;

  let placed = false;
  for (const d of eligibleDates) {
    const isToday = d === today;
    const maxDrills = 3;
    const currentRevCount = revisionItems[d].length;

    // Check capacity and respect the 3-drill limit for Today
    if (occupiedCap[d] + mins <= baseCapMap[d] && (!isToday || currentRevCount < maxDrills)) {
      revisionItems[d].push({
        id: slot.id,
        name: slot.displayName || "Revision",
        subject: slot.subject || slot.exam?.subject || "Revision",
        minutes: mins,
        isDone: false,
        type: 'revision'
      });
      occupiedCap[d] += mins;
      placed = true;
      break;
    }
  }

  // --- STEP 4: Overload Fallback (Force to Wednesday/Exam Eve) ---
  if (!placed && eligibleDates.length > 0) {
    const examEve = eligibleDates[eligibleDates.length - 1];
    revisionItems[examEve].push({
      id: slot.id,
      name: slot.displayName || slot.description || "Revision",
      subject: slot.subject || slot.exam?.subject || "General",
      minutes: mins,
      isDone: false,
      type: 'revision'
    });
    occupiedCap[examEve] += mins;
  }
});

// 6. FINAL ASSEMBLY (Stable Progress Logic)
const days: DayPlan[] = windowDates.map((d: string) => {
  const wk = weeklyItems[d] || [];
  const hw = homeworkItems[d] || [];
  const rv = revisionItems[d] || [];
  const allItems = [...wk, ...hw, ...rv];
  
  const dayTotalPlannedMinutes = allItems.reduce((sum, i) => sum + (i.minutes || 0), 0);
  const dayTotalDoneMinutes = allItems.filter(i => i.isDone).reduce((sum, i) => sum + (i.minutes || 0), 0);

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
    plannedTaskCount: allItems.length,   
    completedTaskCount: allItems.filter(i => i.isDone).length,
    spare: Math.max(0, baseCapMap[d] - dayTotalPlannedMinutes)
  };
});

  return { days };
}