"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Components
import DailyChecklist from "../components/checklist/DailyChecklist";
import { TomorrowChecklist } from "../components/checklist/TomorrowChecklist";
import { WeeklyView } from "../components/dashboard/WeeklyView";
import { MonthView } from "../components/dashboard/MonthView"; 
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { ComingUp } from "../components/dashboard/ComingUp";

// Hooks
import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDailyCompletions } from "@/hooks/use-daily-completions";

// Logic
import { buildWeekPlan } from "@/lib/planner/buildWeekPlan";

export const dynamic = 'force-dynamic';

export default function PlannerPage() {
  const searchParams = useSearchParams();
  const urlView = searchParams.get("view");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  
  const [view, setView] = useState<"daily" | "weekly" | "monthly">("daily");

  useEffect(() => {
    if (urlView === "weekly") setView("weekly");
    else if (urlView === "monthly") setView("monthly");
    else setView("daily");
  }, [urlView]);

  const exams = useExams();
  const { projects = [], isLoading: projectsLoading } = useProjects();
  const { tasks: deadlines = [], isLoading: deadlinesLoading } = useDeadlineTasks();
  const { tasks: weeklyTasks = [], isLoading: weeklyLoading } = useWeeklyTasks();
  const completions = useDailyCompletions(new Date());

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
          <p className="text-sm font-black uppercase tracking-widest text-gray-400 italic">Syncing Roadmap...</p>
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

      {/* Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="inline-flex rounded-xl bg-gray-100 p-1 w-full sm:w-auto">
          {["daily", "weekly", "monthly"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v as any)}
              className={`flex-1 sm:flex-none px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                view === v 
                ? "bg-white shadow-sm text-blue-600" 
                : "text-gray-400 hover:text-gray-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* Main Content Area */}
        <div className={`${view === "daily" ? "lg:col-span-8" : "col-span-full"}`}>
          {view === "daily" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Today Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Active Window</p>
                  <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter">Today</h2>
                </div>
                {todayPlan.totalUsed > todayPlan.baseCapacity && (
                  <div className="bg-red-50 border border-red-100 px-4 py-1.5 rounded-full flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-700 text-[10px] font-black uppercase italic">Overload +{todayPlan.totalUsed - todayPlan.baseCapacity}m</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Completions</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-black text-slate-900">{completions.completed.size}</p>
                    <p className="text-sm font-bold text-slate-300">/ {todayPlan.weekly.items.length + todayPlan.homework.items.length + todayPlan.revision.slots.length}</p>
                  </div>
                </div>

                <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Load</p>
                  <p className="text-4xl font-black text-slate-900 italic">
                    {Math.floor(todayPlan.totalUsed / 60)}h <span className="text-xl text-blue-600 tracking-tighter">{todayPlan.totalUsed % 60}m</span>
                  </p>
                </div>
              </div>
              
              {/* 🎯 TODAY CONTAINER: The Blue Box focus */}
              <section className="bg-white p-1 rounded-[2.1rem] ring-4 ring-blue-600/10 border border-blue-600/20">
                <div className="bg-white p-6 rounded-[2rem]">
                  <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    Priority Checklist
                  </h3>
                  <DailyChecklist day={todayPlan} completions={checklistCompletions} />
                </div>
              </section>
            </div>
          )}

          {view === "weekly" && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <WeeklyView plan={activePlan} exams={exams.upcoming || []} projects={projects || []} />
            </div>
          )}

          {view === "monthly" && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <MonthView plan={activePlan} exams={exams.upcoming || []} projects={projects || []} />
            </div>
          )}    
        </div>

        {/* Sidebar Area */}
        {view === "daily" && (
          <aside className="lg:col-span-4 space-y-6 animate-in fade-in lg:slide-in-from-right-4 duration-500">
             {/* 🧊 Tomorrow: No more blue box, just clean cards */}
             <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Up Next</h3>
                <TomorrowChecklist day={tomorrowPlan} />
             </div>
             
             {/* 🏁 Milestones: Anchored below tomorrow */}
             <ComingUp projects={projects || []} exams={exams.upcoming || []} />
          </aside>
        )}
      </div>
    </main>
  );
}