import { addDays } from "@/lib/planner/revisionEngine";

export type ProjectWeekPlan = {
  projectId: string;
  name: string;
  subject: string | null;
  dueDate: string;
  weeklyRemainingMinutes: number;
};

export type ProjectDayAllocation = {
  projectId: string;
  name: string;
  minutes: number;
};

export function allocateProjectsIntoDays(
  projects: ProjectWeekPlan[],
  windowDates: string[],
  spareCapacityByDate: Record<string, number>
): Record<string, ProjectDayAllocation[]> {
  const perDay: Record<string, ProjectDayAllocation[]> = {};
  for (const d of windowDates) perDay[d] = [];

  // Defensive copy of capacity
  const remainingCap: Record<string, number> = { ...spareCapacityByDate };

  for (const project of projects) {
    let remaining = project.weeklyRemainingMinutes;

    for (const d of windowDates) {
      if (remaining <= 0) break;
      if (d > project.dueDate) break;

      const cap = remainingCap[d];
      if (cap <= 0) continue;

      const used = Math.min(cap, remaining);

      perDay[d].push({
        projectId: project.projectId,
        name: project.name,
        minutes: used,
      });

      remainingCap[d] -= used;
      remaining -= used;
    }
  }

  return perDay;
}
