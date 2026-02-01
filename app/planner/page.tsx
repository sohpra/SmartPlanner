"use client";

import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DashboardMetrics } from "../components/dashboard/DashboardMetrics";
import { DailyChecklist } from "../components/checklist/DailyChecklist";
import { TomorrowChecklist } from "../components/checklist/TomorrowChecklist";
import { ComingUp } from "../components/dashboard/ComingUp";

import { useWeekPlan } from "@/hooks/use-week-plan";
import { useDailyCompletions } from "@/hooks/use-daily-completions";
import { toDateOnly } from "@/lib/planner/revisionEngine";

/* ================================
   Helpers
================================ */

function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ================================
   Page
================================ */

export default function PlannerPage() {
  const today = new Date();
  const todayKey = localDateKey(today);

  const { weekPlan, refresh, snapshotStart, isLoading } = useWeekPlan(7);
  const { completed } = useDailyCompletions(today);

  if (isLoading || !weekPlan) {
    return <div className="p-6">Loading planner…</div>;
  }

  const todayPlan = weekPlan.days.find((d) => d.date === todayKey);

  // If today has moved beyond the snapshot window, show the user and force refresh.
  if (!todayPlan) {
    return (
      <div className="space-y-4">
        <DashboardHeader />
        <div className="rounded-xl border bg-white p-6">
          <div className="text-sm text-gray-600">
            Your plan snapshot starts on <strong>{snapshotStart}</strong>, but today is{" "}
            <strong>{toDateOnly(new Date().toISOString())}</strong>.
          </div>
          <div className="mt-4">
            <button
              onClick={refresh}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              Refresh plan
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ================================
     METRICS (FROM PLAN)
     NOTE: daily_completions.source_id is UUID.
     - weekly_task: OK (uuid)
     - project: OK (uuid)
     - revision: we can only track at examId level (uuid)
     - homework: NOT trackable unless you extend DB constraint to include 'deadline_task'
  ================================ */

  const weeklyKeys = todayPlan.weekly.items.map((t) => `weekly_task:${t.id}`);
  const projectKeys = todayPlan.projects.items.map((p) => `project:${p.projectId}`);

  // Track revision completion per examId (uuid). Multiple slots for same exam will share completion.
  const revisionExamKeys = Array.from(
    new Set(todayPlan.revision.slots.map((s) => `revision:${s.examId}`))
  );

  const trackableKeys = [...weeklyKeys, ...projectKeys, ...revisionExamKeys];

  const tasksCompleted = trackableKeys.filter((k) => completed.has(k)).length;
  const totalTasks = trackableKeys.length;

  const minutesPlanned =
    todayPlan.homework.minutes +
    todayPlan.weekly.minutes +
    todayPlan.revision.minutes +
    todayPlan.projects.minutes;

  /* ================================
     RENDER
  ================================ */

  return (
    <>
      {/* HEADER */}
      <div className="space-y-4">
        <DashboardHeader />

        {/* Refresh control (explicit re-plan) */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Plan snapshot: <span className="font-medium">{snapshotStart}</span>
          </div>

          <button
            onClick={refresh}
            className="rounded-lg border bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            title="Rebuild the plan using your latest tasks/exams/projects"
          >
            Refresh plan
          </button>
        </div>
      </div>

      {/* METRICS */}
      <DashboardMetrics
        tasksCompleted={tasksCompleted}
        totalTasks={totalTasks}
        minutesCompleted={0}
        minutesPlanned={minutesPlanned}
        upcomingExams={0 /* keep existing behaviour elsewhere for now */}
      />

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT */}
        <div className="lg:col-span-2">
          <section className="rounded-xl border bg-white p-6">
            <DailyChecklist
              date={today}
              weeklyItems={todayPlan.weekly.items}
              homeworkItems={todayPlan.homework.items}
              revisionSlots={todayPlan.revision.slots}
              projectItems={todayPlan.projects.items}
            />
          </section>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* These still read live data in their own components; we can migrate them later.
             Keeping them untouched avoids regressions right now. */}
          <TomorrowChecklist />
          <ComingUp />
        </div>
      </div>
    </>
  );
}
