"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";
import { useDailyCompletions } from "@/hooks/use-daily-completions";
import { buildWeekPlan, type WeekPlan } from "@/lib/planner/buildWeekPlan";

// Helper for date keys
function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type SnapshotInputs = {
  today: string;
  numDays: number;
  weeklyTasks: any[];
  deadlines: any[];
  exams: any[];
  projects: any[];
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
  
  // 🎯 1. Live Completions
  // This hook provides the real-time "checked" status without rebuilding the plan load.
  const { allCompletions } = useDailyCompletions(new Date());

  const isLoading =
    weekly.isLoading || deadlines.isLoading || exams.loading || projects.isLoading;

  const [snapshot, setSnapshot] = useState<SnapshotInputs | null>(null);
  
  // 🎯 2. Stability Lock
  // Prevents the snapshot from updating automatically when data hooks refresh.
  const hasInitialized = useRef(false);

  const buildSnapshot = useCallback((): SnapshotInputs => {
    return {
      today: localDateKey(new Date()),
      numDays,
      weeklyTasks: (weekly.tasks ?? []).map((t: any) => ({ ...t })),
      deadlines: (deadlines.tasks ?? []).map((t: any) => ({ ...t })),
      exams: (exams.upcoming ?? []).map((e: any) => ({ ...e })),
      projects: (projects.projects ?? []).map((p: any) => ({ ...p })),
    };
  }, [numDays, weekly.tasks, deadlines.tasks, exams.upcoming, projects.projects]);

  // 🎯 3. One-Time Initialization
  useEffect(() => {
    if (!isLoading && !hasInitialized.current) {
      setSnapshot(buildSnapshot());
      hasInitialized.current = true;
    }
  }, [isLoading, buildSnapshot]);

  const refresh = useCallback(() => {
    setSnapshot(buildSnapshot());
  }, [buildSnapshot]);

  const weekPlan = useMemo(() => {
    if (!snapshot) return null;

    // 🎯 4. Connect Static Plan to Live Progress
    return buildWeekPlan({
      today: snapshot.today,
      numDays: snapshot.numDays,
      weeklyTasks: snapshot.weeklyTasks,
      deadlines: snapshot.deadlines,
      exams: snapshot.exams,
      projects: snapshot.projects,
      completions: allCompletions, // This moves the bars
    });
  }, [snapshot, allCompletions]); 

  return {
    weekPlan,
    snapshotStart: snapshot?.today ?? null,
    refresh,
    isLoading,
  };
}