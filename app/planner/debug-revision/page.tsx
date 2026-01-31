"use client";

import { useMemo } from "react";

import { useExams } from "@/hooks/use-exams";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
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

/* ---------- helpers ---------- */

function buildBaseCapacity(start: string, days: number) {
  const out: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const dow = new Date(d + "T00:00:00").getDay();
    out[d] = dow === 0 || dow === 6 ? 240 : 150;
  }
  return out;
}

function minsToHours(mins: number) {
  return Math.round((mins / 60) * 4) / 4;
}

/* ---------- component ---------- */

export default function DebugRevisionPage() {
  const today = toDateOnly(new Date().toISOString());
  const numDays = 7;

  const exams = useExams();
  const weekly = useWeeklyTasks();
  const deadlines = useDeadlineTasks();
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
    for (const d of windowDates) map[d] = 0;

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

  const weeklyTasksByDate = useMemo(() => {
    const map: Record<string, { name: string; minutes: number }[]> = {};
    for (const d of windowDates) map[d] = [];

    for (const task of weekly.tasks) {
      for (const d of windowDates) {
        const dow = new Date(d + "T00:00:00").getDay();
        if (dow === task.day_of_week) {
          map[d].push({ name: task.name, minutes: task.duration_minutes });
        }
      }
    }
    return map;
  }, [weekly.tasks, windowDates]);

  /* ============================================================
     HOMEWORK & ASSIGNMENTS — earliest-safe, no splitting if avoidable
     ============================================================ */

  const homeworkAllocations = useMemo(() => {
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

      // try single-day placement
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

      // otherwise split
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

  const homeworkByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of windowDates) {
      map[d] = homeworkAllocations[d].reduce((s, x) => s + x.minutes, 0);
    }
    return map;
  }, [homeworkAllocations, windowDates]);

  /* ============================================================
     REVISION
     ============================================================ */

  const revisionCapacity = useMemo(() => {
    const cap: Record<string, number> = {};
    for (const d of windowDates) {
      cap[d] = Math.max(
        0,
        baseCapacity[d] - weeklyByDate[d] - homeworkByDate[d]
      );
    }
    return cap;
  }, [baseCapacity, weeklyByDate, homeworkByDate, windowDates]);

  const revisionPlan = useMemo(() => {
    return planRevisionSlots(exams.upcoming, {
      startDate: today,
      numDays,
      capacityByDate: revisionCapacity,
      includeExamDay: false,
    });
  }, [exams.upcoming, today, numDays, revisionCapacity]);

  /* ============================================================
     PROJECTS — weekly demand → daily allocation
     ============================================================ */

  const projectWeekPlans = useMemo<ProjectWeekPlan[]>(() => {
    return (projectsHook.projects ?? [])
      .filter((p) => p.status === "active")
      .map((p) => {
        const remaining = Math.max(
          0,
          p.estimated_minutes - p.completed_minutes
        );

        return {
          projectId: p.id,
          name: p.name,
          subject: p.subject ?? null,
          dueDate: p.due_date,
          weeklyRemainingMinutes: Math.min(300, remaining), // 5h cap
        };
      });
  }, [projectsHook.projects]);

  const spareCapacityByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const day of revisionPlan.days) {
      const used =
        (weeklyByDate[day.date] ?? 0) +
        (homeworkByDate[day.date] ?? 0) +
        day.usedMinutes;
      map[day.date] = Math.max(0, (baseCapacity[day.date] ?? 0) - used);
    }
    return map;
  }, [revisionPlan.days, weeklyByDate, homeworkByDate, baseCapacity]);

  const projectAllocationsByDate = useMemo(() => {
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
      <h1 className="text-2xl font-semibold">🔍 Planner Debug</h1>

      {/* ===================== */}
      {/* DAILY BREAKDOWN */}
      {/* ===================== */}

      {revisionPlan.days.map((day) => {
        const base = baseCapacity[day.date] ?? 0;
        const weeklyMins = weeklyByDate[day.date] ?? 0;
        const homeworkMins = homeworkByDate[day.date] ?? 0;
        const revisionMins = day.usedMinutes;
        const projectMins =
          projectAllocationsByDate[day.date]?.reduce(
            (s, p) => s + p.minutes,
            0
          ) ?? 0;

        const totalUsed =
          weeklyMins + homeworkMins + revisionMins + projectMins;

        return (
          <div
            key={day.date}
            className="rounded-lg border bg-white p-4 space-y-3"
          >
            <div className="flex justify-between">
              <h2 className="font-medium">{day.date}</h2>
              <div className="text-sm text-gray-600">
                Total used {totalUsed} / {base} mins
              </div>
            </div>

            <ul className="text-sm space-y-1">
              <li>📌 Weekly: {weeklyMins}</li>
              <li>📅 Homework & Assignments: {homeworkMins}</li>
              <li>⏱ Revision: {revisionMins}</li>
              <li>🧩 Projects: {projectMins}</li>
            </ul>

            <div className="pt-2 space-y-2 text-sm">
              {projectAllocationsByDate[day.date]?.length > 0 && (
                <>
                  <div className="font-medium">Projects</div>
                  {projectAllocationsByDate[day.date].map((p, i) => (
                    <div key={i}>
                      • {p.name}: {p.minutes} mins
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
