"use client";

import { useMemo } from "react";

import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";

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

/* ============================================================
   Helpers
   ============================================================ */

function buildBaseCapacity(start: string, days: number) {
  const out: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const dow = new Date(d + "T00:00:00").getDay();
    out[d] = dow === 0 || dow === 6 ? 240 : 150;
  }
  return out;
}

/* ============================================================
   Component
   ============================================================ */

export default function DebugRevisionPage() {
  const today = toDateOnly(new Date().toISOString());
  const numDays = 7;

  const weekly = useWeeklyTasks();
  const deadlines = useDeadlineTasks();
  const exams = useExams();
  const projectsHook = useProjects();

  const windowDates = useMemo(
    () => Array.from({ length: numDays }, (_, i) => addDays(today, i)),
    [today]
  );

  const baseCapacity = useMemo(
    () => buildBaseCapacity(today, numDays),
    [today]
  );

  /* ============================================================
     WEEKLY TASKS
     ============================================================ */

  const weeklyByDate = useMemo(() => {
    const map: Record<string, number> = {};
    windowDates.forEach((d) => (map[d] = 0));

    for (const task of weekly.tasks) {
      for (const d of windowDates) {
        const dow = new Date(d + "T00:00:00").getDay();
        if (dow === task.day_of_week) {
          map[d] += task.duration_minutes;
        }
      }
    }
    return map;
  }, [weekly.tasks, windowDates]);

  const weeklyItemsByDate = useMemo(() => {
    const map: Record<string, { name: string; minutes: number }[]> = {};
    windowDates.forEach((d) => (map[d] = []));

    for (const task of weekly.tasks) {
      for (const d of windowDates) {
        const dow = new Date(d + "T00:00:00").getDay();
        if (dow === task.day_of_week) {
          map[d].push({
            name: task.name,
            minutes: task.duration_minutes,
          });
        }
      }
    }
    return map;
  }, [weekly.tasks, windowDates]);

  /* ============================================================
     HOMEWORK & ASSESSMENTS (Deadline tasks)
     ============================================================ */

  const homeworkByDate = useMemo(() => {
    const remainingCap: Record<string, number> = {};
    const perDay: Record<
      string,
      { name: string; dueDate: string; minutes: number }[]
    > = {};

    for (const d of windowDates) {
      remainingCap[d] = baseCapacity[d] - weeklyByDate[d];
      perDay[d] = [];
    }

    const ordered = [...deadlines.tasks].sort(
      (a, b) => daysBetween(today, a.due_date) - daysBetween(today, b.due_date)
    );

    for (const task of ordered) {
      let remaining = task.estimated_minutes;
      const candidates = windowDates.filter((d) => d < task.due_date);

      const oneDay = candidates.find((d) => remainingCap[d] >= remaining);
      if (oneDay) {
        perDay[oneDay].push({
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
        perDay[d].push({
          name: task.name,
          dueDate: task.due_date,
          minutes: used,
        });
        remainingCap[d] -= used;
        remaining -= used;
      }
    }

    return perDay;
  }, [deadlines.tasks, windowDates, baseCapacity, weeklyByDate, today]);

  const homeworkMinutesByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of windowDates) {
      map[d] = homeworkByDate[d].reduce((s, x) => s + x.minutes, 0);
    }
    return map;
  }, [homeworkByDate, windowDates]);

  /* ============================================================
     REVISION
     ============================================================ */

  const revisionCapacity = useMemo(() => {
    const cap: Record<string, number> = {};
    for (const d of windowDates) {
      cap[d] = Math.max(
        0,
        baseCapacity[d] - weeklyByDate[d] - homeworkMinutesByDate[d]
      );
    }
    return cap;
  }, [baseCapacity, weeklyByDate, homeworkMinutesByDate, windowDates]);

  const revisionPlan = useMemo(() => {
    return planRevisionSlots(exams.upcoming, {
      startDate: today,
      numDays,
      capacityByDate: revisionCapacity,
      includeExamDay: false,
    });
  }, [exams.upcoming, today, numDays, revisionCapacity]);

  /* ============================================================
     PROJECTS (READ-ONLY – already allocated elsewhere)
     ============================================================ */

  const projectWeekPlans: ProjectWeekPlan[] = useMemo(() => {
    return projectsHook.projects
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
  }, [projectsHook.projects]);

  const spareCapacityByDate = useMemo(() => {
    const spare: Record<string, number> = {};
    for (const day of revisionPlan.days) {
      spare[day.date] = Math.max(
        0,
        baseCapacity[day.date] -
          weeklyByDate[day.date] -
          homeworkMinutesByDate[day.date] -
          day.usedMinutes
      );
    }
    return spare;
  }, [
    revisionPlan.days,
    baseCapacity,
    weeklyByDate,
    homeworkMinutesByDate,
  ]);

  const projectByDate = useMemo(() => {
    return allocateProjectsIntoDays(
      projectWeekPlans,
      windowDates,
      spareCapacityByDate
    );
  }, [projectWeekPlans, windowDates, spareCapacityByDate]);

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-semibold">🔍 Planner Debug</h1>

      {revisionPlan.days.map((day) => {
        const base = baseCapacity[day.date];
        const weeklyMins = weeklyByDate[day.date];
        const homeworkMins = homeworkMinutesByDate[day.date];
        const revisionMins = day.usedMinutes;
        const projectMins =
          projectByDate[day.date]?.reduce((s, x) => s + x.minutes, 0) ?? 0;

        const totalUsed =
          weeklyMins + homeworkMins + revisionMins + projectMins;

        return (
          <div key={day.date} className="rounded-lg border p-4 space-y-3">
            <div className="flex justify-between">
              <h2 className="font-medium">{day.date}</h2>
              <div className="text-sm text-gray-600">
                Total used {totalUsed} / {base} mins
              </div>
            </div>

            <ul className="text-sm space-y-1">
              <li>📌 Weekly: {weeklyMins}</li>
              <li>📅 Homework & Assessments: {homeworkMins}</li>
              <li>⏱ Revision: {revisionMins}</li>
              <li>🧩 Projects: {projectMins}</li>
            </ul>

            {weeklyItemsByDate[day.date].length > 0 && (
              <>
                <div className="font-medium">Weekly</div>
                {weeklyItemsByDate[day.date].map((t, i) => (
                  <div key={i}>• {t.name}: {t.minutes} mins</div>
                ))}
              </>
            )}

            {homeworkByDate[day.date].length > 0 && (
              <>
                <div className="font-medium">Homework & Assessments</div>
                {homeworkByDate[day.date].map((h, i) => (
                  <div key={i}>
                    • {h.name} (due {h.dueDate}): {h.minutes} mins
                  </div>
                ))}
              </>
            )}

            {day.slots.length > 0 && (
              <>
                <div className="font-medium">Revision</div>
                {day.slots.map((s, i) => (
                  <div key={i}>
                    • {s.subject} — {s.label} ({s.slotMinutes} mins)
                  </div>
                ))}
              </>
            )}

            {projectByDate[day.date]?.length > 0 && (
              <>
                <div className="font-medium">Projects</div>
                {projectByDate[day.date].map((p, i) => (
                  <div key={i}>
                    • {p.name}: {p.minutes} mins
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
