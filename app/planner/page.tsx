"use client";

import { useMemo, useState, useEffect } from "react";
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
import { buildWeekPlan, WeekPlan } from "@/lib/planner/buildWeekPlan";

export default function PlannerPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  
  // 1. LIVE DATA HOOKS (The Background Stream)
  const exams = useExams();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { tasks: deadlines, isLoading: deadlinesLoading } = useDeadlineTasks();
  const { tasks: weeklyTasks, isLoading: weeklyLoading } = useWeeklyTasks();
  const completions = useDailyCompletions(new Date());

  // 2. SNAPSHOT STATE
  const [view, setView] = useState<"daily" | "weekly" | "monthly">("daily");
  const [activePlan, setActivePlan] = useState<WeekPlan | null>(null);
  const [lastSyncedSignature, setLastSyncedSignature] = useState<string>("");

  // 3. DIRTY DETECTION
  const currentDataSignature = useMemo(() => {
    return JSON.stringify({
      e: exams.upcoming.length,
      p: projects.length,
      d: deadlines.length,
      w: weeklyTasks.length,
    });
  }, [exams.upcoming, projects, deadlines, weeklyTasks]);

  const isDataLoaded = !exams.loading && !projectsLoading && !deadlinesLoading && !weeklyLoading;
  const isDirty = isDataLoaded && activePlan && currentDataSignature !== lastSyncedSignature;

  // 4. THE MASTER SYNC FUNCTION
  const handleGeneratePlan = () => {
    const newPlan = buildWeekPlan({
      today,
      numDays: 30, 
      weeklyTasks: [...weeklyTasks],
      deadlines: [...deadlines],
      exams: [...exams.upcoming],
      projects: [...projects],
    });

    setActivePlan(newPlan);
    setLastSyncedSignature(currentDataSignature);
  };

  useEffect(() => {
    if (isDataLoaded && !activePlan) handleGeneratePlan();
  }, [isDataLoaded]);

  if (!isDataLoaded || !activePlan) return <div className="p-10 text-center">Loading Roadmap...</div>;

  const todayPlan = activePlan.days[0];
  const tomorrowPlan = activePlan.days[1];

  return (
    <main className="mx-auto max-w-[1400px] space-y-6">
      <DashboardHeader />

      {/* Sync Warning */}
      {isDirty && (
        <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 p-3 animate-in fade-in slide-in-from-top-2">
          <p className="text-amber-800 text-sm font-medium">✨ Schedule changed. Refresh to update your Roadmap.</p>
          <button onClick={handleGeneratePlan} className="bg-amber-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-amber-700">REFRESH NOW</button>
        </div>
      )}

      {/* View Switcher */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          {["daily", "weekly", "monthly"].map((v) => (
            <button key={v} onClick={() => setView(v as any)} className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${view === v ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>{v}</button>
          ))}
        </div>
        <button onClick={handleGeneratePlan} className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-all ${isDirty ? "bg-blue-600 text-white shadow-lg scale-105" : "bg-white text-gray-600 border-gray-200"}`}>Regenerate Roadmap</button>
      </div>

      {/* Main Grid */}
      <div className={`grid grid-cols-1 gap-8 ${view === "daily" ? "lg:grid-cols-3" : "grid-cols-1"}`}>
        <div className={`${view === "daily" ? "lg:col-span-2" : "col-span-1"}`}>
          {view === "daily" && (
            <div className="space-y-8">
              <DashboardMetrics
                tasksCompleted={completions.completed.size}
                totalTasks={todayPlan.weekly.items.length + todayPlan.homework.items.length + todayPlan.revision.slots.length}
                minutesCompleted={0}
                minutesPlanned={todayPlan.totalUsed}
                upcomingExams={exams.upcoming.length}
                nextExamLabel={exams.upcoming[0]?.subject ?? undefined}
              />
              <DailyChecklist 
                day={todayPlan} 
                completions={{ completed: completions.completed, toggle: completions.toggleDeadlineTask, dateKey: completions.dateKey }} 
              />
            </div>
          )}
          {view === "weekly" && <WeeklyView plan={activePlan} />}
          {view === "monthly" && <MonthView plan={activePlan} />}
        </div>

        {view === "daily" && (
          <aside className="space-y-8">
            {/* Frozen Sidebar */}
            <TomorrowChecklist day={tomorrowPlan} /> 
            <ComingUp deadlines={deadlines} exams={exams.upcoming} />
          </aside>
        )}
      </div>
    </main>
  );
}