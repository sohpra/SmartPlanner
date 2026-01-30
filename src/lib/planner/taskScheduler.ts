/* =========================
   SmartPlanner — Layer 1.5
   Tasks → Daily Load (Weekly + Deadline)
   Pure TypeScript (no Supabase, no React)
   ========================= */

export type WeeklyTaskInput = {
  id: string;
  name: string;
  day_of_week: number; // 0-6 (Sun-Sat)
  duration_minutes: number;
};

export type DeadlineTaskInput = {
  id: string;
  name: string;
  due_date: string; // YYYY-MM-DD or ISO
  estimated_minutes: number;
  completed_minutes?: number | null;
};

export type ScheduledTaskItem = {
  id: string;
  name: string;
  minutes: number;
  kind: "weekly" | "deadline";
  meta?: Record<string, unknown>;
};

export type DayTaskLoad = {
  date: string; // YYYY-MM-DD
  weeklyMinutes: number;
  deadlineMinutes: number;
  weeklyItems: ScheduledTaskItem[];
  deadlineItems: ScheduledTaskItem[];
};

export type DeadlineUnmet = {
  id: string;
  name: string;
  dueDate: string; // YYYY-MM-DD
  remainingMinutes: number;
};

export function toDateOnly(dateStr: string): string {
  if (!dateStr) return "";
  return dateStr.length >= 10 ? dateStr.slice(0, 10) : dateStr;
}

function dayOfWeek(dateYYYYMMDD: string): number {
  const d = new Date(dateYYYYMMDD + "T00:00:00");
  return d.getDay();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeMinutes(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

/**
 * Build per-day weekly load (only on matching weekday).
 */
export function buildWeeklyLoad(
  windowDates: string[],
  weeklyTasks: WeeklyTaskInput[]
): Record<string, { minutes: number; items: ScheduledTaskItem[] }> {
  const out: Record<string, { minutes: number; items: ScheduledTaskItem[] }> = {};

  for (const date of windowDates) {
    const dow = dayOfWeek(date);
    const todays = weeklyTasks.filter((t) => t.day_of_week === dow);

    const items: ScheduledTaskItem[] = todays.map((t) => ({
      id: t.id,
      name: t.name,
      minutes: safeMinutes(t.duration_minutes),
      kind: "weekly",
      meta: { day_of_week: t.day_of_week },
    }));

    const minutes = items.reduce((s, i) => s + i.minutes, 0);
    out[date] = { minutes, items };
  }

  return out;
}

/**
 * Schedule deadline tasks BEFORE due date (never on due date).
 * Greedy: earliest available minutes, tasks sorted by due date.
 *
 * baseCapacityByDate is the raw daily capacity (e.g., 150/240).
 * weeklyLoadByDate is already fixed and must be subtracted first.
 */
export function scheduleDeadlinesBeforeDueDate(args: {
  windowDates: string[];
  baseCapacityByDate: Record<string, number>;
  weeklyLoadByDate: Record<string, { minutes: number; items: ScheduledTaskItem[] }>;
  deadlineTasks: DeadlineTaskInput[];
}) {
  const { windowDates, baseCapacityByDate, weeklyLoadByDate, deadlineTasks } = args;

  // Remaining capacity after weekly is what deadlines may consume
  const remainingAfterWeekly: Record<string, number> = {};
  for (const date of windowDates) {
    const base = safeMinutes(baseCapacityByDate[date] ?? 0);
    const weekly = safeMinutes(weeklyLoadByDate[date]?.minutes ?? 0);
    remainingAfterWeekly[date] = Math.max(0, base - weekly);
  }

  const deadlineItemsByDate: Record<string, ScheduledTaskItem[]> = {};
  for (const date of windowDates) deadlineItemsByDate[date] = [];

  const sorted = [...deadlineTasks].sort((a, b) => {
    const ad = toDateOnly(a.due_date);
    const bd = toDateOnly(b.due_date);
    return ad.localeCompare(bd);
  });

  const unmet: DeadlineUnmet[] = [];

  for (const t of sorted) {
    const due = toDateOnly(t.due_date);
    if (!due) continue;

    const remainingTotal =
      safeMinutes(t.estimated_minutes) - safeMinutes(t.completed_minutes ?? 0);

    let remaining = clamp(remainingTotal, 0, 10_000);
    if (remaining <= 0) continue;

    // Eligible dates are STRICTLY before due date, and inside the window
    const eligibleDates = windowDates.filter((d) => d < due);

    for (const date of eligibleDates) {
      if (remaining <= 0) break;

      const avail = remainingAfterWeekly[date] ?? 0;
      if (avail <= 0) continue;

      const take = Math.min(avail, remaining);
      if (take <= 0) continue;

      deadlineItemsByDate[date].push({
        id: t.id,
        name: t.name,
        minutes: take,
        kind: "deadline",
        meta: { dueDate: due },
      });

      remainingAfterWeekly[date] = avail - take;
      remaining -= take;
    }

    if (remaining > 0) {
      unmet.push({
        id: t.id,
        name: t.name,
        dueDate: due,
        remainingMinutes: remaining,
      });
    }
  }

  // Also provide minutes by day
  const deadlineMinutesByDate: Record<string, number> = {};
  for (const date of windowDates) {
    deadlineMinutesByDate[date] = deadlineItemsByDate[date].reduce((s, i) => s + i.minutes, 0);
  }

  return {
    deadlineItemsByDate,
    deadlineMinutesByDate,
    remainingAfterWeekly, // post-deadlines consumption (mutated)
    unmetDeadlines: unmet,
  };
}

/**
 * Convenience: Build a combined DayTaskLoad per window date.
 */
export function buildDayTaskLoad(args: {
  windowDates: string[];
  weeklyLoadByDate: Record<string, { minutes: number; items: ScheduledTaskItem[] }>;
  deadlineItemsByDate: Record<string, ScheduledTaskItem[]>;
  deadlineMinutesByDate: Record<string, number>;
}): Record<string, DayTaskLoad> {
  const { windowDates, weeklyLoadByDate, deadlineItemsByDate, deadlineMinutesByDate } = args;

  const out: Record<string, DayTaskLoad> = {};
  for (const date of windowDates) {
    const weekly = weeklyLoadByDate[date] ?? { minutes: 0, items: [] };
    const deadlineItems = deadlineItemsByDate[date] ?? [];
    const deadlineMinutes = safeMinutes(deadlineMinutesByDate[date] ?? 0);

    out[date] = {
      date,
      weeklyMinutes: safeMinutes(weekly.minutes),
      deadlineMinutes,
      weeklyItems: weekly.items,
      deadlineItems,
    };
  }
  return out;
}
