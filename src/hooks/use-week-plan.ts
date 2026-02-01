"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  today: string;
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

function warnIfMissingIds(label: string, rows: any[]) {
  const bad = rows.filter((r) => !r?.id);
  if (bad.length > 0) {
    console.warn(`[useWeekPlan] ${label}: missing id rows`, bad);
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
    weekly.isLoading || deadlines.isLoading || exams.loading || projects.isLoading;

  const [snapshot, setSnapshot] = useState<SnapshotInputs | null>(null);

  const buildSnapshot = useCallback((): SnapshotInputs => {
    // 1) Weekly: map to engine shape + filter missing ids
    warnIfMissingIds("weekly.tasks", weekly.tasks as any[]);
    const weeklyTasks = (weekly.tasks ?? [])
      .filter((t: any) => !!t?.id)
      .map((t: any) => ({
        id: t.id as string,
        name: t.name as string,
        duration_minutes: Number(t.duration_minutes ?? 0),
        day_of_week: Number(t.day_of_week ?? 0),
      }));

    // 2) Deadlines: map to engine shape + filter missing ids
    warnIfMissingIds("deadline.tasks", deadlines.tasks as any[]);
    const deadlineTasks = (deadlines.tasks ?? [])
      .filter((t: any) => !!t?.id)
      .map((t: any) => ({
        id: t.id as string,
        name: t.name as string,
        due_date: t.due_date as string,
        estimated_minutes: Number(t.estimated_minutes ?? 0),
      }));

    // 3) Exams: use upcoming but still enforce ids
    warnIfMissingIds("exams.upcoming", exams.upcoming as any[]);
    const examInputs = (exams.upcoming ?? [])
      .filter((e: any) => !!e?.id)
      .map((e: any) => ({
        id: e.id as string,
        subject: (e.subject ?? null) as string | null,
        exam_type: e.exam_type as "Internal" | "Board" | "Competitive",
        date: e.date as string,
        preparedness: (e.preparedness ?? null) as number | null,
      }));

    // 4) Projects: enforce ids
    warnIfMissingIds("projects.projects", projects.projects as any[]);
    const projectInputs = (projects.projects ?? [])
      .filter((p: any) => !!p?.id)
      .map((p: any) => ({
        id: p.id as string,
        name: p.name as string,
        subject: (p.subject ?? null) as string | null,
        due_date: p.due_date as string,
        estimated_minutes: Number(p.estimated_minutes ?? 0),
        completed_minutes: Number(p.completed_minutes ?? 0),
        status: p.status as "active" | "completed" | "paused",
      }));

    return {
      today: localDateKey(new Date()),
      numDays,
      weeklyTasks,
      deadlines: deadlineTasks,
      exams: examInputs,
      projects: projectInputs,
    };
  }, [numDays, weekly.tasks, deadlines.tasks, exams.upcoming, projects.projects]);

  // Take initial snapshot ONCE when loaded
  useEffect(() => {
    if (snapshot) return;
    if (isLoading) return;
    setSnapshot(buildSnapshot());
  }, [snapshot, isLoading, buildSnapshot]);

  const refresh = useCallback(() => {
    setSnapshot(buildSnapshot());
  }, [buildSnapshot]);

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
