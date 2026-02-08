"use client";

import { useMemo } from "react";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";
import { useDailyCompletions } from "@/hooks/use-daily-completions";
import { useRevision } from "./use-revision";
import { buildWeekPlan } from "@/lib/planner/buildWeekPlan";

export function useWeekPlan(numDays = 60) { // 🎯 Default to 60 for long-range planning
  const weekly = useWeeklyTasks();
  const deadlines = useDeadlineTasks();
  const exams = useExams();
  const projects = useProjects();
  const revision = useRevision(); 

  // 🎯 Generate real "Today" string (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Ensure completions hook uses the same dynamic date
  const { allCompletions } = useDailyCompletions(new Date(todayStr));

  const weekPlan = useMemo(() => {
    return buildWeekPlan({
      today: todayStr, // 🎯 Dynamic today
      numDays,
      weeklyTasks: weekly.tasks || [],
      deadlines: deadlines.tasks || [],
      exams: exams.upcoming || [],
      projects: projects.projects || [],
      revisionSlots: revision.slots || [], 
      completions: allCompletions,
    });
  }, [todayStr, numDays, weekly.tasks, deadlines.tasks, exams.upcoming, projects.projects, revision.slots, allCompletions]);

  return {
    weekPlan,
    snapshotStart: todayStr,
    // Add triggers for your specific hook refresh methods if they exist
    refresh: () => {
      if (exams.refresh) exams.refresh();
      console.log("Syncing all data to current date:", todayStr);
    },
    isLoading: revision.isLoading || exams.loading
  };
}