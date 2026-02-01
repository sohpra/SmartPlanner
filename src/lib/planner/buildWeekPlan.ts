// src/lib/planner/buildWeekPlan.ts

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
   Types (aligned to your schema)
   ================================ */

export type DayPlan = {
  date: string;

  weekly: {
    minutes: number;
    items: { id: string; name: string; minutes: number }[];
  };

  homework: {
    minutes: number;
    items: { id: string; name: string; dueDate: string; minutes: number }[];
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

// exams.date is timestamptz in schema; normalise to YYYY-MM-DD in local time-safe way
function examDateToDateOnly(examDate: string) {
  // examDate is ISO timestamptz string from Supabase (usually)
  // toDateOnly expects ISO string and returns YYYY-MM-DD
  return toDateOnly(examDate);
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
  today: string; // YYYY-MM-DD
  numDays?: number;

  weeklyTasks: {
    id: string;
    name: string;
    duration_minutes: number;
    day_of_week: number;
  }[];

  deadlines: {
    id: string;
    name: string;
    due_date: string; // date
    estimated_minutes: number;
  }[];

  exams: {
    id: string;
    subject: string | null;
    exam_type: "Internal" | "Board" | "Competitive";
    date: string; // timestamptz ISO
    preparedness: number | null;
  }[];

  projects: {
    id: string;
    name: string;
    subject: string | null;
    due_date: string; // date (NOT NULL)
    estimated_minutes: number;
    completed_minutes: number;
    status: "active" | "completed" | "paused";
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
    { id: string; name: string; minutes: number }[]
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
          id: task.id,
          name: task.name,
          minutes: task.duration_minutes,
        });
      }
    }
  }

  /* ================================
     HOMEWORK & ASSIGNMENTS (deadline_tasks)
     ================================ */

  const homeworkItemsByDate: Record<
    string,
    { id: string; name: string; dueDate: string; minutes: number }[]
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

    // Avoid pointless splitting
    const oneDay = candidates.find((d) => remainingCap[d] >= remaining);
    if (oneDay) {
      homeworkItemsByDate[oneDay].push({
        id: task.id,
        name: task.name,
        dueDate: task.due_date,
        minutes: remaining,
      });
      remainingCap[oneDay] -= remaining;
      continue;
    }

    // Split only if unavoidable
    for (const d of candidates) {
      if (remaining <= 0) break;
      if (remainingCap[d] <= 0) continue;

      const used = Math.min(remainingCap[d], remaining);
      homeworkItemsByDate[d].push({
        id: task.id,
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
      baseCapacity[d] - weeklyMinutesByDate[d] - homeworkMinutesByDate[d]
    );
  });

  // Convert DB exam rows to revisionEngine ExamInput
  const examInputs = exams.map((e) => ({
    id: e.id,
    subject: e.subject ?? "Unknown subject",
    date: examDateToDateOnly(e.date), // YYYY-MM-DD for the engine
    exam_type: e.exam_type,
    preparedness: e.preparedness ?? 0,
  }));

  const revisionPlan = planRevisionSlots(examInputs, {
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
      subject: p.subject, // ProjectWeekPlan usually expects string | null
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

    const totalUsed = weeklyMins + homeworkMins + revisionMins + projectMins;

    return {
      date: day.date,
      baseCapacity: baseCapacity[day.date],

      weekly: { minutes: weeklyMins, items: weeklyItemsByDate[day.date] },
      homework: { minutes: homeworkMins, items: homeworkItemsByDate[day.date] },
      revision: { minutes: revisionMins, slots: day.slots },

      projects: { minutes: projectMins, items: projectItems },

      totalUsed,
      spare: Math.max(0, baseCapacity[day.date] - totalUsed),
    };
  });

  return { days };
}
