"use client";

import { useMemo, useState, useEffect } from "react";
import { Suspense } from 'react';
import { useSearchParams } from "next/navigation";
import { Rocket, ShieldCheck, Target, Calendar } from "lucide-react";

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
import { usePlannerDeadlineTasks } from "@/hooks/use-planner-tasks";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useDailyCompletions } from "@/hooks/use-daily-completions";
import { usePlannerCapacity } from "@/hooks/use-planner-capacity"; 
import { useRevision } from "@/hooks/use-revision";

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
  const { 
    tasks: deadlines = [], 
    isLoading: deadlinesLoading, 
    updateTaskStatusLocally 
  } = usePlannerDeadlineTasks();

  const { tasks: weeklyTasks = [], isLoading: weeklyLoading } = useWeeklyTasks();
  const completions = useDailyCompletions(new Date(), updateTaskStatusLocally);
  const { slots: revisionSlots, isLoading: revisionLoading } = useRevision();
  const { capacityData, loading: capacityLoading } = usePlannerCapacity();

  const activePlan = useMemo(() => {
    const isDataLoaded = !exams.loading && !projectsLoading && !deadlinesLoading && !weeklyLoading && !capacityLoading && !revisionLoading;
    if (!isDataLoaded || !capacityData) return null;

    return buildWeekPlan({
      today,
      numDays: 60,
      weeklyTasks,
      deadlines,
      exams: exams.upcoming || [],
      projects,
      completions: completions.allCompletions || [],
      capacityData,
      revisionSlots, 
    });
  }, [
    today, exams.upcoming, projects, deadlines, weeklyTasks, 
    exams.loading, projectsLoading, deadlinesLoading, weeklyLoading, 
    completions.allCompletions, capacityData, capacityLoading, 
    revisionSlots, revisionLoading
  ]);
  
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
    <Suspense fallback={<div>Loading Plan Bee...</div>}>
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
          <div className={`${view === "daily" ? "lg:col-span-8" : "col-span-full"}`}>
            {view === "daily" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Today Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Active Window</p>
                    <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter">Today</h2>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {(() => {
                      const overage = todayPlan.totalPlanned - todayPlan.baseCapacity;
                      const hasSignificantOverdue = todayPlan.homework.items
                        .filter(i => i.isOverdue)
                        .reduce((sum, i) => sum + i.minutes, 0) >= 30;
                      
                      const todayLabel = capacityData?.labels[today];
                      const elements = [];

                      if (todayLabel) {
                        elements.push(
                          <div key="override" className="bg-blue-600 border border-blue-400 px-4 py-1.5 rounded-full flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                            <Calendar className="w-3 h-3 text-white" />
                            <span className="text-white text-[10px] font-black uppercase italic">{todayLabel} Mode</span>
                          </div>
                        );
                      }

                      if (overage > 0 && hasSignificantOverdue) {
                        elements.push(
                          <div key="recovery" className="bg-amber-50 border border-amber-100 px-4 py-1.5 rounded-full flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-amber-700 text-[10px] font-black uppercase italic">Recovery: +{overage}m</span>
                          </div>
                        );
                      } else if (overage >= 15) {
                        elements.push(
                          <div key="overload" className="bg-red-50 border border-red-100 px-4 py-1.5 rounded-full flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-red-700 text-[10px] font-black uppercase italic">Overload +{overage}m</span>
                          </div>
                        );
                      }
                      return elements;
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* --- CARD 1: MISSION STATUS --- */}
                  <div className={`p-6 bg-white rounded-3xl border transition-all duration-500 relative overflow-hidden group ${
                    todayPlan.completedTaskCount > todayPlan.plannedTaskCount 
                      ? 'ring-4 ring-emerald-500/20 border-emerald-100 shadow-[0_0_30px_-10px_rgba(16,185,129,0.4)]' 
                      : todayPlan.completedTaskCount === todayPlan.plannedTaskCount && todayPlan.plannedTaskCount > 0
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-gray-100 shadow-sm'
                  }`}>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 italic">Current Mission Status</p>
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-baseline gap-1">
                        <p className={`text-5xl font-black transition-colors duration-500 ${
                          todayPlan.completedTaskCount >= todayPlan.plannedTaskCount ? 'text-emerald-600' : 'text-slate-900'
                        }`}>
                          {todayPlan.completedTaskCount}
                        </p>
                        <p className="text-xl font-bold text-slate-300 italic">/ {todayPlan.plannedTaskCount}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        {todayPlan.completedTaskCount > todayPlan.plannedTaskCount ? (
                          <div className="flex flex-col items-end animate-in zoom-in-50 duration-500">
                            <div className="bg-emerald-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full mb-1 tracking-tighter">Legendary Performance</div>
                            <p className="text-[9px] font-black text-emerald-600 uppercase italic tracking-tighter flex items-center gap-1">
                              <Rocket className="w-3 h-3 animate-bounce" /> Over and beyond
                            </p>
                          </div>
                        ) : todayPlan.completedTaskCount === todayPlan.plannedTaskCount && todayPlan.plannedTaskCount > 0 ? (
                          <div className="flex flex-col items-end animate-in fade-in duration-700">
                            <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center mb-1"><ShieldCheck className="w-4 h-4 text-emerald-600" /></div>
                            <p className="text-[9px] font-black text-emerald-600 uppercase italic tracking-tighter">Well done</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end opacity-60">
                            <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center mb-1"><Target className="w-4 h-4 text-blue-600 animate-pulse" /></div>
                            <p className="text-[9px] font-black text-slate-500 uppercase italic tracking-tighter">Keep Going</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* --- CARD 2: OUTPUT EFFICIENCY --- */}
                  <div className={`p-6 bg-white rounded-3xl border transition-all duration-500 ${
                    todayPlan.totalCompleted >= todayPlan.totalPlanned 
                      ? 'border-emerald-100 bg-emerald-50/10' 
                      : 'border-gray-100 shadow-sm'
                  }`}>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 italic">Work load</p>
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1">
                        <p className={`text-5xl font-black italic transition-colors duration-500 ${
                          todayPlan.totalCompleted >= todayPlan.totalPlanned ? 'text-emerald-600' : 'text-slate-900'
                        }`}>
                          {Math.floor(todayPlan.totalCompleted / 60)}h<span className="text-2xl">{todayPlan.totalCompleted % 60}m</span>
                        </p>
                        <p className="text-xl font-bold text-slate-300 italic">/ {Math.floor(todayPlan.totalPlanned / 60)}h{todayPlan.totalPlanned % 60}m</p>
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden p-0.5">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${
                              todayPlan.totalCompleted > todayPlan.totalPlanned ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 
                              todayPlan.totalCompleted === todayPlan.totalPlanned ? 'bg-emerald-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${Math.min(100, (todayPlan.totalCompleted / (todayPlan.totalPlanned || 1)) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          {todayPlan.totalCompleted > todayPlan.totalPlanned ? (
                            <p className="text-[10px] font-black uppercase italic text-emerald-600 flex items-center gap-1.5">
                              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                              Breaking Frontiers: +{todayPlan.totalCompleted - todayPlan.totalPlanned}m
                            </p>
                          ) : todayPlan.totalCompleted === todayPlan.totalPlanned && todayPlan.totalPlanned > 0 ? (
                            <p className="text-[10px] font-black uppercase italic text-emerald-600">Peak Performance Attained</p>
                          ) : (
                            <p className="text-[10px] font-black uppercase italic text-slate-500">On the way</p>
                          )}
                          <div className={`text-[8px] font-black uppercase px-2 py-0.5 rounded italic tracking-tighter ${
                            todayPlan.totalCompleted > todayPlan.totalPlanned ? 'bg-emerald-600 text-white animate-bounce' : 
                            todayPlan.totalCompleted === todayPlan.totalPlanned ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
                          }`}>
                            {todayPlan.totalCompleted > todayPlan.totalPlanned ? 'GOD MODE' : todayPlan.totalCompleted === todayPlan.totalPlanned ? 'STREAK ACTIVE' : 'STEADY'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
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

          {view === "daily" && (
            <aside className="lg:col-span-4 space-y-6 animate-in fade-in lg:slide-in-from-right-4 duration-500">
              <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Up Next</h3>
                  <TomorrowChecklist day={tomorrowPlan} />
              </div>
              <ComingUp projects={projects || []} exams={exams.upcoming || []} />
            </aside>
          )}
        </div>
      </main>
    </Suspense>
  );
}