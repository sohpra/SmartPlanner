"use client";

import { useMemo } from "react";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";
import { useDailyCompletions } from "@/hooks/use-daily-completions";
import { useRevision } from "./use-revision";
import { buildWeekPlan } from "@/lib/planner/buildWeekPlan";

export function useWeekPlan(numDays = 7) {
  // 🎯 LOG 1: Is the hook function itself defined?
  const weekly = useWeeklyTasks();
  const deadlines = useDeadlineTasks();
  const exams = useExams();
  const projects = useProjects();
  const revision = useRevision(); 
  const { allCompletions } = useDailyCompletions(new Date());


  const weekPlan = useMemo(() => {
    return buildWeekPlan({
      today: "2026-02-08", // Force today for testing
      numDays,
      weeklyTasks: weekly.tasks || [],
      deadlines: deadlines.tasks || [],
      exams: exams.upcoming || [],
      projects: projects.projects || [],
      revisionSlots: revision.slots || [], 
      completions: allCompletions,
    });
  }, [numDays, weekly.tasks, deadlines.tasks, exams.upcoming, projects.projects, revision.slots, allCompletions]);

  return {
    weekPlan,
    snapshotStart: "2026-02-08",
    refresh: () => console.log("Refresh"),
    isLoading: revision.isLoading // Simplified for now
  };
}