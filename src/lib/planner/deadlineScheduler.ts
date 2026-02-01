import { daysBetween } from "./revisionEngine";

export type DeadlineLike = {
  id: string;
  name: string;
  due_date: string; // YYYY-MM-DD
  estimated_minutes: number;
};

export function scheduleDeadlineTasksLAP(
  tasks: DeadlineLike[],
  dayCaps: Record<string, number>,
  startDate: string,
  windowDates: string[]
) {
  const allocations: Record<
    string,
    { id: string; name: string; minutes: number }[]
  > = {};

  const remainingCap = { ...dayCaps };

  // Sort by due date (earliest first)
  const ordered = [...tasks].sort(
    (a, b) => daysBetween(startDate, a.due_date) - daysBetween(startDate, b.due_date)
  );

  for (const task of ordered) {
    let minutesLeft = task.estimated_minutes;

    // Walk BACKWARDS from day before due date
    for (let i = windowDates.length - 1; i >= 0; i--) {
      const day = windowDates[i];

      // cannot schedule on or after due date
      if (day >= task.due_date) continue;
      if (remainingCap[day] <= 0) continue;

      const used = Math.min(remainingCap[day], minutesLeft);

      if (used > 0) {
        allocations[day] ??= [];
        allocations[day].push({
          id: task.id,
          name: task.name,
          minutes: used,
        });

        remainingCap[day] -= used;
        minutesLeft -= used;
      }

      if (minutesLeft <= 0) break;
    }
  }

  return allocations;
}
