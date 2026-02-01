"use client";

import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DashboardMetrics } from "../components/dashboard/DashboardMetrics";
import DailyChecklist from "../components/checklist/DailyChecklist";
import { TomorrowChecklist } from "../components/checklist/TomorrowChecklist";
import { ComingUp } from "../components/dashboard/ComingUp";

import { useWeekPlan } from "@/hooks/use-week-plan";
import { useDailyCompletions } from "@/hooks/use-daily-completions";
import { useExams } from "@/hooks/use-exams";

import type { DayPlan } from "@/lib/planner/buildWeekPlan";

/* ================================
   Helpers
================================ */

function daysUntil(dateStr: string) {
  const today = new Date();
  const target = new Date(dateStr);
  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

/* ================================
   Page
================================ */

export default function PlannerPage() {
  const { weekPlan, snapshotStart, refresh, isLoading } = useWeekPlan();
  const exams = useExams();

  /**
   * 🔒 IMPORTANT:
   * Hooks must be called unconditionally.
   * We use a fallback date until weekPlan is ready.
   */
  const safeTodayDate = weekPlan
    ? new Date(weekPlan.days[0].date + "T00:00:00")
    : new Date();

  const { completed } = useDailyCompletions(safeTodayDate);

  /* ================================
     LOADING STATE
  ================================ */

  if (isLoading || !weekPlan) {
    return (
      <div className="p-6 text-sm text-gray-500">
        Loading planner…
      </div>
    );
  }

  /* ================================
     DAY PLANS
  ================================ */

  const todayPlan: DayPlan = weekPlan.days[0];
  const tomorrowPlan: DayPlan | undefined = weekPlan.days[1];

  /* ================================
     METRICS (PLAN-BASED)
  ================================ */

  const completionKeys: string[] = [
    ...todayPlan.homework.items.map((t) => `deadline_task:${t.id}`),
    ...todayPlan.weekly.items.map((t) => `weekly_task:${t.id}`),
    ...todayPlan.projects.items.map((p) => `project:${p.projectId}`),
    // Revision intentionally excluded until enabled
  ];

  const tasksCompleted = completionKeys.filter((k) =>
    completed.has(k)
  ).length;

  const totalTasks =
    todayPlan.homework.items.length +
    todayPlan.weekly.items.length +
    todayPlan.projects.items.length +
    todayPlan.revision.slots.length;

  const minutesPlanned =
    todayPlan.weekly.minutes +
    todayPlan.homework.minutes +
    todayPlan.revision.minutes +
    todayPlan.projects.minutes;

  const minutesCompleted = 0; // future enhancement

  const isOverCapacity =
    todayPlan.totalUsed > todayPlan.baseCapacity;

  const nextExam = exams.upcoming[0];
  const nextExamLabel = nextExam
    ? `${nextExam.subject} in ${daysUntil(nextExam.date)} days`
    : undefined;

  /* ================================
     RENDER
  ================================ */

  return (
    <>
      {/* HEADER + REFRESH */}
      <div className="flex items-center justify-between mb-4">
        <DashboardHeader />

        <button
          onClick={refresh}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          🔄 Refresh plan
        </button>
      </div>

      {/* SNAPSHOT INFO */}
      <div className="mb-4 text-sm text-gray-500">
        Plan snapshot:{" "}
        <span className="font-medium">
          {snapshotStart}
        </span>

        {isOverCapacity && (
          <span className="ml-3 font-semibold text-red-600">
            ⚠ Over capacity today
          </span>
        )}
      </div>

      {/* METRICS */}
      <DashboardMetrics
        tasksCompleted={tasksCompleted}
        totalTasks={totalTasks}
        minutesCompleted={minutesCompleted}
        minutesPlanned={minutesPlanned}
        upcomingExams={exams.upcoming.length}
        nextExamLabel={nextExamLabel}
      />

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT */}
        <div className="lg:col-span-2">
          <section className="rounded-xl border bg-white p-6">
            <DailyChecklist day={todayPlan} />
          </section>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {tomorrowPlan && (
            <TomorrowChecklist day={tomorrowPlan} />
          )}
          <ComingUp />
        </div>
      </div>
    </>
  );
}
