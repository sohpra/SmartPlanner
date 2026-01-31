import { daysBetween } from "@/lib/planner/revisionEngine";

/* ============================================================
   TYPES
   ============================================================ */

export type ProjectInput = {
  id: string;
  name: string;
  subject?: string | null;
  due_date: string;            // YYYY-MM-DD
  remaining_minutes: number;   // total remaining work
};

export type ProjectWeekDemand = {
  projectId: string;
  name: string;
  subject?: string | null;

  dueDate: string;
  isOverdue: boolean;

  remainingMinutes: number;

  weeksToDueIncludingThis: number;

  recommendedThisWeekMinutes: number;
};

/* ============================================================
   CORE LOGIC
   ============================================================ */

/**
 * Computes how much time each project SHOULD get this week,
 * without placing it on days yet.
 *
 * Rules:
 * - Spread remaining work evenly across remaining weeks
 * - Include THIS week
 * - Cap per project per week (default 5h)
 * - If overdue → recommend full cap
 */
export function buildProjectWeekDemand(
  projects: ProjectInput[],
  opts: {
    today: string;
    weeklyCapMinutes: number;
  }
): ProjectWeekDemand[] {
  const { today, weeklyCapMinutes } = opts;

  return projects.map((p) => {
    const daysToDue = daysBetween(today, p.due_date);

    const isOverdue = daysToDue < 0;

    const weeksToDueIncludingThis = isOverdue
      ? 0
      : Math.max(1, Math.ceil(daysToDue / 7));

    let recommendedThisWeekMinutes: number;

    if (isOverdue) {
      // overdue → push max signal
      recommendedThisWeekMinutes = Math.min(
        p.remaining_minutes,
        weeklyCapMinutes
      );
    } else {
      const evenSplit = Math.ceil(
        p.remaining_minutes / weeksToDueIncludingThis
      );

      recommendedThisWeekMinutes = Math.min(
        evenSplit,
        weeklyCapMinutes
      );
    }

    return {
      projectId: p.id,
      name: p.name,
      subject: p.subject ?? null,

      dueDate: p.due_date,
      isOverdue,

      remainingMinutes: p.remaining_minutes,

      weeksToDueIncludingThis,

      recommendedThisWeekMinutes,
    };
  });
}
