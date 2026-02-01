"use client";

import React, { useMemo } from "react";
// Components
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DashboardMetrics } from "../components/dashboard/DashboardMetrics";
import DailyChecklist from "../components/checklist/DailyChecklist";
import { TomorrowChecklist } from "../components/checklist/TomorrowChecklist";
import { ComingUp } from "../components/dashboard/ComingUp";

// Hooks
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useDailyCompletions } from "@/hooks/use-daily-completions";
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";

// Engine
import { buildWeekPlan } from "@/lib/planner/buildWeekPlan";

export default function PlannerPage() {
  // 1. Stable Date Logic
  const todayDate = useMemo(() => new Date(), []);
  const dateKey = useMemo(() => {
    const y = todayDate.getFullYear();
    const m = String(todayDate.getMonth() + 1).padStart(2, "0");
    const d = String(todayDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [todayDate]);

  // 2. Data Fetching
  const { tasks: deadlines, isLoading: dlLoading } = useDeadlineTasks();
  const { upcoming: exams, loading: exLoading } = useExams();
  const { projects, isLoading: prLoading } = useProjects();
  const { tasks: weeklyTasks, isLoading: wkLoading } = useWeeklyTasks();
  
  // 🚀 FIX: Map toggleDeadlineTask to 'toggle' to align with DailyChecklist props
  const { 
    completed, 
    toggleDeadlineTask: toggle, 
    isLoading: compLoading 
  } = useDailyCompletions(todayDate);

  const isLoading = dlLoading || exLoading || prLoading || wkLoading || compLoading;

  // 3. Engine Calculation
  const weekPlan = useMemo(() => {
    if (isLoading || !deadlines) return null;
    return buildWeekPlan({
      today: dateKey,
      numDays: 7,
      weeklyTasks: weeklyTasks || [],
      deadlines: deadlines || [],
      exams: exams || [],
      projects: projects || [],
    });
  }, [isLoading, dateKey, weeklyTasks, deadlines, exams, projects]);

  const todayPlan = weekPlan?.days?.[0] || null;
  const tomorrowPlan = weekPlan?.days?.[1] || null;

  // 4. Metrics Calculation
  const metrics = useMemo(() => {
    if (!todayPlan) return { done: 0, total: 0, minsDone: 0, minsTotal: 0 };

    const items = [
      ...todayPlan.homework.items.map((i: any) => ({ id: i.id, minutes: i.minutes, type: 'deadline_task' })),
      ...todayPlan.weekly.items.map((i: any) => ({ id: i.id, minutes: i.minutes, type: 'weekly_task' })),
      ...todayPlan.projects.items.map((i: any) => ({ id: i.projectId, minutes: i.minutes, type: 'project' })),
      ...todayPlan.revision.slots.map((s: any, idx: number) => ({ id: `${s.examId}:${idx}`, minutes: s.slotMinutes, type: 'revision' }))
    ];

    let minsDone = 0;
    items.forEach(item => {
      const key = `${item.type}:${item.id}:${dateKey}`;
      if (completed.has(key)) {
        minsDone += (item.minutes || 0);
      }
    });

    return {
      done: completed.size,
      total: items.length,
      minsDone,
      minsTotal: todayPlan.totalUsed || 0
    };
  }, [todayPlan, completed, dateKey]);

  if (isLoading || !todayPlan) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center animate-pulse">
          <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Optimizing your schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-12">
      <div className="mx-auto max-w-7xl px-4 pt-8 md:px-8">
        {/* Real-time Greetings & Time */}
        <DashboardHeader />

        {/* Dynamic Metrics */}
        <DashboardMetrics 
          tasksCompleted={metrics.done}
          totalTasks={metrics.total}
          minutesCompleted={metrics.minsDone}
          minutesPlanned={metrics.minsTotal}
          upcomingExams={exams?.length || 0}
          nextExamLabel={exams?.[0]?.subject ?? undefined}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Main Content: The Daily Checklist */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-6 text-xl font-bold text-gray-900">Today's Focus</h2>
              
              <DailyChecklist 
                day={todayPlan} 
                completions={{ 
                  completed, 
                  toggle, // Now correctly defined as toggleDeadlineTask
                  dateKey 
                }} 
              />
            </div>
          </div>

          {/* Sidebar: Lookahead and Milestones */}
          <div className="lg:col-span-4 space-y-6">
            {tomorrowPlan && <TomorrowChecklist day={tomorrowPlan} />}
            <ComingUp />
          </div>
        </div>
      </div>
    </main>
  );
}