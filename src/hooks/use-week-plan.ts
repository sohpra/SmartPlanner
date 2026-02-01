"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";

import { buildWeekPlan, type WeekPlan } from "@/lib/planner/buildWeekPlan";

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

function storageKey(numDays: number) {
  return `smartplanner_weekplan_snapshot_v1_${numDays}`;
}

function safeParseSnapshot(raw: string | null): SnapshotInputs | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SnapshotInputs;

    // Minimal validation to avoid bricking the app on bad storage.
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.today !== "string") return null;
    if (typeof parsed.numDays !== "number") return null;
    if (!Array.isArray(parsed.weeklyTasks)) return null;
    if (!Array.isArray(parsed.deadlines)) return null;
    if (!Array.isArray(parsed.exams)) return null;
    if (!Array.isArray(parsed.projects)) return null;

    return parsed;
  } catch {
    return null;
  }
}

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

  // 🔒 Survives within a mount; sessionStorage survives remounts.
  const hasInitialised = useRef(false);

  // 1) On mount, try to restore snapshot from sessionStorage.
  useEffect(() => {
    if (hasInitialised.current) return;

    const restored =
      typeof window !== "undefined"
        ? safeParseSnapshot(sessionStorage.getItem(storageKey(numDays)))
        : null;

    if (restored) {
      hasInitialised.current = true;
      setSnapshot(restored);
    }
  }, [numDays]);

  // 2) If no restored snapshot, take the initial snapshot ONCE when loaded.
  useEffect(() => {
    if (hasInitialised.current) return;
    if (snapshot) return;
    if (isLoading) return;

    const initial: SnapshotInputs = {
      today: localDateKey(new Date()),
      numDays,
      weeklyTasks: weekly.tasks,
      deadlines: deadlines.tasks,
      exams: exams.upcoming,
      projects: projects.projects,
    };

    hasInitialised.current = true;
    setSnapshot(initial);

    // Persist it so a remount (e.g. router.refresh) does NOT auto-resnapshot.
    if (typeof window !== "undefined") {
      sessionStorage.setItem(storageKey(numDays), JSON.stringify(initial));
    }
  }, [
    isLoading,
    snapshot,
    numDays,
    weekly.tasks,
    deadlines.tasks,
    exams.upcoming,
    projects.projects,
  ]);

  // 3) Explicit refresh: overwrite snapshot + persist.
  const refresh = useCallback(() => {
    const next: SnapshotInputs = {
      today: localDateKey(new Date()),
      numDays,
      weeklyTasks: weekly.tasks,
      deadlines: deadlines.tasks,
      exams: exams.upcoming,
      projects: projects.projects,
    };

    setSnapshot(next);

    if (typeof window !== "undefined") {
      sessionStorage.setItem(storageKey(numDays), JSON.stringify(next));
    }
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
