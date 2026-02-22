// ─────────────────────────────────────────────────────────────────────────────
// buildWeekPlan.ts
//
// Changes from original:
//   - Homework placement delegated to shared scheduleHomework() — no duplication
//   - todayIsSecured calculation fixed (was comparing apples to oranges)
//   - isBonus logic centralised into a single helper
//   - slot_type and is_fixed passed through to revision PlanItems so the UI
//     can render practice papers differently from standard sessions
//   - Dead comment blocks removed
//   - Types imported from shared types.ts
// ─────────────────────────────────────────────────────────────────────────────

import { addDays, daysBetween, buildDateWindow, toDateOnly } from "./dateUtils";
import { scheduleHomework } from "./homeworkScheduler";
import type {
  DayPlan,
  WeekPlan,
  PlanItem,
  HomeworkTask,
} from "./types";

// ─── isBonus helper ───────────────────────────────────────────────────────────

/**
 * An item is a bonus when the day it lands on has zero base capacity
 * (holiday / day off) — meaning anything done is above and beyond.
 */
function isItemBonus(itemDate: string, today: string, baseCapMap: Record<string, number>): boolean {
  return itemDate === today && (baseCapMap[today] ?? 0) === 0;
}

// ─── Main function ────────────────────────────────────────────────────────────

export function buildWeekPlan({
  today,
  numDays = 30,
  weeklyTasks,
  deadlines,
  projects,
  completions = [],
  capacityData,
  revisionSlots = [],
}: any): WeekPlan {
  const windowDates = buildDateWindow(today, numDays);

  // ── 1. COMPLETION KEYS ──────────────────────────────────────────────────────
  const todayCompletionKeys = new Set<string>();
  const historicalIds = new Set<string>();

  (completions as any[]).forEach((c) => {
    const key = `${c.source_type}:${c.source_id}`;
    if (c.date === today) {
      todayCompletionKeys.add(key);
      todayCompletionKeys.add(c.source_id);
    } else if (c.date < today) {
      historicalIds.add(c.source_id);
    }
  });

  // ── 2. BASE CAPACITY MAP ────────────────────────────────────────────────────
  const baseCapMap: Record<string, number> = {};
  windowDates.forEach((d) => {
    const dow = new Date(d + "T00:00:00").getDay();
    let budget = 150;
    if (capacityData?.weeklyPattern?.[dow] !== undefined)
      budget = capacityData.weeklyPattern[dow];
    if (capacityData?.dateOverrides?.[d] !== undefined)
      budget = capacityData.dateOverrides[d];
    baseCapMap[d] = budget;
  });

  // ── 3. WEEKLY TASKS ─────────────────────────────────────────────────────────
  const weeklyItems: Record<string, PlanItem[]> = {};
  windowDates.forEach((d) => {
    const dow = new Date(d + "T00:00:00").getDay();
    weeklyItems[d] = ((weeklyTasks ?? []) as any[])
      .filter((t) => t.day_of_week === dow && t.name?.trim())
      .map(
        (t): PlanItem => ({
          id:      t.id,
          name:    t.name,
          minutes: t.duration_minutes,
          isDone:  todayCompletionKeys.has(`weekly_task:${t.id}`),
          isBonus: false,
          type:    "weekly_task",
          subject: t.subject || "",
        })
      );
  });

  // ── 4. REVISION ITEMS (placed BEFORE homework to reserve capacity) ──────────
  const revisionItems: Record<string, PlanItem[]> = {};
  const occupiedCap: Record<string, number> = {};

  windowDates.forEach((d) => {
    revisionItems[d] = [];
    occupiedCap[d] = (weeklyItems[d] ?? []).reduce(
      (sum, i) => sum + (i.minutes || 0),
      0
    );
  });

  const processedRevisionIds = new Set<string>();

  ((revisionSlots ?? []) as any[]).forEach((slot) => {
    if (processedRevisionIds.has(slot.id)) return;

    const assignedDate = slot.date
      ? toDateOnly(String(slot.date))
      : null;

    if (!assignedDate || revisionItems[assignedDate] === undefined) return;

    const isDone =
      slot.is_completed === true ||
      todayCompletionKeys.has(`revision:${slot.id}`);
    const mins    = slot.duration_minutes || 30;
    const label   = slot.displayName || slot.description || "Revision Session";
    const isFixed = slot.is_fixed === true;
    const slotType = slot.slot_type ?? "standard";

    // A slot is bonus only if it's on a zero-capacity day
    const isBonus = isItemBonus(assignedDate, today, baseCapMap);

    revisionItems[assignedDate].push({
      id:       slot.id,
      type:     "revision",
      isDone,
      minutes:  mins,
      isBonus,
      name:     label,
      subject:  slot.subject || "Revision",
      examId:   slot.exam_id,
      slot_type: slotType,
      is_fixed:  isFixed,
    });

    if (!isBonus) {
      occupiedCap[assignedDate] += mins;
    }

    processedRevisionIds.add(slot.id);
  });

  // ── 5. HOMEWORK ─────────────────────────────────────────────────────────────
  // Determine whether today is already "secured" so the scheduler can shift
  // new placements to tomorrow.
  // Fix from original: compare revision + weekly completions to actual planned
  // counts rather than raw key set size.
  const todayRevisionDone = (revisionItems[today] ?? []).filter(
    (i) => i.isDone && !i.isBonus
  ).length;
  const todayRevisionPlanned = (revisionItems[today] ?? []).filter(
    (i) => !i.isBonus
  ).length;
  const todayIsSecured =
    todayRevisionPlanned > 0 && todayRevisionDone >= todayRevisionPlanned;

  const { placedByDate } = scheduleHomework({
    tasks:               (deadlines ?? []) as HomeworkTask[],
    windowDates,
    today,
    baseCapMap,
    occupiedCap:         { ...occupiedCap },    // snapshot so scheduler mutates its own copy
    shiftStartToTomorrow: todayIsSecured,
    todayCompletionKeys,
    historicalIds,
  });

  // Convert PlacedHomeworkTask → PlanItem and merge into occupiedCap
  const homeworkItems: Record<string, PlanItem[]> = {};
  windowDates.forEach((d) => (homeworkItems[d] = []));

  windowDates.forEach((d) => {
    (placedByDate[d] ?? []).forEach((task) => {
      const item: PlanItem = {
        id:            task.id,
        name:          task.name,
        minutes:       task.estimated_minutes,
        dueDate:       task.due_date,
        isDone:        task.isDone,
        isBonus:       task.isBonus,
        type:          "deadline_task",
        subject:       task.subject_name || task.subject || "",
        scheduledDate: task.scheduled_date ?? d,
      };
      homeworkItems[d].push(item);
      if (!item.isBonus) {
        occupiedCap[d] = (occupiedCap[d] || 0) + (task.estimated_minutes || 0);
      }
    });
  });

  // ── 6. PROJECTS ─────────────────────────────────────────────────────────────
  const projectItems: Record<string, PlanItem[]> = {};
  windowDates.forEach((d) => (projectItems[d] = []));

  const projectProgress: Record<string, number> = {};
  ((projects ?? []) as any[]).forEach(
    (p) => (projectProgress[p.id] = p.completed_minutes || 0)
  );

  const DAILY_PROJECT_CEILING = 120;

  windowDates.forEach((d) => {
    let totalProjectMinsToday = 0;
    let spareForProjects = (baseCapMap[d] || 0) - (occupiedCap[d] || 0);

    const sortedProjects = [...((projects ?? []) as any[])].sort(
      (a, b) => daysBetween(d, a.due_date) - daysBetween(d, b.due_date)
    );

    for (const project of sortedProjects) {
      const isDoneToday =
        todayCompletionKeys.has(`project:${project.id}`) && d === today;
      if (project.status === "completed" && !isDoneToday) continue;

      const remainingMinutes =
        project.estimated_minutes - projectProgress[project.id];
      const daysLeft = daysBetween(d, project.due_date);

      const shouldPlan =
        (d === today && isDoneToday) ||
        (remainingMinutes > 0 && daysLeft >= 0);

      if (!shouldPlan) continue;

      if (!isDoneToday) {
        if (totalProjectMinsToday >= DAILY_PROJECT_CEILING) break;
        if (spareForProjects < 15) break;
      }

      const maxSession = daysLeft <= 5 ? 90 : 60;
      const allocation = isDoneToday
        ? 60 // stable denominator for completed sessions
        : Math.min(
            remainingMinutes,
            spareForProjects,
            maxSession,
            DAILY_PROJECT_CEILING - totalProjectMinsToday
          );

      if (allocation < 15 && !isDoneToday) continue;

      const isBonus = isItemBonus(d, today, baseCapMap);

      projectItems[d].push({
        id:        project.id,
        projectId: project.id,
        type:      "project",
        isDone:    isDoneToday,
        minutes:   allocation,
        isBonus,
        name:      `Project: ${project.name}`,
        subject:   project.subject || "Project",
      });

      if (!isBonus) {
        spareForProjects -= allocation;
        occupiedCap[d] = (occupiedCap[d] || 0) + allocation;
        totalProjectMinsToday += allocation;
      }
      projectProgress[project.id] += allocation;
    }
  });

  // ── 7. FINAL ASSEMBLY ───────────────────────────────────────────────────────
  const days: DayPlan[] = windowDates.map((d) => {
    const rawItems: PlanItem[] = [
      ...(weeklyItems[d]   ?? []),
      ...(homeworkItems[d] ?? []),
      ...(revisionItems[d] ?? []),
      ...(projectItems[d]  ?? []),
    ];

    // Deduplicate by id — keep the "done" version if there's a conflict
    const uniqueMap = new Map<string, PlanItem>();
    rawItems.forEach((item) => {
      const existing = uniqueMap.get(item.id);
      if (!existing || (!existing.isDone && item.isDone)) {
        uniqueMap.set(item.id, item);
      }
    });

    const finalItems = Array.from(uniqueMap.values());

    const nonBonusItems    = finalItems.filter((i) => !i.isBonus);
    const totalPlanned     = nonBonusItems.reduce((s, i) => s + (i.minutes || 0), 0);
    const plannedCount     = nonBonusItems.length;
    const totalCompleted   = finalItems.filter((i) => i.isDone).reduce((s, i) => s + (i.minutes || 0), 0);
    const completedCount   = finalItems.filter((i) => i.isDone).length;

    const wItems = weeklyItems[d]   ?? [];
    const hItems = homeworkItems[d] ?? [];
    const rItems = revisionItems[d] ?? [];
    const pItems = projectItems[d]  ?? [];

    return {
      date: d,
      baseCapacity: baseCapMap[d] ?? 0,
      weekly: {
        minutes: wItems.reduce((s, i) => s + (i.minutes || 0), 0),
        items:   wItems,
      },
      homework: {
        minutes: hItems.reduce((s, i) => s + (i.minutes || 0), 0),
        actualCompletedMinutes: hItems
          .filter((i) => i.isDone)
          .reduce((s, i) => s + (i.minutes || 0), 0),
        items: hItems,
      },
      revision: {
        minutes: rItems.reduce((s, i) => s + (i.minutes || 0), 0),
        items:   rItems,
      },
      projects: {
        minutes: pItems.reduce((s, i) => s + (i.minutes || 0), 0),
        items:   pItems,
      },
      totalPlanned,
      totalCompleted,
      plannedTaskCount:   plannedCount,
      completedTaskCount: completedCount,
      spare: Math.max(0, (baseCapMap[d] ?? 0) - totalPlanned),
    };
  });

  return { days };
}
