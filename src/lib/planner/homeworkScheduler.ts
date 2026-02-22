// ─────────────────────────────────────────────────────────────────────────────
// homeworkScheduler.ts — Single source of truth for homework placement.
//
// Previously this algorithm was duplicated between buildWeekPlan.ts and
// revisionPersistence.ts, causing silent drift. Now both import from here.
// ─────────────────────────────────────────────────────────────────────────────

import { addDays, daysBetween, toDateOnly } from "./dateUtils";
import type { HomeworkTask, HomeworkPlacementResult, PlacedHomeworkTask } from "./types";

export type HomeworkSchedulerInput = {
  tasks: HomeworkTask[];
  windowDates: string[];
  today: string;
  baseCapMap: Record<string, number>;
  // Minutes already consumed by weekly tasks + revision on each date
  occupiedCap: Record<string, number>;
  // If true, today is already "done" and new tasks should start from tomorrow
  shiftStartToTomorrow: boolean;
  // Completions keyed as `deadline_task:{id}` for today
  todayCompletionKeys: Set<string>;
  // IDs historically completed (before today)
  historicalIds: Set<string>;
};

const POLITE_BUFFER_MINS = 45;

/**
 * Places homework tasks into dates using a three-pass greedy algorithm:
 *   Pass 1 — Respects a 45m breathing-room buffer
 *   Pass 2 — No buffer (emergency)
 *   Pass 3 — Last resort: place on day-before-deadline regardless of load
 *
 * Returns:
 *   placedByDate   — items grouped by date, ready for UI rendering
 *   tasksToUpdate  — DB updates needed (scheduled_date changed)
 *   occupiedByDate — final minutes consumed per date (for downstream engines)
 */
export function scheduleHomework(input: HomeworkSchedulerInput): HomeworkPlacementResult {
  const {
    tasks,
    windowDates,
    today,
    baseCapMap,
    occupiedCap,
    shiftStartToTomorrow,
    todayCompletionKeys,
    historicalIds,
  } = input;

  const searchStartDate = shiftStartToTomorrow
    ? addDays(today, 1)
    : today;

  const placedByDate: Record<string, PlacedHomeworkTask[]> = {};
  windowDates.forEach((d) => (placedByDate[d] = []));

  // Mutable copy of occupied so placements accumulate correctly
  const occupied: Record<string, number> = { ...occupiedCap };

  const tasksToUpdate: { id: string; scheduled_date: string }[] = [];

  const sorted = [...tasks].sort((a, b) => {
    // Fixed tasks always go first
    if (a.is_fixed !== b.is_fixed) return a.is_fixed ? -1 : 1;
    return daysBetween(today, a.due_date) - daysBetween(today, b.due_date);
  });

  for (const task of sorted) {
    const isDoneToday = todayCompletionKeys.has(`deadline_task:${task.id}`);
    const isDoneHistory =
      historicalIds.has(task.id) ||
      (task.status === "completed" && !isDoneToday);

    // Skip tasks fully completed in a prior session
    if (isDoneHistory) continue;

    const taskMins = task.estimated_minutes || 30;
    const dbScheduledDate = task.scheduled_date
      ? toDateOnly(task.scheduled_date)
      : null;

    // ── If already scheduled in DB, honour it ──────────────────────────────
    if (dbScheduledDate && placedByDate[dbScheduledDate] !== undefined) {
      // A task completed today that was scheduled for a future date is a bonus
      const isBonus = isDoneToday && dbScheduledDate > today;
      const targetDate = isBonus ? today : dbScheduledDate;

      placedByDate[targetDate].push(
        buildPlacedTask(task, targetDate, isBonus, isDoneToday)
      );
      occupied[targetDate] = (occupied[targetDate] || 0) + taskMins;
      continue;
    }

    // ── Simulate placement ─────────────────────────────────────────────────
    const dayBeforeDeadline = addDays(task.due_date, -1);
    const possibleDays = windowDates.filter(
      (d) => d >= searchStartDate && d <= dayBeforeDeadline
    );

    let placedDate: string | null = null;

    // Pass 1: Polite — respect breathing-room buffer
    for (const d of possibleDays) {
      if (
        (occupied[d] || 0) + taskMins + POLITE_BUFFER_MINS <=
        (baseCapMap[d] || 0)
      ) {
        placedDate = d;
        break;
      }
    }

    // Pass 2: Emergency — no buffer
    if (!placedDate) {
      for (const d of possibleDays) {
        if ((occupied[d] || 0) + taskMins <= (baseCapMap[d] || 0)) {
          placedDate = d;
          break;
        }
      }
    }

    // Pass 3: Last resort — guarantee it lands before the deadline
    if (!placedDate) {
      placedDate =
        possibleDays.length > 0 ? dayBeforeDeadline : searchStartDate;
    }

    if (placedDate && placedByDate[placedDate] !== undefined) {
      const isBonus = placedDate === today && (baseCapMap[today] || 0) === 0;
      placedByDate[placedDate].push(
        buildPlacedTask(task, placedDate, isBonus, isDoneToday)
      );
      occupied[placedDate] = (occupied[placedDate] || 0) + taskMins;

      // Record DB update if date changed
      if (placedDate !== dbScheduledDate) {
        tasksToUpdate.push({ id: task.id, scheduled_date: placedDate });
      }
    }
  }

  return { placedByDate, tasksToUpdate, occupiedByDate: occupied };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPlacedTask(
  task: HomeworkTask,
  placedDate: string,
  isBonus: boolean,
  isDone: boolean
): PlacedHomeworkTask {
  return {
    ...task,
    placedDate,
    isBonus,
    isDone,
    scheduled_date: task.scheduled_date
      ? toDateOnly(task.scheduled_date)
      : placedDate,
  };
}
