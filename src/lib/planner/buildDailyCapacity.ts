/* =========================
   SmartPlanner — Layer 1
   Daily Capacity Builder
   =========================
   Purpose:
   - Start from base daily capacity
   - Subtract fixed commitments (weekly tasks, deadlines, projects later)
   - Produce remaining capacity for revision engine
*/

import { addDays, toDateOnly } from "./revisionEngine";

/* ---------- Types ---------- */

export type WeeklyTask = {
  id: string;
  name: string;
  day_of_week: number; // 0 = Sunday … 6 = Saturday
  duration_minutes: number;
};

export type Deadline = {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD or ISO
  duration_minutes: number;
};

export type Project = {
  id: string;
  name: string;
  // v1: ignored (we’ll integrate later)
};

export type DailyLoad = {
  baseCapacity: number;
  weeklyTaskMinutes: number;
  deadlineMinutes: number;
  projectMinutes: number;

  totalFixedMinutes: number;
  remainingMinutes: number;
};

export type DailyCapacityResult = {
  capacityByDate: Record<string, number>;
  loadByDate: Record<string, DailyLoad>;
};

/* =========================
   CORE
   ========================= */

export function buildDailyCapacityMap(
  startDate: string,
  numDays: number,
  baseCapacityByDate: Record<string, number>,
  weeklyTasks: WeeklyTask[],
  deadlines: Deadline[],
  projects: Project[] = [] // reserved for later
): DailyCapacityResult {
  const capacityByDate: Record<string, number> = {};
  const loadByDate: Record<string, DailyLoad> = {};

  for (let i = 0; i < numDays; i++) {
    const date = addDays(startDate, i);
    const baseCapacity = baseCapacityByDate[date] ?? 0;

    /* ---------- Weekly tasks ---------- */
    const dayOfWeek = new Date(date + "T00:00:00").getDay();

    const weeklyTaskMinutes = weeklyTasks
      .filter((t) => t.day_of_week === dayOfWeek)
      .reduce((sum, t) => sum + t.duration_minutes, 0);

    /* ---------- Deadlines ---------- */
    const deadlineMinutes = deadlines
      .filter((d) => toDateOnly(d.date) === date)
      .reduce((sum, d) => sum + d.duration_minutes, 0);

    /* ---------- Projects (v1 placeholder) ---------- */
    const projectMinutes = 0;

    const totalFixedMinutes =
      weeklyTaskMinutes + deadlineMinutes + projectMinutes;

    const remainingMinutes = Math.max(
      0,
      baseCapacity - totalFixedMinutes
    );

    capacityByDate[date] = remainingMinutes;

    loadByDate[date] = {
      baseCapacity,
      weeklyTaskMinutes,
      deadlineMinutes,
      projectMinutes,
      totalFixedMinutes,
      remainingMinutes,
    };
  }

  return { capacityByDate, loadByDate };
}
