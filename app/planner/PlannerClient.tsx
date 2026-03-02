"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Suspense } from 'react';
import { useSearchParams } from "next/navigation";
import { Rocket, ShieldCheck, Target, Calendar, Trophy, Clock, Loader2, Circle, Shield, Diamond, Crown, Zap, Star } from "lucide-react";
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
import { syncRevisionSlots } from "@/lib/planner/revisionPersistence";

export const dynamic = 'force-dynamic';

export default function PlannerPage() {
  const searchParams = useSearchParams();
  const urlView = searchParams.get("view");
  // 🔴 FIX: today must re-compute at midnight, not stay frozen from mount time.
  // useMemo([]) permanently locks the date to the day the component first mounted.
  const getLocalISODate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
  };
  const [today, setToday] = useState(getLocalISODate);
  useEffect(() => {
    const msUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return midnight.getTime() - now.getTime();
    };
    const scheduleRoll = () => {
      const t = setTimeout(() => {
        setToday(getLocalISODate());
        scheduleRoll();
      }, msUntilMidnight());
      return t;
    };
    const t = scheduleRoll();
    return () => clearTimeout(t);
  }, []);
  const [view, setView] = useState<"daily" | "weekly" | "monthly">("daily");
  
  const lastSyncedMins = useRef<number | null>(null);
  
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hoveredTrophyDays, setHoveredTrophyDays] = useState<number | null>(null);
  
  // 🟡 FIX: dbBonusMins was set but never read — removed.
  // setDbBonusMins kept only for hydration seeding of localBonusMins.
  const [localBonusMins, setLocalBonusMins] = useState(0);

  // 🎯 LIVE STATS STATE
  const [stats, setStats] = useState<{ 
    current_streak: number; 
    longest_streak: number; 
    elite_count: number;
    lifetime_bonus_mins: number; 
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
  const { slots: revisionSlots, isLoading: revisionLoading, refresh: refreshRevision } = useRevision();  const { capacityData, loading: capacityLoading, refresh: refreshCapacity } = usePlannerCapacity();

  const activePlan = useMemo(() => {
    // 🔴 FIX: Loading flags are NOT data — including them in the dep array caused
    // unnecessary re-runs. The actual gate is !!capacityData and the data arrays
    // being stable (hooks return [] while loading, not undefined).
    if (!capacityData) return null;

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
  }, [today, exams.upcoming, projects, deadlines, weeklyTasks, completions.allCompletions, capacityData, revisionSlots]);

  const activeProjects = useMemo(() => (projects || []).filter((p: any) => p.status === 'active'), [projects]);

  const futureRevision = useMemo(() => (revisionSlots || [])
    .filter((slot: any) => slot.date > today && !slot.is_completed)
    .sort((a: any, b: any) => a.date.localeCompare(b.date)), [revisionSlots, today]);

  // 🎯 TRUTH CONSTANTS
  const todayPlan = activePlan?.days[0];
  const tomorrowPlan = activePlan?.days[1];
  const hasTasks = todayPlan ? todayPlan.plannedTaskCount > 0 : false;
  
  // 🚀 UNIFIED DISPLAY CALCULATION
const displayCompletedMins = useMemo(() => {
  const checklistMins = todayPlan?.totalCompleted || 0;
  // Checklist (Original + Pulled Forward) + Manual Buttons
  return checklistMins + localBonusMins;
}, [todayPlan?.totalCompleted, localBonusMins]);

  const isSecured = todayPlan ? (
    todayPlan.completedTaskCount >= todayPlan.plannedTaskCount || 
    (todayPlan.totalPlanned > 0 && displayCompletedMins >= todayPlan.totalPlanned)
  ) : false;  
  const isElite = todayPlan && hasTasks ? (
    // 🎯 Higher priority: Did they actually finish more items than planned?
    todayPlan.completedTaskCount > todayPlan.plannedTaskCount || 
    
    // 🎯 Minute check: Only if they are substantially over the plan
    // and the mission is already secured (prevents elite triggering mid-day)
    (isSecured && displayCompletedMins >= (todayPlan.totalPlanned + 15))
  ) : false;

  const bonusCount = todayPlan && isElite ? todayPlan.completedTaskCount - todayPlan.plannedTaskCount : 0;

  useEffect(() => {
    if (urlView === "weekly") setView("weekly");
    else if (urlView === "monthly") setView("monthly");
    else setView("daily");
  }, [urlView]);

  // 🎯 FETCH LIVE STATS & HYDRATE BONUS
  // Replace lines 155-181 with:
  useEffect(() => {
    const fetchStatsAndHistory = async () => {
      if (!todayPlan) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Master Stats
      const { data: statsData } = await supabase.from('planner_stats').select('*').eq('user_id', user.id).single();
      if (statsData) setStats(statsData);

      // 2. Today's Specifics
      const { data: todayData } = await supabase
        .from('daily_stats')
        .select('manual_bonus_mins, mins_completed')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (todayData) {
        // 🎯 THE FIX: Directly seed the button bucket. 
        // Pulled tasks are already accounted for in todayPlan.totalCompleted.
        setLocalBonusMins(todayData.manual_bonus_mins || 0);
        lastSyncedMins.current = (todayPlan.totalCompleted || 0) + (todayData.manual_bonus_mins || 0);
      }
      setIsHydrating(false);
    };

    fetchStatsAndHistory();
  }, [today, !!todayPlan]); // Use !!todayPlan to run once plan exists

 const handleFullSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncRevisionSlots();
      if (result.success) {
        // 🟡 FIX: These three refreshes are independent — run them concurrently.
        await Promise.all([
          completions.refresh(),
          refreshRevision(),
          refreshCapacity(),
        ]);
        console.log("Roadmap successfully re-shuffled.");
      }
    } catch (err) {
      console.error("Manual Sync Failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

// 🎯 1. THE ACTION: Just updates local state to trigger the UI and the Sync effect
  const handleBonusEffort = (minutes: number) => {
    // 🛡️ Safety: Don't allow logging while data is unstable
    if (!todayPlan || isHydrating) return;

    // 🚀 Instant UI Update
    setLocalBonusMins(prev => prev + minutes);
    
    // 🎉 Celebration
    confetti({ 
      particleCount: 40, 
      spread: 50, 
      origin: { y: 0.8 }, 
      colors: ['#a855f7', '#d946ef'] 
    });

    // 🎯 Note: The actual Supabase RPC call is now handled exclusively 
    // by the syncStats useEffect below to prevent "Double-Tapping".
  };

  // 🎯 2. THE SYNC: One single "Pipe" to the database
  useEffect(() => {
    // 🎯 FIX: Allow sync even if plannedTaskCount is 0, as long as there is 
    // completed work or bonus minutes to record.
    if (isHydrating || !todayPlan) return;
    
    // Only skip if the day is truly untouched
    const hasAnyActivity = (todayPlan.completedTaskCount > 0 || localBonusMins > 0);
    if (!hasAnyActivity) return;

    // Replace the syncStats block (lines 201-224) with:
    const syncStats = async () => {
      const checklistMins = todayPlan.totalCompleted || 0;
      const totalToSave = checklistMins + localBonusMins;

      if (totalToSave === lastSyncedMins.current) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 🎯 CRITICAL: Pass 'localBonusMins' as the new argument
        await supabase.rpc('sync_daily_stats', {
          target_user_id: user.id, 
          is_mission_secured: isSecured, 
          is_elite_day: isElite,
          planned_count: todayPlan.plannedTaskCount || 0, 
          completed_count: todayPlan.completedTaskCount || 0,
          planned_mins: todayPlan.totalPlanned || 0, 
          completed_mins: checklistMins, // Raw checklist work
          added_manual_mins: localBonusMins // 🎯 New Manual Bucket
        });

        lastSyncedMins.current = totalToSave;

        const { data: newStats } = await supabase
          .from('planner_stats')
          .select('current_streak, longest_streak, elite_count, lifetime_bonus_mins')
          .eq('user_id', user.id)
          .single();
        if (newStats) setStats(newStats);
        
      } catch (err) { 
        console.error("❌ STATS SYNC ERROR:", err); 
      }
    };

    const timer = setTimeout(syncStats, 1500); // Debounce to prevent spam
    return () => clearTimeout(timer);

  }, [
    todayPlan?.completedTaskCount, 
    todayPlan?.totalCompleted, 
    todayPlan?.plannedTaskCount, 
    isSecured, 
    isElite, 
    isHydrating, 
    localBonusMins
  ]);
  
  // 🎉 Celebration Logic
  // Track both completedTaskCount AND isSecured so confetti only fires
  // when the task actually completes the mission, not on every re-memoize.
  const wasSecured = useRef(false);

  useEffect(() => {
    // 🎯 Only fire if we WEREN'T secured, and now we ARE
    if (isSecured && !wasSecured.current && hasTasks) {
      confetti({
        particleCount: 150, 
        spread: 70, 
        origin: { y: 0.6 },
        colors: isElite ? ['#a855f7', '#d946ef', '#3b82f6'] : ['#10b981', '#3b82f6', '#60a5fa']
      });
    }
    
    // Update the "Memory" of the secured state
    wasSecured.current = isSecured;
  }, [isSecured, hasTasks, isElite]);

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
  // Define your milestones
  // 🏆 Milestone Logic for Streak Progress
    const milestones = [
    { days: 0, label: 'Novice' },
    { days: 14, label: 'Bronze' },
    { days: 25, label: 'Silver' },
    { days: 50, label: 'Gold' },
    { days: 100, label: 'Platinum' },
    { days: 150, label: 'Emerald' },
    { days: 250, label: 'Diamond' },
    { days: 365, label: 'Legendary' }
  ];

  const currentStreak = stats?.current_streak || 0;
  const longestStreak = stats?.longest_streak || 0;

  // Current and Next Badge Logic
  const currentBadge = [...milestones].reverse().find(m => m.days <= currentStreak) || milestones[0];
  const nextBadge = milestones.find(m => m.days > currentStreak) || milestones[milestones.length - 1];

  const progressTowardsNext = nextBadge.days > currentBadge.days 
    ? Math.min(100, ((currentStreak - currentBadge.days) / (nextBadge.days - currentBadge.days)) * 100)
    : 100;

  // 🎯 TROPHY CASE CONFIG (Mapped to your new milestones)
  const trophyMilestones = [
    { days: 14,  label: 'Bronze',    icon: Shield,  color: 'text-orange-700',   bg: 'bg-orange-50' },
    { days: 25,  label: 'Silver',    icon: Star,  color: 'text-slate-400',    bg: 'bg-slate-50' },
    { days: 50,  label: 'Gold',      icon: Zap,     color: 'text-yellow-500',   bg: 'bg-yellow-50' },
    { days: 100, label: 'Platinum',  icon: Trophy,    color: 'text-cyan-400',     bg: 'bg-cyan-50' },
    { days: 150, label: 'Emerald',   icon: Diamond, color: 'text-emerald-500',  bg: 'bg-emerald-50' },
    { days: 250, label: 'Diamond',   icon: Diamond, color: 'text-blue-500',     bg: 'bg-blue-50' },
    { days: 365, label: 'Legendary', icon: Crown,   color: 'text-purple-600',   bg: 'bg-purple-100' },
  ];

  return (
    <Suspense fallback={<div>Loading Plan Bee...</div>}>
      <main className="mx-auto max-w-[1400px] px-4 py-4 md:py-8 space-y-4 md:space-y-6">
        <DashboardHeader />

        {/* 📊 TOP STATS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          
          {/* 🟢 CURRENT STREAK + BADGE IDENTITY */}
          <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all duration-300">
            
            {/* Header Row: Aligned icon and label */}
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-100 text-white group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex-1 pt-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Status</p>
                <div className="flex items-baseline justify-between">
                  {/* HERO: The Badge Name */}
                  <p className="text-xl font-black italic text-emerald-600">
                    {currentBadge.label} <span className="text-[10px] not-italic text-slate-400">({currentStreak}d)</span>
                  </p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase italic">Rank</p>
                </div>
              </div>
            </div>

            {/* Progress Area: Aligned with the Trophy Case row */}
            <div className="mt-3 space-y-2">
              <div className="h-1.5 w-full bg-emerald-50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progressTowardsNext}%` }}
                />
              </div>
              
              {/* Consistent bottom caption */}
              <div className="min-h-[12px]">
                <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">
                  {nextBadge.days - currentStreak} days until {nextBadge.label} status
                </p>
              </div>
            </div>
          </div>

        {/* 🟠 LONGEST STREAK + TROPHY CASE */}
          <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col justify-between group hover:shadow-lg transition-all duration-300">
            
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-100 text-white group-hover:scale-110 transition-transform">
                <Rocket className="w-6 h-6" />
              </div>
              <div className="flex-1 pt-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Longest Streak</p>
                <div className="flex items-baseline justify-between">
                  <p className="text-xl font-black italic text-orange-600">
                    {longestStreak} Days
                  </p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase italic">Personal Best</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 mb-2">
            {trophyMilestones.map((m) => {
              const isUnlocked = longestStreak >= m.days;
              const isNext = longestStreak < m.days && 
                            (trophyMilestones.find(prev => prev.days > longestStreak)?.days === m.days);
              const Icon = m.icon; 
              return (
                <div 
                  key={m.days}
                  onMouseEnter={() => setHoveredTrophyDays(m.days)}
                  onMouseLeave={() => setHoveredTrophyDays(null)}
                  className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-500 relative ${
                    isUnlocked 
                      ? `${m.bg} ${m.color} scale-110 shadow-[0_0_10px_rgba(0,0,0,0.05)] border border-white/50` 
                      : isNext 
                        ? 'bg-gray-50 text-gray-300 animate-pulse border border-dashed border-gray-200' 
                        : 'bg-gray-50 text-gray-100 grayscale opacity-10'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isUnlocked ? 'drop-shadow-md' : ''}`} />
                  
                  {/* 🎇 Special "Glow" for high-tier unlocked badges */}
                  {isUnlocked && m.days >= 100 && (
                    <div className={`absolute inset-0 rounded-xl animate-ping opacity-20 ${m.bg}`} />
                  )}
                </div>
              );
            })}
          </div>
          </div>
          
          {/* 🟣 ELITE STATUS */}
          <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col group hover:shadow-lg transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-100 group-hover:rotate-6 transition-transform">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 pt-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Elite Status</p>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-black italic text-purple-600">{stats?.elite_count || 0} Days</p>
                  <div className="flex flex-col items-end">
                    <span className="text-[14px] font-black text-emerald-500 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> {Math.floor((stats?.lifetime_bonus_mins || 0) / 60)}h {(stats?.lifetime_bonus_mins || 0) % 60}m
                    </span>
                    <p className="text-[8px] font-bold text-gray-400 uppercase italic">Banked</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
       <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          {todayPlan.totalPlanned > todayPlan.baseCapacity + 15 ? (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100">
              <Clock className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Over Capacity</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Plan Balanced</span>
            </div>
          )}
        </div>

        <button 
          onClick={handleFullSync} 
          disabled={isSyncing} 
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 disabled:opacity-50"
        >
          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} 
          Re-Shuffle Roadmap
        </button>
      </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="inline-flex rounded-xl bg-gray-100 p-1 w-full sm:w-auto">
            {["daily", "weekly", "monthly"].map((v) => (
              <button key={v} onClick={() => setView(v as any)} className={`flex-1 sm:flex-none px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${view === v ? "bg-white shadow-sm text-blue-600" : "text-gray-400 hover:text-gray-700"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
          
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
          <div className={`${view === "daily" ? "lg:col-span-8" : "col-span-full"}`}>
            {view === "daily" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Active Window</p>
                    <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter">Today</h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MetricCard title="Mission Progress" val={todayPlan.completedTaskCount} total={todayPlan.plannedTaskCount} isElite={isElite} isSecured={isSecured} bonusCount={bonusCount} />
                  
                  <div className={`p-6 rounded-[2.5rem] border transition-all duration-500 ${isElite ? 'bg-purple-50 border-purple-200 shadow-lg' : isSecured ? 'border-emerald-100 bg-emerald-50/10' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Work Load</p>
                      {displayCompletedMins > todayPlan.totalPlanned && (
                        <span className="bg-purple-600 text-white text-[7px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"><Clock className="w-2.5 h-2.5" /> +{displayCompletedMins - todayPlan.totalPlanned}m BONUS</span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1">
                        <p className={`text-5xl font-black italic transition-colors ${isElite ? 'text-purple-600' : isSecured ? 'text-emerald-600' : 'text-slate-900'}`}>{Math.floor(displayCompletedMins / 60)}h<span className="text-2xl">{displayCompletedMins % 60}m</span></p>
                        <p className="text-xl font-bold text-slate-300 italic">/ {Math.floor(todayPlan.totalPlanned / 60)}h{todayPlan.totalPlanned % 60}m</p>
                      </div>
                      <div className="mt-4 h-3 w-full bg-gray-100 rounded-full overflow-hidden p-0.5">
                        <div className={`h-full rounded-full transition-all duration-1000 ${isElite ? 'bg-purple-500' : isSecured ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, (displayCompletedMins / (todayPlan.totalPlanned || 1)) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <section className="bg-white p-1 rounded-[2.1rem] ring-4 ring-blue-600/10 border border-blue-600/20">
                  <div className="bg-white p-6 rounded-[2rem]">
                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-6 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-600" />Priority Checklist</h3>
                    <DailyChecklist day={todayPlan} completions={checklistCompletions} allProjects={activeProjects} upcomingRevision={futureRevision} />                  
                  </div>
                </section>

                <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
                  <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 italic">Go Beyond the Plan</p><p className="text-[9px] text-slate-400 font-medium">Log extra heart and soul into today's work.</p></div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleBonusEffort(15)} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-purple-50 text-purple-600 text-[10px] font-black uppercase tracking-widest border border-purple-100 hover:bg-purple-600 hover:text-white transition-all group shadow-sm"><Clock className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" /> +15m Effort</button>
                    <button onClick={() => handleBonusEffort(30)} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white text-[10px] font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all group"><Rocket className="w-3.5 h-3.5 group-hover:animate-bounce" /> Elite Session (+30m)</button>
                  </div>
                </div>
              </div>
            )}
            {view === "weekly" && <div className="animate-in fade-in zoom-in-95 duration-300"><WeeklyView plan={activePlan} exams={exams.upcoming || []} projects={projects || []} /></div>}
            {view === "monthly" && <div className="animate-in fade-in zoom-in-95 duration-300"><MonthView plan={activePlan} exams={exams.upcoming || []} projects={projects || []} /></div>}    
          </div>
          {view === "daily" && tomorrowPlan && (
            <aside className="lg:col-span-4 space-y-6"><TomorrowChecklist day={tomorrowPlan} /><ComingUp projects={projects || []} exams={exams.upcoming || []} /></aside>
          )}
        </div>
      </main>
    </Suspense>
  );
}

function StatCard({ icon, label, val, color }: any) {
  // 🟢 FIX: Never split Tailwind class strings at runtime — Tailwind's JIT/purge
  // scans source for complete class strings. Dynamic splits produce classes that
  // don't exist in the stylesheet.
  const colorMap: Record<string, { bg: string; shadow: string; text: string }> = {
    emerald: { bg: "bg-emerald-500", shadow: "shadow-emerald-100", text: "text-emerald-600" },
    orange:  { bg: "bg-orange-500",  shadow: "shadow-orange-100",  text: "text-orange-600"  },
  };
  const c = colorMap[color];
  return (
    <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg text-white ${c.bg} ${c.shadow}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
        <p className={`text-xl font-black italic ${c.text}`}>{val}</p>
      </div>
    </div>
  );
}

function MetricCard({ title, val, total, isElite, isSecured, bonusCount }: any) {
  return (
    <div className={`p-6 rounded-[2.5rem] border transition-all duration-500 relative overflow-hidden group ${isElite ? 'bg-purple-50 border-purple-200 shadow-lg' : isSecured ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100 shadow-sm'}`}>
      <div className="flex justify-between items-start mb-4">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">{title}</p>
        <div className="flex gap-2">
          {isElite && <span className="bg-purple-600 text-white text-[8px] font-black px-2 py-1 rounded-full flex items-center gap-1 animate-in zoom-in"><Trophy className="w-3 h-3" /> ELITE +{bonusCount}</span>}
          {isSecured && !isElite && <span className="bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded-full flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> SECURED</span>}
        </div>
      </div>
      <div className="flex items-baseline gap-2 relative z-10">
        <p className={`text-6xl font-black italic tracking-tighter transition-colors ${isElite ? 'text-purple-600' : isSecured ? 'text-emerald-600' : 'text-slate-900'}`}>{val}</p>
        <p className="text-2xl font-bold text-gray-300 not-italic">/ {total}</p>
      </div>
    </div>
  );
}