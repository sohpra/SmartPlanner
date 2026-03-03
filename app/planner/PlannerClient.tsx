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
import { RemindersCard } from "../components/reminders/reminders";
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

  const eliteMilestones = [
    { count: 20,  label: 'Elite Initiate', icon: Zap,    color: 'text-yellow-500',  bg: 'bg-yellow-50' },
    { count: 30,  label: 'Elite Veteran',  icon: Shield, color: 'text-blue-500',    bg: 'bg-blue-50' },
    { count: 40,  label: 'Elite Master',   icon: Crown,  color: 'text-purple-600', bg: 'bg-purple-100' },
    { count: 50, label: 'Elite Legend',   icon: Trophy, color: 'text-fuchsia-600',bg: 'bg-fuchsia-100' },
  ];

  const [activeMilestone, setActiveMilestone] = useState<any>(null);
  const prevStats = useRef(stats);

useEffect(() => {
  if (!stats || !prevStats.current) {
    prevStats.current = stats;
    return;
  }

  // 1. RANK CELEBRATION (Stay as is: 14, 25, 50, etc.)
  const streakMilestone = trophyMilestones.find(m => 
    stats.current_streak === m.days && (prevStats.current?.current_streak || 0) < m.days
  );

  // 2. ELITE CELEBRATION (Every increment of 10)
  // Logic: Current count is a multiple of 10 AND it just increased
  const isEveryTenElite = stats.elite_count > 0 && 
                          stats.elite_count % 10 === 0 && 
                          (prevStats.current?.elite_count || 0) < stats.elite_count;

  if (streakMilestone) {
    setActiveMilestone({ ...streakMilestone, type: 'rank' });
  } else if (isEveryTenElite) {
    setActiveMilestone({
      label: `${stats.elite_count} Elite Days`,
      icon: Crown,
      count: stats.elite_count,
      type: 'elite',
      color: 'text-purple-600',
      bg: 'bg-purple-100'
    });
  }

  prevStats.current = stats;
}, [stats?.current_streak, stats?.elite_count]);
      
    
return (
  <Suspense fallback={<div>Loading Plan Bee...</div>}>
    <main className="mx-auto max-w-[1600px] px-4 py-3 lg:h-screen lg:overflow-hidden flex flex-col gap-4">
      
      <DashboardHeader />

     {/* 📊 1. THE UNIFIED TOP STATS ROW (4 Columns) */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
      
      {/* 🎯 1. TODAY'S LIVE MISSION */}
      <div className={`p-4 rounded-[2rem] border transition-all duration-500 flex flex-col justify-between group ${
        isElite ? 'bg-purple-50 border-purple-200 shadow-md' : 
        isSecured ? 'bg-emerald-50 border-emerald-100 shadow-sm' : 
        'bg-white border-slate-100 shadow-sm'
      }`}>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-white shadow-sm ${
              isElite ? 'bg-purple-500' : isSecured ? 'bg-emerald-500' : 'bg-blue-600'
            }`}>
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic leading-none mb-1">Today's Mission</p>
              <div className="flex items-baseline gap-1">
                <p className={`text-xl font-black italic tracking-tighter ${isElite ? 'text-purple-600' : isSecured ? 'text-emerald-600' : 'text-slate-900'}`}>{todayPlan.completedTaskCount}</p>
                <p className="text-[9px] font-bold text-slate-400">/ {todayPlan.plannedTaskCount} </p>
              </div>
            </div>
          </div>
          <button onClick={() => handleBonusEffort(15)} className="px-2 py-1 rounded-lg bg-slate-900 text-white text-[8px] font-black uppercase hover:bg-blue-600 transition-all active:scale-95 shadow-sm">+15m</button>
        </div>
        <div className="flex flex-col items-end mt-2 pt-2 border-t border-slate-100/50">
          <p className={`text-[15px] font-black italic tracking-tighter leading-none ${isElite ? 'text-purple-600' : 'text-slate-700'}`}>
            {Math.floor(displayCompletedMins/60)}h{displayCompletedMins%60}m <span className="text-[9px] text-slate-300">Banked</span>
          </p>
          <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
            <div className={`h-full transition-all duration-1000 ${isElite ? 'bg-purple-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, (displayCompletedMins / (todayPlan.totalPlanned || 1)) * 100)}%` }} />
          </div>
        </div>
      </div>

      {/* 🟢 2. CURRENT STREAK */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-emerald-100 transition-all">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Active Streak</p>
            <p className="text-sm font-black italic text-emerald-600 truncate uppercase tracking-tighter">{currentBadge.label} ({currentStreak}d)</p>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="h-1.5 w-full bg-emerald-50 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progressTowardsNext}%` }} />
          </div>
          <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">
            {nextBadge.days - currentStreak} days until {nextBadge.label}
          </p>
        </div>
      </div>

      {/* 🟠 3. BEST + DYNAMIC TROPHIES */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-orange-100 transition-all">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-sm">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Personal Best</p>
            <p className="text-lg font-black italic text-orange-600 tracking-tighter">{longestStreak} Days</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 px-0.5">
          {trophyMilestones.map((m, index) => {
            const isUnlocked = longestStreak >= m.days;
            const isTarget = !isUnlocked && (index === 0 || longestStreak >= trophyMilestones[index - 1].days);
            if (!isUnlocked && !isTarget) return null;
            const Icon = m.icon;
            return (
              <div key={m.days} className="flex flex-col items-center gap-1">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${isUnlocked ? `${m.bg} ${m.color} scale-105 shadow-sm` : 'bg-slate-50 text-slate-300 border border-dashed border-slate-200 animate-pulse'}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className={`text-[6px] font-black uppercase tracking-tighter ${isUnlocked ? 'text-slate-500' : 'text-slate-300'}`}>{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🟣 4. ELITE STATUS */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-purple-100 transition-all">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-white shadow-sm">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Elite Count</p>
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-black italic text-purple-600 tracking-tighter">{stats?.elite_count || 0} Days</p>
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-black text-emerald-500 leading-none">{Math.floor((stats?.lifetime_bonus_mins || 0) / 60)}h</span>
                <span className="text-[7px] font-bold text-slate-300 uppercase">Banked</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2 text-right">
          <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] italic">Lifetime Excellence</p>
        </div>
      </div>

    </div>

      {/* 🕹️ 2. THE CONTROL BAR (Toggle & Reshuffle) */}
      <div className="flex items-center justify-between gap-4 bg-white/40 p-1.5 rounded-2xl border border-slate-100 shrink-0">
        <div className="inline-flex rounded-xl bg-gray-100 p-1">
          {["daily", "weekly", "monthly"].map((v) => (
            <button key={v} onClick={() => setView(v as any)} className={`px-6 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${view === v ? "bg-white shadow-sm text-blue-600" : "text-gray-400 hover:text-gray-700"}`}>
              {v}
            </button>
          ))}
        </div>
        
        <button 
          onClick={handleFullSync} 
          disabled={isSyncing} 
          className="bg-slate-900 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
        >
          {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />} Re-Shuffle
        </button>
      </div>

      {/* 🏗️ 3. MAIN CONTENT GRID */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {view === "daily" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">            
            {/* 🏛️ LEFT: TODAY'S MISSION (6/12) */}
            <div className="lg:col-span-6 flex flex-col gap-4 min-h-0 relative h-full">
              <div className={`absolute -inset-1 rounded-[2.5rem] transition-all duration-700 blur-xl opacity-10 ${isElite ? 'bg-purple-400' : isSecured ? 'bg-emerald-400' : 'bg-blue-400'}`} />
              <div className="relative flex-1 bg-white rounded-[2.5rem] border-2 border-blue-600/10 shadow-sm flex flex-col min-h-0 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3 shrink-0">
                    <div className={`h-2 w-2 rounded-full animate-pulse ${isElite ? 'bg-purple-500' : 'bg-blue-600'}`} />
                    <h2 className="text-xl font-black text-slate-500 italic tracking-tighter uppercase">Today</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <DailyChecklist 
                      day={todayPlan} 
                      completions={checklistCompletions} 
                      allProjects={activeProjects} 
                      upcomingRevision={futureRevision} 
                    />
                  </div>
              </div>
            </div>
            
            {/* ➡️ MIDDLE: REMINDERS FEED (Reminders - 3/12) */}
            <div className="lg:col-span-3 flex flex-col h-full min-h-0">
              <RemindersCard date={today} />
            </div>

            {/* ➡️ RIGHT: THE HORIZON (Coming Up - 3/12) */}
            <div className="lg:col-span-3 flex flex-col h-full min-h-0">
              <ComingUp projects={projects || []} exams={exams.upcoming || []} />
            </div>

          </div>
        ) : (
          <div className="h-full overflow-y-auto custom-scrollbar">
            {view === "weekly" && <div className="animate-in fade-in zoom-in-95 duration-300"><WeeklyView plan={activePlan} exams={exams.upcoming || []} projects={projects || []} /></div>}
            {view === "monthly" && <div className="animate-in fade-in zoom-in-95 duration-300"><MonthView plan={activePlan} exams={exams.upcoming || []} projects={projects || []} /></div>}    
          </div>
        )}
      </div>
    </main>
    {/* 🎉 Milestone Pop-up */}
    {activeMilestone && (
      <MilestoneOverlay 
        milestone={activeMilestone} 
        onClose={() => setActiveMilestone(null)} 
      />
    )}
  </Suspense>
);
}

function StatCard({ icon, label, val, color }: any) {

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

function MilestoneOverlay({ milestone, onClose }: { milestone: any, onClose: () => void }) {
  const isElite = milestone.type === 'elite';

  useEffect(() => {
    confetti({
      particleCount: isElite ? 300 : 200, // Bigger burst for Elite!
      spread: 80,
      origin: { y: 0.5 },
      colors: isElite ? ['#a855f7', '#d946ef', '#fbbf24'] : ['#3b82f6', '#10b981']
    });
  }, [isElite]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative bg-white p-8 rounded-[3rem] shadow-2xl border-4 border-slate-100 max-w-sm w-full text-center animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        
        {/* Dynamic Badge Icon */}
        <div className={`mx-auto h-24 w-24 rounded-3xl ${milestone.bg} flex items-center justify-center mb-6 shadow-inner`}>
          <milestone.icon className={`w-12 h-12 ${milestone.color}`} />
        </div>

        {/* Dynamic Label */}
        <h2 className={`text-[10px] font-black uppercase tracking-[0.3em] mb-2 italic ${isElite ? 'text-purple-600' : 'text-blue-600'}`}>
          {isElite ? 'Elite Achievement' : 'New Rank Unlocked'}
        </h2>

        <h3 className="text-4xl font-black italic text-slate-900 tracking-tighter mb-4 uppercase leading-none">
          {milestone.label}
        </h3>

        {/* Dynamic Description */}
        <p className="text-slate-500 font-medium text-sm mb-8 leading-relaxed">
          {isElite 
            ? `You've conquered ${milestone.count} Elite Days. Your commitment to maximum effort is exceptional.`
            : `You've maintained a consistency streak of ${milestone.days} days. Your discipline is evolving.`
          }
        </p>

          <button 
            onClick={onClose}
            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 text-white shadow-md ${
              isElite 
                ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:shadow-purple-200' 
                : 'bg-slate-900 hover:bg-blue-600 shadow-slate-200'
            }`}
            >
            {isElite ? 'Stay Elite' : 'Keep Going'}
          </button>
      </div>
    </div>
  );
}