"use client";

import { useMemo, useState, useEffect } from "react";
import DailyChecklist from "../components/checklist/DailyChecklist";
import { TomorrowChecklist } from "../components/checklist/TomorrowChecklist";
import { WeeklyView } from "../components/dashboard/WeeklyView";
import { MonthView } from "../components/dashboard/MonthView"; // You will create this file next
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
import { buildWeekPlan, WeekPlan } from "@/lib/planner/buildWeekPlan";

export default function PlannerPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  
  // 1. Fetching Data
  const exams = useExams();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { tasks: deadlines, isLoading: deadlinesLoading } = useDeadlineTasks();
  const { tasks: weeklyTasks, isLoading: weeklyLoading } = useWeeklyTasks();
  const completions = useDailyCompletions(new Date());

  // 2. State for View, Plan, and Sync Detection
  const [view, setView] = useState<"daily" | "weekly" | "monthly">("daily");
  const [activePlan, setActivePlan] = useState<WeekPlan | null>(null);
  const [lastSyncedSignature, setLastSyncedSignature] = useState<string>("");

  // 3. Data Signature (Detects if DB has changed since last plan generation)
  const currentDataSignature = useMemo(() => {
    return JSON.stringify({
      e: exams.upcoming.length,
      p: projects.length,
      d: deadlines.length,
      w: weeklyTasks.length,
    });
  }, [exams.upcoming, projects, deadlines, weeklyTasks]);

  // 4. Strategic Plan Generation (30 Days)
  const handleGeneratePlan = () => {
    const newPlan = buildWeekPlan({
      today,
      numDays: 30, // Extended window to prevent exam cramming
      weeklyTasks,
      deadlines,
      exams: exams.upcoming,
      projects,
    });
    setActivePlan(newPlan);
    setLastSyncedSignature(currentDataSignature);
  };

  const isDataLoaded = !exams.loading && !projectsLoading && !deadlinesLoading && !weeklyLoading;
  const isDirty = isDataLoaded && activePlan && currentDataSignature !== lastSyncedSignature;

  useEffect(() => {
    if (isDataLoaded && !activePlan) {
      handleGeneratePlan();
    }
  }, [isDataLoaded, activePlan]);

  const checklistCompletions = {
    completed: completions.completed,
    dateKey: completions.dateKey,
    toggle: completions.toggleDeadlineTask,
  };

  if (!isDataLoaded) {
    return <div className="p-10 text-center text-gray-400">Syncing Roadmap...</div>;
  }

  const todayPlan = activePlan?.days[0];

  return (
    <main className="mx-auto max-w-[1400px] space-y-6">
      <DashboardHeader />

      {/* ⚠️ Sync Warning Banner */}
      {isDirty && (
        <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 p-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
            <span>⚠️</span>
            Tasks have changed. Regenerate to update your roadmap.
          </div>
          <button onClick={handleGeneratePlan} className="text-xs font-bold text-amber-700 hover:underline">
            REFRESH PLAN
          </button>
        </div>
      )}

      {/* 🎛️ Control Bar: The 3-Way View Switcher */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setView("daily")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              view === "daily" ? "bg-white shadow-sm text-blue-600" : "text-gray-500"
            }`}
          >
            Daily Focus
          </button>
          <button
            onClick={() => setView("weekly")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              view === "weekly" ? "bg-white shadow-sm text-blue-600" : "text-gray-500"
            }`}
          >
            Weekly Grid
          </button>
          <button
            onClick={() => setView("monthly")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              view === "monthly" ? "bg-white shadow-sm text-blue-600" : "text-gray-500"
            }`}
          >
            Monthly Roadmap
          </button>
        </div>

        <button
          onClick={handleGeneratePlan}
          className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all ${
            isDirty ? "bg-blue-600 text-white border-blue-700 shadow-md" : "bg-blue-50 text-blue-700 border-blue-200"
          }`}
        >
          🔄 Regenerate Plan
        </button>
      </div>

      {/* 📊 Metrics (Only show in Daily View to keep Weekly/Monthly clean) */}
      {view === "daily" && (
        <DashboardMetrics
          tasksCompleted={completions.completed.size}
          totalTasks={(todayPlan?.weekly.items.length ?? 0) + (todayPlan?.homework.items.length ?? 0) + (todayPlan?.revision.slots.length ?? 0)}
          minutesCompleted={0}
          minutesPlanned={todayPlan?.totalUsed ?? 0}
          upcomingExams={exams.upcoming.length}
          nextExamLabel={exams.upcoming[0]?.subject ?? undefined}
        />
      )}

      {/* 🖼️ The Main Content Area */}
      {activePlan && (
        <div className={`grid grid-cols-1 gap-8 ${view === "daily" ? "lg:grid-cols-3" : "grid-cols-1"}`}>
          
          <div className={`${view === "daily" ? "lg:col-span-2" : "col-span-1"}`}>
            {/* 1. Daily View */}
            {view === "daily" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-800">Today's Focus</h2>
                <DailyChecklist day={todayPlan!} completions={checklistCompletions} />
              </div>
            )}

            {/* 2. Weekly View (Full Width) */}
            {view === "weekly" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-800">Weekly Strategy</h2>
                <WeeklyView plan={activePlan} />
              </div>
            )}

            {/* 3. Monthly View (Full Width / Heatmap) */}
            {view === "monthly" && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-800">Monthly Roadmap</h2>
                <MonthView plan={activePlan} />
              </div>
            )}
          </div>

          {/* 📋 Sidebar (Only shows in Daily View) */}
          {view === "daily" && (
            <aside className="space-y-8">
              <TomorrowChecklist day={activePlan.days[1]} />
              <ComingUp />
            </aside>
          )}
        </div>
      )}
    </main>
  );
}