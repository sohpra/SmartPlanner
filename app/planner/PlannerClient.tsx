"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Suspense } from 'react';
import { useSearchParams } from "next/navigation";
import { Rocket, ShieldCheck, Target, Calendar } from "lucide-react";
import confetti from 'canvas-confetti';
import { supabase } from "@/lib/supabase/client";

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
  const lastCelebratedCount = useRef(0);

  // 🎯 1. LIVE STATS STATE
  const [stats, setStats] = useState<{ current_streak: number; elite_count: number } | null>(null);

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

  // 🎯 2. FETCH LIVE STATS FROM DB
  useEffect(() => {
    const fetchStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('planner_stats')
        .select('current_streak, elite_count')
        .eq('user_id', user.id)
        .single();

      if (data) setStats(data);
    };

    fetchStats();
  }, [completions.allCompletions]); 

  // Auto sync count 
  useEffect(() => {
    if (!activePlan?.days[0]) return;
    
    const todayPlan = activePlan.days[0];
    const isSecured = todayPlan.completedTaskCount >= todayPlan.plannedTaskCount;
    const isElite = todayPlan.completedTaskCount > todayPlan.plannedTaskCount;
    
    // 🔥 FIX: Allow sync if tasks are completed, even if planned was 0
    const shouldSync = todayPlan.plannedTaskCount > 0 || todayPlan.completedTaskCount > 0;

    if (shouldSync) {
      const syncStats = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.rpc('sync_daily_stats', {
          target_user_id: user.id,
          is_mission_secured: isSecured,
          is_elite_day: isElite,
          planned_count: todayPlan.plannedTaskCount,    
          completed_count: todayPlan.completedTaskCount 
        });
      };
      
      syncStats();
    }
  }, [activePlan?.days[0]?.completedTaskCount, activePlan?.days[0]?.plannedTaskCount]);

  // 🎉 Confetti Celebration Logic
  useEffect(() => {
    if (!activePlan?.days[0]) return;
    const todayPlan = activePlan.days[0];
    const isFinished = todayPlan.completedTaskCount >= todayPlan.plannedTaskCount;
    const hasTasks = todayPlan.plannedTaskCount > 0;
    
    if (isFinished && hasTasks && todayPlan.completedTaskCount > lastCelebratedCount.current) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#60a5fa']
      });
    }
    lastCelebratedCount.current = todayPlan.completedTaskCount;
  }, [activePlan?.days[0]?.completedTaskCount, activePlan?.days[0]?.plannedTaskCount]);
  
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

// 🎯 UPDATE THIS in PlannerClient.tsx (around line 290)
  const checklistCompletions = {
    completed: completions.completed,
    toggle: completions.toggleDeadlineTask,
    dateKey: completions.dateKey,
    
    // ✅ Send the static counts to satisfy the new interface
    plannedTaskCount: todayPlan.plannedTaskCount,
    totalPlannedMinutes: todayPlan.totalPlanned,
  };

  return (
    <Suspense fallback={<div>Loading Plan Bee...</div>}>
      <main className="mx-auto max-w-[1400px] px-4 py-4 md:py-8 space-y-4 md:space-y-6">
        <DashboardHeader />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="inline-flex rounded-xl bg-gray-100 p-1 w-full sm:w-auto">
            {["daily", "weekly", "monthly"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v as any)}
                className={`flex-1 sm:flex-none px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  view === v ? "bg-white shadow-sm text-blue-600" : "text-gray-400 hover:text-gray-700"
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
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Active Window</p>
                    <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter">Today</h2>
                  </div>

                  <div className="flex flex-wrap items-center sm:justify-end gap-3">
                    <div className="flex items-center gap-2 bg-gradient-to-br from-orange-500 to-red-600 px-3 py-1.5 rounded-2xl shadow-lg shadow-orange-200 shrink-0">
                      <div className="relative">
                        <span className="absolute inset-0 bg-white rounded-full animate-ping opacity-20"></span>
                        <Rocket className="w-4 h-4 text-white fill-white" />
                      </div>
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] font-black text-orange-100 uppercase tracking-tighter">Streak</span>
                        <span className="text-sm font-black text-white italic">
                          {stats?.current_streak || 0} Days
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-2xl border border-gray-200/50">
                      <div className="group relative">
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all ${
                          todayPlan.completedTaskCount >= todayPlan.plannedTaskCount && todayPlan.plannedTaskCount > 0 
                          ? 'bg-emerald-500 shadow-sm' 
                          : 'bg-gray-300/50'
                        }`}>
                          <ShieldCheck className={`w-4 h-4 ${todayPlan.completedTaskCount >= todayPlan.plannedTaskCount ? 'text-white' : 'text-gray-400'}`} />
                        </div>
                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-slate-900 text-white text-[8px] font-black uppercase px-2 py-1 rounded whitespace-nowrap z-50">Mission Secured</div>
                      </div>

                      {/* 🎯 ELITE BADGE - Updated for Rest Day Support */}
                      <div className="group relative">
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-500 ${
                          todayPlan.completedTaskCount > todayPlan.plannedTaskCount 
                          ? 'bg-purple-600 shadow-lg shadow-purple-200' 
                          : 'bg-gray-300/50 opacity-40'
                        }`}>
                          <Target className={`w-4 h-4 ${
                            todayPlan.completedTaskCount > todayPlan.plannedTaskCount ? 'text-white' : 'text-gray-400'
                          }`} />
                        </div>
                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-slate-900 text-white text-[8px] font-black uppercase px-2 py-1 rounded whitespace-nowrap z-50 italic">
                          {todayPlan.completedTaskCount > todayPlan.plannedTaskCount ? 'Elite Performance' : 'Elite Status Locked'}
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const overage = todayPlan.totalPlanned - todayPlan.baseCapacity;
                      const todayLabel = capacityData?.labels[today];
                      const elements = [];
                      if (todayLabel) elements.push(<div key="override" className="bg-blue-600 px-3 py-1.5 rounded-full flex items-center gap-2 text-white text-[10px] font-black uppercase italic"><Calendar className="w-3 h-3" />{todayLabel} Mode</div>);
                      if (overage >= 15) elements.push(<div key="overload" className="bg-red-50 border border-red-100 px-3 py-1.5 rounded-full text-red-700 text-[10px] font-black uppercase italic">Overload +{overage}m</div>);
                      return elements;
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CARD 1: MISSION STATUS (CAPPED) */}
                  <div className={`p-6 bg-white rounded-3xl border transition-all duration-500 relative overflow-hidden group ${
                    todayPlan.completedTaskCount >= todayPlan.plannedTaskCount && todayPlan.plannedTaskCount > 0
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : 'border-gray-100 shadow-sm'
                  }`}>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 italic">Current Mission Status</p>
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-baseline gap-1">
                        <p className={`text-5xl font-black transition-colors duration-500 ${todayPlan.completedTaskCount >= todayPlan.plannedTaskCount ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {todayPlan.completedTaskCount}
                        </p>
                        <p className="text-xl font-bold text-slate-300 italic">/ {todayPlan.plannedTaskCount}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        {todayPlan.completedTaskCount >= todayPlan.plannedTaskCount && todayPlan.plannedTaskCount > 0 ? (
                          <div className="flex flex-col items-end animate-in fade-in duration-700">
                            <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center mb-1"><ShieldCheck className="w-4 h-4 text-emerald-600" /></div>
                            <p className="text-[9px] font-black text-emerald-600 uppercase italic">Mission Secured</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end opacity-60">
                            <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center mb-1"><Target className="w-4 h-4 text-blue-600 animate-pulse" /></div>
                            <p className="text-[9px] font-black text-slate-500 uppercase italic">Keep Going</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CARD 2: OUTPUT EFFICIENCY (CAPPED) */}
                  <div className={`p-6 bg-white rounded-3xl border transition-all duration-500 ${
                    todayPlan.totalCompleted >= todayPlan.totalPlanned ? 'border-emerald-100 bg-emerald-50/10' : 'border-gray-100 shadow-sm'
                  }`}>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 italic">Work Load</p>
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1">
                        <p className={`text-5xl font-black italic transition-colors duration-500 ${todayPlan.totalCompleted >= todayPlan.totalPlanned ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {Math.floor(todayPlan.totalCompleted / 60)}h<span className="text-2xl">{todayPlan.totalCompleted % 60}m</span>
                        </p>
                        <p className="text-xl font-bold text-slate-300 italic">/ {Math.floor(todayPlan.totalPlanned / 60)}h{todayPlan.totalPlanned % 60}m</p>
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden p-0.5">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${todayPlan.totalCompleted >= todayPlan.totalPlanned ? 'bg-emerald-500' : 'bg-blue-600'}`}
                            style={{ width: `${Math.min(100, (todayPlan.totalCompleted / (todayPlan.totalPlanned || 1)) * 100)}%` }} 
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          {todayPlan.totalCompleted >= todayPlan.totalPlanned && todayPlan.plannedTaskCount > 0 ? (
                            <p className="text-[10px] font-black uppercase italic text-emerald-600">Peak Performance</p>
                          ) : (
                            <p className="text-[10px] font-black uppercase italic text-slate-500">On the way</p>
                          )}
                          <div className={`text-[8px] font-black uppercase px-2 py-0.5 rounded italic tracking-tighter ${
                            todayPlan.totalCompleted >= todayPlan.totalPlanned ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
                          }`}>
                            {todayPlan.totalCompleted >= todayPlan.totalPlanned ? 'SECURED' : 'STEADY'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <section className="bg-white p-1 rounded-[2.1rem] ring-4 ring-blue-600/10 border border-blue-600/20">
                  <div className="bg-white p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-6 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-600" />Priority Checklist</h3>
                    <DailyChecklist day={todayPlan} completions={checklistCompletions} />
                  </div>
                </section>
              </div>
            )}

            {view === "weekly" && <div className="animate-in fade-in zoom-in-95 duration-300"><WeeklyView plan={activePlan} exams={exams.upcoming || []} projects={projects || []} /></div>}
            {view === "monthly" && <div className="animate-in fade-in zoom-in-95 duration-300"><MonthView plan={activePlan} exams={exams.upcoming || []} projects={projects || []} /></div>}    
          </div>

          {view === "daily" && (
            <aside className="lg:col-span-4 space-y-6 animate-in fade-in lg:slide-in-from-right-4 duration-500">
              <TomorrowChecklist day={tomorrowPlan} />
              <ComingUp projects={projects || []} exams={exams.upcoming || []} />
            </aside>
          )}
        </div>
      </main>
    </Suspense>
  );
}