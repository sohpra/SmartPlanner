"use client";

import { useMemo, useState } from "react";
import DailyChecklist from "../components/checklist/DailyChecklist";
import { TomorrowChecklist } from "../components/checklist/TomorrowChecklist";
import { WeeklyView } from "../components/dashboard/WeeklyView";
import { MonthView } from "../components/dashboard/MonthView"; 
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DashboardMetrics } from "../components/dashboard/DashboardMetrics";
import { ComingUp } from "../components/dashboard/ComingUp";

// Hooks
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDailyCompletions } from "@/hooks/use-daily-completions";

// Logic
import { buildWeekPlan } from "@/lib/planner/buildWeekPlan";

export default function PlannerPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  
  // 1. LIVE DATA HOOKS
  const exams = useExams();
  const { projects = [], isLoading: projectsLoading } = useProjects();
  const { tasks: deadlines = [], isLoading: deadlinesLoading } = useDeadlineTasks();
  const { tasks: weeklyTasks = [], isLoading: weeklyLoading } = useWeeklyTasks();
  const completions = useDailyCompletions(new Date());

  const [view, setView] = useState<"daily" | "weekly" | "monthly">("daily");

  // 2. THE DYNAMIC ENGINE
  const activePlan = useMemo(() => {
    const isDataLoaded = !exams.loading && !projectsLoading && !deadlinesLoading && !weeklyLoading;
    if (!isDataLoaded) return null;

    return buildWeekPlan({
      today,
      numDays: 30,
      weeklyTasks,
      deadlines,
      exams: exams.upcoming || [],
      projects,
    });
  }, [today, exams.upcoming, projects, deadlines, weeklyTasks, exams.loading, projectsLoading, deadlinesLoading, weeklyLoading]);

  if (!activePlan) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="text-sm font-medium text-gray-500">Syncing your Smart Roadmap...</p>
        </div>
      </div>
    );
  }

  const todayPlan = activePlan.days[0];
  const tomorrowPlan = activePlan.days[1];

  const checklistCompletions = {
    completed: completions.completed,
    toggle: completions.toggleDeadlineTask,
    dateKey: completions.dateKey,
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-4 md:py-8 space-y-4 md:space-y-6">
      <DashboardHeader />

      {/* 🎛️ Responsive Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div className="inline-flex rounded-lg bg-gray-100 p-1 w-full sm:w-auto">
          {["daily", "weekly", "monthly"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v as any)}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs md:text-sm font-bold rounded-md capitalize transition-all ${
                view === v ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="hidden sm:block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Live Sync Active
        </div>
      </div>

      {/* 📊 Main Layout Grid: Responsive column spans */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* LEFT COLUMN: 8/12 of the width on desktop */}
        <div className={`${view === "daily" ? "lg:col-span-8" : "col-span-full"}`}>
          {view === "daily" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Today</h2>
                {todayPlan.totalUsed > todayPlan.baseCapacity && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-3 py-1 rounded-full">
                    <span className="text-red-700 text-[10px] font-black uppercase tracking-wider">
                      Overloaded (+{todayPlan.totalUsed - todayPlan.baseCapacity}m)
                    </span>
                  </div>
                )}
              </div>

              {/* COMPACT METRIC CARDS: Reduced padding for more vertical space */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 md:p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tasks completed</p>
                  <div className="flex items-baseline gap-1 md:gap-2">
                    <p className="text-2xl md:text-4xl font-black text-gray-900">{completions.completed.size}</p>
                    <p className="text-sm md:text-lg font-bold text-gray-400">
                      / {todayPlan.weekly.items.length + todayPlan.homework.items.length + todayPlan.revision.slots.length}
                    </p>
                  </div>
                </div>

                <div className="p-4 md:p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Planned Time</p>
                  <p className="text-2xl md:text-4xl font-black text-gray-900">
                    {Math.floor(todayPlan.totalUsed / 60)}h {todayPlan.totalUsed % 60}m
                  </p>
                </div>
              </div>
              
              <section>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Focus Areas</h3>
                <DailyChecklist day={todayPlan} completions={checklistCompletions} />
              </section>
            </div>
          )}

          {view === "weekly" && <WeeklyView plan={activePlan} />}
          {view === "monthly" && (
            <MonthView 
              plan={activePlan} 
              exams={exams.upcoming || []} 
              projects={projects || []} 
            />
          )}    
          </div>

        {/* RIGHT COLUMN: 4/12 of the width on desktop */}
        {view === "daily" && (
          <aside className="lg:col-span-4 space-y-6 animate-in fade-in lg:slide-in-from-right-4 duration-500">
            <TomorrowChecklist day={tomorrowPlan} />
            <ComingUp projects={projects || []} exams={exams.upcoming || []} />
          </aside>
        )}
      </div>
    </main>
  );
}