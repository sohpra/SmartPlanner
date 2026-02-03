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
  const { projects, isLoading: projectsLoading } = useProjects();
  const { tasks: deadlines, isLoading: deadlinesLoading } = useDeadlineTasks();
  const { tasks: weeklyTasks, isLoading: weeklyLoading } = useWeeklyTasks();
  const completions = useDailyCompletions(new Date());

  // 2. VIEW STATE
  const [view, setView] = useState<"daily" | "weekly" | "monthly">("daily");

  // 3. THE DYNAMIC ENGINE (Reactive to every database change)
  const activePlan = useMemo(() => {
    const isDataLoaded = !exams.loading && !projectsLoading && !deadlinesLoading && !weeklyLoading;
    
    if (!isDataLoaded) return null;

    // This now runs the new "Sticky Homework" and "Golden Slot" logic
    return buildWeekPlan({
      today,
      numDays: 30,
      weeklyTasks,
      deadlines,
      exams: exams.upcoming,
      projects,
    });
  }, [today, exams.upcoming, projects, deadlines, weeklyTasks, exams.loading, projectsLoading, deadlinesLoading, weeklyLoading]);

  // Loading State
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

  // Completion props for the checklist
  const checklistCompletions = {
    completed: completions.completed,
    toggle: completions.toggleDeadlineTask,
    dateKey: completions.dateKey,
  };

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-8">
      <DashboardHeader />

      {/* 🎛️ Navigation & View Switcher */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          {["daily", "weekly", "monthly"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v as any)}
              className={`px-6 py-2 text-sm font-bold rounded-md capitalize transition-all ${
                view === v 
                  ? "bg-white shadow-md text-blue-600 scale-105" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Live Sync Active
        </div>
      </div>

      {/* 📊 Metrics & Main Content */}
      <div className={`grid grid-cols-1 gap-8 ${view === "daily" ? "lg:grid-cols-3" : "grid-cols-1"}`}>
        
        <div className={`${view === "daily" ? "lg:col-span-2" : "col-span-1"}`}>
          {view === "daily" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Simplified Top Metrics Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tasks completed</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-black text-gray-900">{completions.completed.size}</p>
                    <p className="text-lg font-bold text-gray-400">/ {todayPlan.weekly.items.length + todayPlan.homework.items.length + todayPlan.revision.slots.length}</p>
                  </div>
                </div>

                <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Study time today</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-black text-gray-900">
                      {Math.floor(todayPlan.totalUsed / 60)}h {todayPlan.totalUsed % 60}m
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Planned allocation</p>
                </div>
              </div>
              
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Today's Focus</h2>
                  {todayPlan.totalUsed > todayPlan.baseCapacity && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-3 py-1.5 rounded-full">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                      <span className="text-red-700 text-[10px] font-black uppercase tracking-wider">
                        Overloaded (+{todayPlan.totalUsed - todayPlan.baseCapacity}m)
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Unified Checklist Component */}
                <DailyChecklist 
                  day={todayPlan} 
                  completions={checklistCompletions} 
                />
              </section>
            </div>
          )}

          {view === "weekly" && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <WeeklyView plan={activePlan} />
            </div>
          )}

          {view === "monthly" && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <MonthView plan={activePlan} />
            </div>
          )}
        </div>

        {/* 📋 Sidebar - Clean Props-based approach */}
        {view === "daily" && (
          <aside className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <TomorrowChecklist day={tomorrowPlan} />
            <ComingUp deadlines={deadlines} exams={exams.upcoming} />
          </aside>
        )}
      </div>
    </main>
  );
}