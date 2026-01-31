"use client";

import { useMemo } from "react";

import { StatCard } from "../components/StatCard";
import { DailyChecklist } from "../components/checklist/DailyChecklist";
import { TomorrowChecklist } from "../components/checklist/TomorrowChecklist";
import { ComingUp } from "../components/dashboard/ComingUp";

import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";
import { useRevision } from "@/hooks/use-revision";

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

export default function PlannerPage() {
  const todayStr = toDateOnly(new Date().toISOString());
  const todayDate = new Date(todayStr + "T00:00:00");
  const numDays = 7;

  const weekly = useWeeklyTasks();
  const deadlines = useDeadlineTasks();
  const exams = useExams();
  const projectsHook = useProjects();
  const revision = useRevision(); // stats card only

  const windowDates = useMemo(
    () => Array.from({ length: numDays }, (_, i) => addDays(todayStr, i)),
    [todayStr]
  );

  const baseCapacity = useMemo(
    () => buildBaseCapacity(todayStr, numDays),
    [todayStr]
  );

  /* ================================
     Weekly mins by date
     ================================ */
  const weeklyMinutesByDate = useMemo(() => {
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

  /* ================================
     Homework allocation (WITH ids)
     ================================ */
  const homeworkByDate = useMemo(() => {
    const remainingCap: Record<string, number> = {};
    const perDay: Record<
      string,
      { id: string; name: string; dueDate: string; minutes: number }[]
    > = {};

    for (const d of windowDates) {
      remainingCap[d] = baseCapacity[d] - weeklyMinutesByDate[d];
      perDay[d] = [];
    }

    const ordered = [...deadlines.tasks].sort(
      (a, b) => daysBetween(todayStr, a.due_date) - daysBetween(todayStr, b.due_date)
    );

    for (const task of ordered) {
      let remaining = task.estimated_minutes;
      const candidates = windowDates.filter((d) => d < task.due_date);

      // avoid pointless splitting
      const oneDay = candidates.find((d) => remainingCap[d] >= remaining);
      if (oneDay) {
        perDay[oneDay].push({
          id: task.id,
          name: task.name,
          dueDate: task.due_date,
          minutes: remaining,
        });
        remainingCap[oneDay] -= remaining;
        continue;
      }

      // split only if unavoidable
      for (const d of candidates) {
        if (remaining <= 0) break;
        if (remainingCap[d] <= 0) continue;

        const used = Math.min(remainingCap[d], remaining);
        perDay[d].push({
          id: task.id,
          name: task.name,
          dueDate: task.due_date,
          minutes: used,
        });
        remainingCap[d] -= used;
        remaining -= used;
      }
    }

    return perDay;
  }, [deadlines.tasks, windowDates, baseCapacity, weeklyMinutesByDate, todayStr]);

  const homeworkMinutesByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of windowDates) {
      map[d] = homeworkByDate[d].reduce((s, x) => s + x.minutes, 0);
    }
    return map;
  }, [homeworkByDate, windowDates]);

  /* ================================
     Revision capacity + plan
     ================================ */
  const revisionCapacity = useMemo(() => {
    const cap: Record<string, number> = {};
    for (const d of windowDates) {
      cap[d] = Math.max(
        0,
        baseCapacity[d] - weeklyMinutesByDate[d] - homeworkMinutesByDate[d]
      );
    }
    return cap;
  }, [baseCapacity, weeklyMinutesByDate, homeworkMinutesByDate, windowDates]);

  const revisionPlan = useMemo(() => {
    return planRevisionSlots(exams.upcoming, {
      startDate: todayStr,
      numDays,
      capacityByDate: revisionCapacity,
      includeExamDay: false,
    });
  }, [exams.upcoming, todayStr, numDays, revisionCapacity]);

  const todaysRevisionSlots =
    revisionPlan.days.find((d) => d.date === todayStr)?.slots ?? [];

  /* ================================
     Projects allocation
     ================================ */
  const projectWeekPlans: ProjectWeekPlan[] = useMemo(() => {
    return projectsHook.projects
      .filter((p) => p.status === "active")
      .map((p) => ({
        projectId: p.id,
        name: p.name,
        subject: p.subject ?? null, // keep null, not undefined
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
          weeklyMinutesByDate[day.date] -
          homeworkMinutesByDate[day.date] -
          day.usedMinutes
      );
    }
    return spare;
  }, [revisionPlan.days, baseCapacity, weeklyMinutesByDate, homeworkMinutesByDate]);

  const projectsByDate = useMemo(() => {
    return allocateProjectsIntoDays(projectWeekPlans, windowDates, spareCapacityByDate);
  }, [projectWeekPlans, windowDates, spareCapacityByDate]);

  /* ================================
     TODAY’s items (with ids)
     ================================ */
  const todayDow = todayDate.getDay();

  const todaysWeeklyItems = useMemo(() => {
    return weekly.tasks
      .filter((t) => t.day_of_week === todayDow)
      .map((t) => ({
        id: t.id,
        name: t.name,
        minutes: t.duration_minutes,
      }));
  }, [weekly.tasks, todayDow]);

  const todaysHomeworkItems = homeworkByDate[todayStr] ?? [];

  const todaysProjectItems =
    projectsByDate[todayStr]?.map((p) => ({
      projectId: p.projectId,
      name: p.name,
      minutes: p.minutes,
    })) ?? [];

  /* ================================
     Render
     ================================ */
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Upcoming exams" value={exams.upcoming.length} icon="📝" />
        <StatCard title="Subjects" value={exams.subjectCount} icon="📚" />
        <StatCard title="Revision tasks" value={revision.tasks.length} icon="⏱️" />
      </div>

      <p className="mt-4 text-sm text-gray-500">
        Overview based on your current planner data
      </p>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <section className="rounded-xl border bg-white p-6">
            <DailyChecklist
                date={todayDate}
                revisionSlots={todaysRevisionSlots}
                />
          </section>
        </div>

        <div className="space-y-6">
          <TomorrowChecklist />
          <ComingUp />
        </div>
      </div>
    </>
  );
}
