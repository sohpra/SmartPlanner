"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Suspense } from 'react';
import { useSearchParams } from "next/navigation";
import { Rocket, ShieldCheck, Target, Calendar, Trophy, Clock } from "lucide-react";
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

  // 🎯 LIVE STATS STATE
  const [stats, setStats] = useState<{ 
    current_streak: number; 
    longest_streak: number; 
    elite_count: number 
  } | null>(null);

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

  const activeProjects = useMemo(() => {
    return (projects || []).filter((p: any) => p.status === 'active');
  }, [projects]);

  const futureRevision = useMemo(() => {
    return (revisionSlots || [])
      .filter((slot: any) => slot.date > today && !slot.is_completed)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [revisionSlots, today]);

  // 🎯 TRUTH CONSTANTS
  const todayPlan = activePlan?.days[0];
  const tomorrowPlan = activePlan?.days[1];
  
  const hasTasks = todayPlan ? todayPlan.plannedTaskCount > 0 : false;
  const isSecured = todayPlan ? todayPlan.completedTaskCount >= todayPlan.plannedTaskCount : false;
  const isElite = todayPlan && hasTasks ? todayPlan.completedTaskCount > todayPlan.plannedTaskCount : false;
  const bonusCount = todayPlan && isElite ? todayPlan.completedTaskCount - todayPlan.plannedTaskCount : 0;

  useEffect(() => {
    if (urlView === "weekly") setView("weekly");
    else if (urlView === "monthly") setView("monthly");
    else setView("daily");
  }, [urlView]);

  // FETCH LIVE STATS FROM DB
  useEffect(() => {
    const fetchStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('planner_stats')
        .select('current_streak, longest_streak, elite_count')
        .eq('user_id', user.id)
        .single();

      if (data) setStats(data);
    };

    fetchStats();
  }, [completions.allCompletions]); 

  // Auto sync stats
  useEffect(() => {
    if (!todayPlan) return;
    
    const syncStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Run the RPC to update the DB
        await supabase.rpc('sync_daily_stats', {
          target_user_id: user.id,
          is_mission_secured: isSecured, 
          is_elite_day: isElite,
          planned_count: todayPlan.plannedTaskCount,    
          completed_count: todayPlan.completedTaskCount 
        });

        // 2. 🎯 THE FIX: Fetch the NEWEST count immediately after the RPC
        const { data: newStats } = await supabase
          .from('planner_stats')
          .select('current_streak, longest_streak, elite_count')
          .eq('user_id', user.id)
          .single();

        if (newStats) {
          setStats(newStats); // This updates the top bar instantly
        }
      } catch (err) {
        console.error("Sync Error:", err);
      }
    };
    
    syncStats();
  }, [todayPlan?.completedTaskCount, todayPlan?.plannedTaskCount, isSecured, isElite]);

  // 🎉 Celebration Logic
  useEffect(() => {
    if (!todayPlan) return;
    
    if (isSecured && hasTasks && todayPlan.completedTaskCount > lastCelebratedCount.current) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: isElite ? ['#a855f7', '#d946ef', '#3b82f6'] : ['#10b981', '#3b82f6', '#60a5fa']
      });
    }
    lastCelebratedCount.current = todayPlan.completedTaskCount;
  }, [todayPlan?.completedTaskCount, todayPlan?.plannedTaskCount, isSecured, hasTasks, isElite]);
  
  if (!activePlan || !todayPlan) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="text-sm font-black uppercase tracking-widest text-gray-400 italic">Syncing Roadmap...</p>
        </div>
      </div>
    );
  }

  const checklistCompletions = {
    completed: completions.completed,
    toggle: completions.toggleDeadlineTask,
    dateKey: completions.dateKey,
    plannedTaskCount: todayPlan.plannedTaskCount,
    totalPlannedMinutes: todayPlan.totalPlanned,
  };

  return (
    <Suspense fallback={<div>Loading Plan Bee...</div>}>
      <main className="mx-auto max-w-[1400px] px-4 py-4 md:py-8 space-y-4 md:space-y-6">
        <DashboardHeader />

        {/* --- LIFETIME HERO BAR --- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-100">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current Streak</p>
              <p className="text-xl font-black italic text-emerald-600">{stats?.current_streak || 0} Days</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-100">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Longest Streak</p>
              <p className="text-xl font-black italic text-orange-600">{stats?.longest_streak || 0} Days</p>
            </div>
          </div>

          {/* Total Elite Days Card */}
          <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 group hover:shadow-lg transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-100 group-hover:rotate-6 transition-transform">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Elite Status</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xl font-black italic text-purple-600">{stats?.elite_count || 0}</p>
                <span className="text-xl font-black text-purple-600">Days</span>
              </div>
            </div>
          </div>
        </div>

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

                {/* --- TODAY METRICS BOXES --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Today's Mission Status */}
                <div className={`p-6 rounded-[2.5rem] border transition-all duration-500 relative overflow-hidden group ${
                  isElite 
                    ? 'bg-purple-50 border-purple-200 shadow-lg shadow-purple-100/20' 
                    : isSecured ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100 shadow-sm'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Mission Progress</p>
                    
                    <div className="flex gap-2">
                      {/* 🎯 ELITE TROPHY (Only shows if isElite is true) */}
                      {isElite && (
                        <span className="bg-purple-600 text-white text-[8px] font-black px-2 py-1 rounded-full flex items-center gap-1 animate-in zoom-in duration-300">
                          <Trophy className="w-3 h-3" /> ELITE +{bonusCount}
                        </span>
                      )}
                      {/* SECURED BADGE */}
                      {isSecured && !isElite && (
                        <span className="bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded-full flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> SECURED
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2 relative z-10">
                    <p className={`text-6xl font-black italic tracking-tighter transition-colors ${
                      isElite ? 'text-purple-600' : isSecured ? 'text-emerald-600' : 'text-slate-900'
                    }`}>
                      {todayPlan.completedTaskCount}
                    </p>
                    <p className="text-2xl font-bold text-gray-300 not-italic">/ {todayPlan.plannedTaskCount}</p>
                  </div>
                </div>
               

                {/* Workload Progress */}
                <div className={`p-6 bg-white rounded-[2.5rem] border transition-all duration-500 ${
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
                      <div className="flex justify-between items-center text-[10px] font-black uppercase italic">
                        <p className={todayPlan.totalCompleted >= todayPlan.totalPlanned ? 'text-emerald-600' : 'text-slate-500'}>
                          {todayPlan.totalCompleted >= todayPlan.totalPlanned ? 'Peak Performance' : 'On the way'}
                        </p>
                        <span className={todayPlan.totalCompleted >= todayPlan.totalPlanned ? 'text-emerald-600' : 'text-slate-900'}>
                          {Math.round((todayPlan.totalCompleted / (todayPlan.totalPlanned || 1)) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
                <section className="bg-white p-1 rounded-[2.1rem] ring-4 ring-blue-600/10 border border-blue-600/20">
                  <div className="bg-white p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-6 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-600" />Priority Checklist</h3>
                    <DailyChecklist 
                      day={todayPlan} 
                      completions={checklistCompletions} 
                      allProjects={activeProjects}
                      upcomingRevision={futureRevision}
                    />                  
                  </div>
                </section>
              </div>
            )}

            {view === "weekly" && <div className="animate-in fade-in zoom-in-95 duration-300"><WeeklyView plan={activePlan} exams={exams.upcoming || []} projects={projects || []} /></div>}
            {view === "monthly" && <div className="animate-in fade-in zoom-in-95 duration-300"><MonthView plan={activePlan} exams={exams.upcoming || []} projects={projects || []} /></div>}    
          </div>

          {view === "daily" && tomorrowPlan && (
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