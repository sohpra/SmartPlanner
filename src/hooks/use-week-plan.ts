"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";

import { buildWeekPlan, type WeekPlan } from "@/lib/planner/buildWeekPlan";

/**
 * IMPORTANT:
 * - This hook creates a SNAPSHOT of planner inputs.
 * - The plan does NOT refresh automatically when DB data changes.
 * - The plan refreshes ONLY when `refresh()` is called.
 * - The view (today/tomorrow) can roll forward at midnight without regenerating the plan.
 */

function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type SnapshotInputs = {
  today: string; // YYYY-MM-DD anchor for the plan window
  numDays: number;

  weeklyTasks: {
    id: string;
    name: string;
    duration_minutes: number;
    day_of_week: number;
  }[];

  deadlines: {
    id: string;
    name: string;
    due_date: string;
    estimated_minutes: number;
  }[];

  exams: {
    id: string;
    subject: string | null;
    exam_type: "Internal" | "Board" | "Competitive";
    date: string;
    preparedness: number | null;
  }[];

  projects: {
    id: string;
    name: string;
    subject: string | null;
    due_date: string;
    estimated_minutes: number;
    completed_minutes: number;
    status: "active" | "completed" | "paused";
  }[];
};

export function useWeekPlan(numDays = 7): {
  weekPlan: WeekPlan | null;
  snapshotStart: string | null;
  refresh: () => void;
  isLoading: boolean;
} {
  const weekly = useWeeklyTasks();
  const deadlines = useDeadlineTasks();
  const exams = useExams();
  const projects = useProjects();

  const isLoading =
    weekly.isLoading ||
    deadlines.isLoading ||
    exams.loading ||
    projects.isLoading;


  const [snapshot, setSnapshot] = useState<SnapshotInputs | null>(null);

  // Initial snapshot: take it ONCE when everything is loaded.
  useEffect(() => {
    if (snapshot) return;
    if (isLoading) return;

    setSnapshot({
      today: localDateKey(new Date()),
      numDays,
      weeklyTasks: weekly.tasks,
      deadlines: deadlines.tasks,
      exams: exams.upcoming,
      projects: projects.projects,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const refresh = useCallback(() => {
    // Explicit re-plan: capture current DB state.
    setSnapshot({
      today: localDateKey(new Date()),
      numDays,
      weeklyTasks: weekly.tasks,
      deadlines: deadlines.tasks,
      exams: exams.upcoming,
      projects: projects.projects,
    });
  }, [numDays, weekly.tasks, deadlines.tasks, exams.upcoming, projects.projects]);

  const weekPlan = useMemo(() => {
    if (!snapshot) return null;

    return buildWeekPlan({
      today: snapshot.today,
      numDays: snapshot.numDays,
      weeklyTasks: snapshot.weeklyTasks,
      deadlines: snapshot.deadlines,
      exams: snapshot.exams,
      projects: snapshot.projects,
    });
  }, [snapshot]);

  return {
    weekPlan,
    snapshotStart: snapshot?.today ?? null,
    refresh,
    isLoading,
  };
}
