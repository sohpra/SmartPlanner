"use client";

import React, { useMemo } from "react";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DashboardMetrics } from "../components/dashboard/DashboardMetrics";
import DailyChecklist from "../components/checklist/DailyChecklist";
import { TomorrowChecklist } from "../components/checklist/TomorrowChecklist";
import { ComingUp } from "../components/dashboard/ComingUp";

import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useDailyCompletions } from "@/hooks/use-daily-completions";
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { buildWeekPlan } from "@/lib/planner/buildWeekPlan";

export default function PlannerPage() {
  const todayDate = useMemo(() => new Date(), []);
  
  const { tasks: deadlines, isLoading: dlLoading } = useDeadlineTasks();
  const { upcoming: exams, loading: exLoading } = useExams();
  const { projects, isLoading: prLoading } = useProjects();
  const { tasks: weeklyTasks, isLoading: wkLoading } = useWeeklyTasks();
  
  const { completed, toggleDeadlineTask: toggle, dateKey } = useDailyCompletions(todayDate);

  const isLoading = dlLoading || exLoading || prLoading || wkLoading;

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

  // 🚀 FIXED METRICS CALCULATION
  const metrics = useMemo(() => {
    if (!todayPlan) return { done: 0, total: 0, minsDone: 0, minsTotal: 0 };

    const homework = todayPlan.homework.items.map((i: any) => ({ id: i.id, minutes: i.minutes, type: 'deadline_task' }));
    const weekly = todayPlan.weekly.items.map((i: any) => ({ id: i.id, minutes: i.minutes, type: 'weekly_task' }));
    const projs = todayPlan.projects.items.map((i: any) => ({ id: i.projectId, minutes: i.minutes, type: 'project' }));
    const revision = todayPlan.revision.slots.map((s: any, idx: number) => ({ id: `${s.examId}:${idx}`, minutes: s.slotMinutes, type: 'revision' }));

    const allItems = [...homework, ...weekly, ...projs, ...revision];

    let itemsDoneCount = 0;
    let minsDone = 0;

    allItems.forEach(item => {
      const key = `${item.type}:${item.id}:${dateKey}`;
      if (completed.has(key)) {
        itemsDoneCount++;
        minsDone += (item.minutes || 0);
      }
    });

    return {
      done: itemsDoneCount, // Use our calculated count, not completed.size
      total: allItems.length,
      minsDone,
      minsTotal: todayPlan.totalUsed || 0
    };
  }, [todayPlan, completed, dateKey]);

  if (isLoading || !todayPlan) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500 animate-pulse">Syncing your dashboard...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-12">
      <div className="mx-auto max-w-7xl px-4 pt-8 md:px-8">
        <DashboardHeader />

        <DashboardMetrics 
          tasksCompleted={metrics.done}
          totalTasks={metrics.total}
          minutesCompleted={metrics.minsDone}
          minutesPlanned={metrics.minsTotal}
          upcomingExams={exams?.length || 0}
          nextExamLabel={exams?.[0]?.subject ?? undefined}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-4">Today's Focus</h2>
              
              <DailyChecklist 
                day={todayPlan} 
                completions={{ 
                  completed, 
                  toggle, 
                  dateKey 
                }} 
              />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            {tomorrowPlan && <TomorrowChecklist day={tomorrowPlan} />}
            <ComingUp />
          </div>
        </div>
      </div>
    </main>
  );
}