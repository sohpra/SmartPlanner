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

  const isCurrentlyDoneBonus = isDoneToday && (!dbScheduledDate || dbScheduledDate > today);

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
    isBonus: isCurrentlyDoneBonus // previously >>> isDoneToday && dbScheduledDate && dbScheduledDate > today 
  };

  // --- CASE A: Task is already done today ---
  if (isDoneToday) {
    homeworkItems[today].push(mapped);
    occupiedCap[today] += task.estimated_minutes;
    continue; // Move to next task
  }

  // --- CASE B: Task has a Database Anchor (Fixed or Saved) ---
  if (dbScheduledDate && homeworkItems[dbScheduledDate]) {
    // 🎯 THE OVERACHIEVER LOGIC: A bonus is something done TODAY that was meant for the FUTURE
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
      isBonus: isBonus // 🚀 This is the critical flag for the X/0 calculation
    };

    // If it's a bonus, we move it to Today's view, but because isBonus is true, 
    // it won't be counted in Today's 'plannedTaskCount'.
    if (isBonus) {
      homeworkItems[today].push(mapped);
      occupiedCap[today] += task.estimated_minutes;
    } else {
      // If it's not a bonus, keep it on its scheduled date (Today or Future)
      homeworkItems[dbScheduledDate].push(mapped);
      occupiedCap[dbScheduledDate] += (task.estimated_minutes || 0);
    }
    
    continue; // Move to next task
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
    // 🎯 If it lands on today via simulation, it's a bonus ONLY if it's over capacity
    // or if capacity is 0 (Rest Day)
    const wouldFitTodayNormally = (occupiedCap[today] + task.estimated_minutes + 45 <= baseCapMap[today]);
    
    // Apply the bonus flag to the object we are about to push
    const finalMapped = {
      ...mapped,
      isBonus: mapped.isBonus || (placedDate === today && !dbScheduledDate && !wouldFitTodayNormally)
    };

    homeworkItems[placedDate].push(finalMapped);
    occupiedCap[placedDate] += task.estimated_minutes;
  }
}

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


// --- 6. PROJECTS (Lower Priority than Revision) ---
const projectItems: Record<string, any[]> = {};
windowDates.forEach(d => projectItems[d] = []);

const projectProgress: Record<string, number> = {};
(projects || []).forEach((p: any) => {
  projectProgress[p.id] = p.completed_minutes || 0;
});

windowDates.forEach(d => {
  const currentCapacity = baseCapMap[d];
  const usedSoFar = occupiedCap[d] || 0;
  let spareForProjects = currentCapacity - usedSoFar;

  // 🎯 THE CEILING: Maximum time allowed for ALL projects today
  let totalProjectMinutesAllocatedToday = 0;
  const DAILY_PROJECT_CEILING = 120; 

  if (spareForProjects > 15) {
    // Sort by due date so we tackle the most urgent projects first
    const sortedProjects = [...projects].sort((a: any, b: any) => 
      daysBetween(d, a.due_date) - daysBetween(d, b.due_date)
    );

    for (const project of sortedProjects) {

      if (project.status === 'completed' && !todayCompletionKeys.has(`project:${project.id}`)) {
      continue; 
  }
      // Add this right after the 'for (const project of sortedProjects)' loop starts
      const isDoneToday = todayCompletionKeys.has(`project:${project.id}`);

      // 🎯 SAFETY: If it's already done today, we MUST show it in the checklist
      // even if there was technically no "spare" capacity (e.g. on a Rest Day)
      if (isDoneToday && d === today) {
        // Check if we've already added it via the allocator
        const existing = projectItems[d].find(p => p.projectId === project.id);
        if (!existing) {
          projectItems[d].push({
            id: project.id,
            name: `Project: ${project.name}`,
            subject: project.subject || "Project",
            minutes: 60, // Default display for manual logs
            isDone: true,
            type: 'project',
            projectId: project.id,
            isBonus: true // It's a bonus because it wasn't planned by the allocator
          });
          // Still track the progress so the simulation stays accurate
          projectProgress[project.id] += 60;
          continue; // Move to next project
        }
      }
      // Stop if we hit the 120m daily ceiling OR run out of day capacity
      if (totalProjectMinutesAllocatedToday >= DAILY_PROJECT_CEILING) break;
      if (spareForProjects <= 15) break;

      const daysLeft = daysBetween(d, project.due_date);
      const remainingMinutes = project.estimated_minutes - projectProgress[project.id];

      if (remainingMinutes > 0 && daysLeft >= 0) {
        // 🎯 URGENCY LOGIC: 90m if due in 5 days, otherwise 60m
        const maxSessionForThisProject = daysLeft <= 5 ? 90 : 60;

        // 🎯 ALLOCATION: Take as much as possible up to the session cap and daily ceiling
        const allocation = Math.min(
          remainingMinutes,
          spareForProjects,
          maxSessionForThisProject,
          (DAILY_PROJECT_CEILING - totalProjectMinutesAllocatedToday)
        );

        if (allocation >= 15) {
          const isDoneToday = todayCompletionKeys.has(`project:${project.id}`);

          projectItems[d].push({
            id: project.id,
            name: `Project: ${project.name}`,
            subject: project.subject || "Project",
            minutes: allocation,
            isDone: isDoneToday && d === today,
            type: 'project',
            projectId: project.id,
            isBonus: d === today && (baseCapMap[d] === 0 || spareForProjects < allocation)
          });

          // Update counters
          spareForProjects -= allocation;
          occupiedCap[d] += allocation;
          totalProjectMinutesAllocatedToday += allocation;
          projectProgress[project.id] += allocation;
        }
      }
    }
  }
});

// 7. FINAL ASSEMBLY 

const days: DayPlan[] = windowDates.map((d: string) => {
  const wk = weeklyItems[d] || [];
  const hw = homeworkItems[d] || [];
  const rv = revisionItems[d] || [];
  const pj = projectItems[d] || []; 
  const allItems = [...wk, ...hw, ...rv, ...pj];
  
  // 🎯 1. PLANNED MINUTES (The Target)
  // We exclude bonuses so the target doesn't move when you do extra work.
  const dayTotalPlannedMinutes = allItems
    .filter(i => !i.isBonus) 
    .reduce((sum, i) => sum + (i.minutes || 0), 0);

  // 🎯 2. ACTUAL MINUTES (The Progress)
  const dayTotalDoneMinutes = allItems
    .filter(i => i.isDone)
    .reduce((sum, i) => sum + (i.minutes || 0), 0);

  // 🎯 3. TASK COUNTS (The "Stability" Fix)
  // Completed is easy: count everything checked.
  const completedCount = allItems.filter(i => i.isDone).length;

  // Planned must be: 
  // (Items meant for today that aren't done) + (Items meant for today that ARE done)
  const plannedCount = allItems.filter(i => {
    // If it's a bonus, it was NEVER planned for today.
    if (i.isBonus) return false;
    
    // If it's scheduled for today (or simulated for today), it IS planned.
    return true; 
  }).length;

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
    projects: { 
      minutes: pj.reduce((s, i) => s + (i.minutes || 0), 0), 
      items: pj 
    }, 
    
    totalPlanned: dayTotalPlannedMinutes, 
    totalCompleted: dayTotalDoneMinutes,
    plannedTaskCount: plannedCount,   
    completedTaskCount: completedCount, 
    spare: Math.max(0, baseCapMap[d] - dayTotalPlannedMinutes)
  };
});

  return { days };
}