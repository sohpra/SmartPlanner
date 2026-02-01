"use client";

import { useMemo } from "react";

import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";

import { buildWeekPlan } from "@/lib/planner/buildWeekPlan";
import { toDateOnly } from "@/lib/planner/revisionEngine";

export default function DashboardPage() {
  const weekly = useWeeklyTasks();
  const deadlines = useDeadlineTasks();
  const exams = useExams();
  const projects = useProjects();

  const todayKey = toDateOnly(new Date().toISOString());

  const weekPlan = useMemo(() => {
    if (
      weekly.isLoading ||
      deadlines.isLoading ||
      exams.loading ||
      projects.isLoading
    ) {
      return null;
    }

    return buildWeekPlan({
      today: todayKey,
      weeklyTasks: weekly.tasks,
      deadlines: deadlines.tasks,
      exams: exams.upcoming,
      projects: projects.projects,
    });
  }, [
    todayKey,
    weekly.isLoading,
    deadlines.isLoading,
    exams.loading,
    projects.isLoading,
    weekly.tasks,
    deadlines.tasks,
    exams.upcoming,
    projects.projects,
  ]);

  if (!weekPlan) {
    return <div className="p-8">Loading dashboard…</div>;
  }

  const todayPlan = weekPlan.days.find(d => d.date === todayKey);

  if (!todayPlan) {
    return (
      <div className="p-8 text-red-600">
        No plan found for today ({todayKey})
      </div>
    );
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">
        Dashboard (v2 – diagnostic)
      </h1>

      <p className="text-sm text-gray-500">
        Today: {todayKey}
      </p>

      <pre className="rounded-lg bg-gray-100 p-4 text-xs overflow-auto">
        {JSON.stringify(todayPlan, null, 2)}
      </pre>
    </div>
  );
}
