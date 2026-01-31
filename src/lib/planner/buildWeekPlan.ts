// lib/planner/buildWeekPlan.ts

import {
  planRevisionSlots,
  addDays,
  toDateOnly,
  daysBetween,
} from "@/lib/planner/revisionEngine";

import {
  allocateProjectsIntoDays,
  type ProjectWeekPlan,
} from "@/lib/planner/projectAllocator";

/* ================================
   Types
   ================================ */

export type DayPlan = {
  date: string;

  weekly: {
    minutes: number;
    items: { name: string; minutes: number }[];
  };

  homework: {
    minutes: number;
    items: { name: string; dueDate: string; minutes: number }[];
  };

  revision: {
    minutes: number;
    slots: {
      examId: string;
      subject: string;
      slotMinutes: number;
      label: string;
    }[];
  };

  projects: {
    minutes: number;
    items: { projectId: string; name: string; minutes: number }[];
  };

  baseCapacity: number;
  totalUsed: number;
  spare: number;
};

export type WeekPlan = {
  days: DayPlan[];
};

/* ================================
   Helpers
   ================================ */

function buildBaseCapacity(start: string, days: number) {
  const out: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const dow = new Date(d + "T00:00:00").getDay();
    out[d] = dow === 0 || dow === 6 ? 240 : 150;
  }
  return out;
}

/* ================================
   Main builder
   ================================ */

export function buildWeekPlan({
  today,
  numDays = 7,
  weeklyTasks,
  deadlines,
  exams,
  projects,
}: {
  today: string;
  numDays?: number;
  weeklyTasks: {
    id: string;
    name: string;
    duration_minutes: number;
    day_of_week: number;
  }[];
  deadlines: {
    name: string;
    due_date: string;
    estimated_minutes: number;
  }[];
  exams: {
    id: string;
    subject: string;
    date: string;
  }[];
  projects: {
    id: string;
    name: string;
    subject?: string;
    due_date?: string | null;
    estimated_minutes: number;
    completed_minutes: number;
    status: string;
  }[];
}): WeekPlan {
  const windowDates = Array.from({ length: numDays }, (_, i) =>
    addDays(today, i)
  );

  const baseCapacity = buildBaseCapacity(today, numDays);

  /* ================================
     WEEKLY TASKS
     ================================ */

  const weeklyMinutesByDate: Record<string, number> = {};
  const weeklyItemsByDate: Record<
    string,
    { name: string; minutes: number }[]
  > = {};

  windowDates.forEach((d) => {
    weeklyMinutesByDate[d] = 0;
    weeklyItemsByDate[d] = [];
  });

  for (const task of weeklyTasks) {
    for (const d of windowDates) {
      const dow = new Date(d + "T00:00:00").getDay();
      if (dow === task.day_of_week) {
        weeklyMinutesByDate[d] += task.duration_minutes;
        weeklyItemsByDate[d].push({
          name: task.name,
          minutes: task.duration_minutes,
        });
      }
    }
  }

  /* ================================
     HOMEWORK & ASSIGNMENTS
     ================================ */

  const homeworkItemsByDate: Record<
    string,
    { name: string; dueDate: string; minutes: number }[]
  > = {};

  const remainingCap: Record<string, number> = {};

  for (const d of windowDates) {
    homeworkItemsByDate[d] = [];
    remainingCap[d] = baseCapacity[d] - weeklyMinutesByDate[d];
  }

  const orderedDeadlines = [...deadlines].sort(
    (a, b) => daysBetween(today, a.due_date) - daysBetween(today, b.due_date)
  );

  for (const task of orderedDeadlines) {
    let remaining = task.estimated_minutes;
    const candidates = windowDates.filter((d) => d < task.due_date);

    const oneDay = candidates.find((d) => remainingCap[d] >= remaining);
    if (oneDay) {
      homeworkItemsByDate[oneDay].push({
        name: task.name,
        dueDate: task.due_date,
        minutes: remaining,
      });
      remainingCap[oneDay] -= remaining;
      continue;
    }

    for (const d of candidates) {
      if (remaining <= 0) break;
      if (remainingCap[d] <= 0) continue;

      const used = Math.min(remainingCap[d], remaining);
      homeworkItemsByDate[d].push({
        name: task.name,
        dueDate: task.due_date,
        minutes: used,
      });
      remainingCap[d] -= used;
      remaining -= used;
    }
  }

  const homeworkMinutesByDate: Record<string, number> = {};
  windowDates.forEach((d) => {
    homeworkMinutesByDate[d] = homeworkItemsByDate[d].reduce(
      (s, x) => s + x.minutes,
      0
    );
  });

  /* ================================
     REVISION
     ================================ */

  const revisionCapacity: Record<string, number> = {};
  windowDates.forEach((d) => {
    revisionCapacity[d] = Math.max(
      0,
      baseCapacity[d] -
        weeklyMinutesByDate[d] -
        homeworkMinutesByDate[d]
    );
  });

  const revisionPlan = planRevisionSlots(exams, {
    startDate: today,
    numDays,
    capacityByDate: revisionCapacity,
    includeExamDay: false,
  });

  /* ================================
     PROJECTS
     ================================ */

  const projectWeekPlans: ProjectWeekPlan[] = projects
    .filter((p) => p.status === "active")
    .map((p) => ({
      projectId: p.id,
      name: p.name,
      subject: p.subject,
      dueDate: p.due_date,
      weeklyRemainingMinutes: Math.max(
        0,
        p.estimated_minutes - p.completed_minutes
      ),
    }));

  const spareCapacityByDate: Record<string, number> = {};
  for (const day of revisionPlan.days) {
    spareCapacityByDate[day.date] = Math.max(
      0,
      baseCapacity[day.date] -
        weeklyMinutesByDate[day.date] -
        homeworkMinutesByDate[day.date] -
        day.usedMinutes
    );
  }

  const projectByDate = allocateProjectsIntoDays(
    projectWeekPlans,
    windowDates,
    spareCapacityByDate
  );

  /* ================================
     FINAL ASSEMBLY
     ================================ */

  const days: DayPlan[] = revisionPlan.days.map((day) => {
    const weeklyMins = weeklyMinutesByDate[day.date];
    const homeworkMins = homeworkMinutesByDate[day.date];
    const revisionMins = day.usedMinutes;
    const projectItems = projectByDate[day.date] ?? [];
    const projectMins = projectItems.reduce((s, x) => s + x.minutes, 0);

    const totalUsed =
      weeklyMins + homeworkMins + revisionMins + projectMins;

    return {
      date: day.date,
      baseCapacity: baseCapacity[day.date],

      weekly: {
        minutes: weeklyMins,
        items: weeklyItemsByDate[day.date],
      },

      homework: {
        minutes: homeworkMins,
        items: homeworkItemsByDate[day.date],
      },

      revision: {
        minutes: revisionMins,
        slots: day.slots,
      },

      projects: {
        minutes: projectMins,
        items: projectItems,
      },

      totalUsed,
      spare: Math.max(0, baseCapacity[day.date] - totalUsed),
    };
  });

  return { days };
}
