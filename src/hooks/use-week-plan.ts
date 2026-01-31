"use client";

import { useMemo } from "react";

import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";

import { buildWeekPlan } from "@/lib/planner/buildWeekPlan";
import { toDateOnly } from "@/lib/planner/revisionEngine";

export function useWeekPlan() {
  const weekly = useWeeklyTasks();
  const deadlines = useDeadlineTasks();
  const exams = useExams();
  const projects = useProjects();

  return useMemo(() => {
    return buildWeekPlan({
      today: toDateOnly(new Date().toISOString()),
      weeklyTasks: weekly.tasks,
      deadlines: deadlines.tasks,
      exams: exams.upcoming,
      projects: projects.projects,
    });
  }, [weekly.tasks, deadlines.tasks, exams.upcoming, projects.projects]);
}
