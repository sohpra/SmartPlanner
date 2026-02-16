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
  
  // 1. HARMONIZE IDs & COMPLETIONS
  const todayCompletionKeys = new Set<string>();
  const historicalIds = new Set<string>();
  
  (completions || []).forEach((c: any) => {
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

  // 4. HOMEWORK (Section with Stability Fix)
  const homeworkItems: Record<string, any[]> = {};
  const occupiedCap: Record<string, number> = {};
  windowDates.forEach(d => {
    homeworkItems[d] = [];
    occupiedCap[d] = (weeklyItems[d] || []).reduce((sum, i) => sum + (i.minutes || 0), 0);
  });

  const sortedHw = [...(deadlines || [])].sort((a: any, b: any) => {
    if (a.is_fixed !== b.is_fixed) return a.is_fixed ? -1 : 1;
    return daysBetween(today, a.due_date) - daysBetween(today, b.due_date);
  });

  for (const task of sortedHw) {
    const isDoneToday = todayCompletionKeys.has(`deadline_task:${task.id}`);
    const isDoneHistory = historicalIds.has(task.id) || (task.status === 'completed' && !isDoneToday);
    if (isDoneHistory) continue;

    let dbScheduledDate = task.scheduled_date ? String(task.scheduled_date).split('T')[0] : null;
    const mappedBase = { 
      id: task.id, 
      name: task.name, 
      minutes: task.estimated_minutes, 
      dueDate: task.due_date,
      isDone: isDoneToday,
      subject: task.subject_name || task.subject || "",
      type: 'deadline_task',
      is_fixed: task.is_fixed,
      scheduledDate: dbScheduledDate,
      isBonus: false 
    };

    if (dbScheduledDate && homeworkItems[dbScheduledDate]) {
      const isBonus = isDoneToday && dbScheduledDate > today;
      const targetDate = isBonus ? today : dbScheduledDate;
      
      homeworkItems[targetDate].push({ ...mappedBase, isBonus });
      occupiedCap[targetDate] += task.estimated_minutes;
      continue;
    }

    // Simulation
    // --- CASE C: Simulation ---
    let placedDate: string | null = null;
    const dayBeforeDeadline = addDays(task.due_date, -1);
    
    // 🎯 1. MISSION LOCK: If today is secured, we start our search from TOMORROW
    const todayIsSecured = (todayCompletionKeys.size >= (homeworkItems[today]?.length || 0));
    const searchStartDate = (todayIsSecured && windowDates[1]) ? windowDates[1] : today;

    const possibleDays = windowDates.filter(date => 
      date >= searchStartDate && date <= dayBeforeDeadline
    );

    // Pass 1: Polite Search
    for (const d of possibleDays) {
      if (occupiedCap[d] + task.estimated_minutes + 45 <= baseCapMap[d]) {
        placedDate = d; break;
      }
    }

    // Pass 2: Emergency Search
    if (!placedDate) {
      for (const d of possibleDays) {
        if (occupiedCap[d] + task.estimated_minutes <= baseCapMap[d]) {
          placedDate = d; break;
        }
      }
    }

    // Pass 3: The "Last Resort" 
    if (!placedDate) {
      // If we couldn't find a spot in the restricted window, 
      // default to the day before deadline (as long as that's not 'today' while secured)
      placedDate = possibleDays.length > 0 ? dayBeforeDeadline : searchStartDate;
    }

    // Final Placement
    if (placedDate && homeworkItems[placedDate]) {
      const isBonus = placedDate === today && baseCapMap[today] === 0;
      homeworkItems[placedDate].push({ ...mappedBase, isBonus });
      occupiedCap[placedDate] += task.estimated_minutes;
    }
  }

  // 5. REVISION (Date-Normalization Fix)
  const revisionItems: Record<string, any[]> = {};
  windowDates.forEach(d => revisionItems[d] = []);

  const allSlots = (revisionSlots || []) as any[];
  const isSlotDone = (s: any) => s.is_completed === true || todayCompletionKeys.has(`revision:${s.id}`);

  const doneSlots = allSlots.filter(s => isSlotDone(s));
  const pendingSlots = allSlots.filter(s => !isSlotDone(s));

  doneSlots.forEach(s => {
    if (revisionItems[today]) {
      const mins = s.duration_minutes || s.slotMinutes || 30;
      const scheduledDate = s.date ? String(s.date).split('T')[0] : null;
      const isBonus = scheduledDate !== null && scheduledDate > today;

      revisionItems[today].push({ 
        ...s, id: s.id, type: 'revision', isDone: true, minutes: mins, isBonus,
        name: s.label || s.displayName || "Revision",
        subject: s.subject || "Revision"
      });
      if (!isBonus) occupiedCap[today] += mins;
    }
  });

  pendingSlots.forEach(slot => {
    const assignedDate = slot.date ? String(slot.date).split('T')[0] : null;
    if (assignedDate && assignedDate >= today && revisionItems[assignedDate]) {
      const mins = slot.slotMinutes || slot.duration_minutes || 30;
      revisionItems[assignedDate].push({
        id: slot.id, type: 'revision', isDone: false, minutes: mins, isBonus: false,
        name: slot.label || slot.displayName || "Revision",
        subject: slot.subject || "Revision",
        examId: slot.exam_id
      });
      occupiedCap[assignedDate] += mins;
    }
  });

  // 6. PROJECTS (120m Ceiling & Intent Fix)
  const projectItems: Record<string, any[]> = {};
  windowDates.forEach(d => projectItems[d] = []);

  const projectProgress: Record<string, number> = {};
  (projects || []).forEach((p: any) => projectProgress[p.id] = p.completed_minutes || 0);

  windowDates.forEach(d => {
    const DAILY_PROJECT_CEILING = 120;
    let totalProjectMinsToday = 0;
    let spareForProjects = baseCapMap[d] - occupiedCap[d];

    const sortedProjects = [...(projects || [])].sort((a, b) => daysBetween(d, a.due_date) - daysBetween(d, b.due_date));

    for (const project of sortedProjects) {
      if (project.status === 'completed' && !todayCompletionKeys.has(`project:${project.id}`)) continue;

      const isDoneToday = todayCompletionKeys.has(`project:${project.id}`);
      const remainingMinutes = project.estimated_minutes - projectProgress[project.id];
      const daysLeft = daysBetween(d, project.due_date);

      // 🎯 INTENT ANCHOR: If done today, treat as planned for today.
      const wasPlannedForToday = (d === today && isDoneToday) || (remainingMinutes > 0 && daysLeft >= 0);

      if (wasPlannedForToday) {
        if (totalProjectMinsToday >= DAILY_PROJECT_CEILING && !isDoneToday) break;
        if (spareForProjects <= 15 && !isDoneToday) break;

        const maxSession = daysLeft <= 5 ? 90 : 60;
        let allocation = isDoneToday && d === today ? 60 : Math.min(remainingMinutes, spareForProjects, maxSession, (DAILY_PROJECT_CEILING - totalProjectMinsToday));

        if (allocation >= 15 || (isDoneToday && d === today)) {
          const isBonus = d === today && baseCapMap[d] === 0;
          projectItems[d].push({
            id: project.id, projectId: project.id, type: 'project', isDone: isDoneToday && d === today,
            minutes: allocation, isBonus, name: `Project: ${project.name}`, subject: project.subject || "Project"
          });

          if (!isBonus) {
            spareForProjects -= allocation;
            occupiedCap[d] += allocation;
            totalProjectMinsToday += allocation;
          }
          projectProgress[project.id] += allocation;
        }
      }
    }
  });

  // 7. FINAL ASSEMBLY
  const days: DayPlan[] = windowDates.map((d: string) => {
    const allItems = [...(weeklyItems[d] || []), ...(homeworkItems[d] || []), ...(revisionItems[d] || []), ...(projectItems[d] || [])];
    
    const dayTotalPlannedMinutes = allItems.filter(i => !i.isBonus).reduce((sum, i) => sum + (i.minutes || 0), 0);
    const dayTotalDoneMinutes = allItems.filter(i => i.isDone).reduce((sum, i) => sum + (i.minutes || 0), 0);
    const plannedCount = allItems.filter(i => !i.isBonus).length;
    const completedCount = allItems.filter(i => i.isDone).length;

    return {
      date: d,
      baseCapacity: baseCapMap[d],
      weekly: { minutes: (weeklyItems[d] || []).reduce((s, i) => s + (i.minutes || 0), 0), items: weeklyItems[d] || [] },
      homework: { minutes: (homeworkItems[d] || []).reduce((s, i) => s + (i.minutes || 0), 0), actualCompletedMinutes: (homeworkItems[d] || []).filter(i => i.isDone).reduce((s, i) => s + (i.minutes || 0), 0), items: homeworkItems[d] || [] },
      revision: { minutes: (revisionItems[d] || []).reduce((s, i) => s + (i.minutes || 0), 0), items: revisionItems[d] || [] },
      projects: { minutes: (projectItems[d] || []).reduce((s, i) => s + (i.minutes || 0), 0), items: projectItems[d] || [] },
      totalPlanned: dayTotalPlannedMinutes, 
      totalCompleted: dayTotalDoneMinutes,
      plannedTaskCount: plannedCount,   
      completedTaskCount: completedCount, 
      spare: Math.max(0, baseCapMap[d] - dayTotalPlannedMinutes)
    };
  });

  return { days };
}