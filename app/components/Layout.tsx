"use client";

import { useMemo, useState, useEffect } from "react";
import DailyChecklist from "../components/checklist/DailyChecklist";
import { TomorrowChecklist } from "../components/checklist/TomorrowChecklist";
import { WeeklyView } from "../components/dashboard/WeeklyView";
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
  
  // 1. Fetching Data from Hooks
  const exams = useExams();
  const { projects, isLoading: projectsLoading } = useProjects();
  const { tasks: deadlines, isLoading: deadlinesLoading } = useDeadlineTasks();
  const { tasks: weeklyTasks, isLoading: weeklyLoading } = useWeeklyTasks();
  
  // Completions hook for Today
  const completions = useDailyCompletions(new Date());

  // 2. State for UI View and the Calculated Plan
  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [activePlan, setActivePlan] = useState<WeekPlan | null>(null);

  // 3. Plan Generation Function (Explicit Trigger)
  const handleGeneratePlan = () => {
    const newPlan = buildWeekPlan({
      today,
      numDays: 7,
      weeklyTasks,
      deadlines,
      exams: exams.upcoming,
      projects,
    });
    setActivePlan(newPlan);
  };

  // 4. Initial Load Guard
  const isDataLoaded = !exams.loading && !projectsLoading && !deadlinesLoading && !weeklyLoading;
  
  useEffect(() => {
    if (isDataLoaded && !activePlan) {
      handleGeneratePlan();
    }
  }, [isDataLoaded, activePlan]);

  // 5. Fix for TS2741: Map the hook function to the prop name 'toggle'
  const checklistCompletions = {
    completed: completions.completed,
    dateKey: completions.dateKey,
    toggle: completions.toggleDeadlineTask, // Bridge the name mismatch
  };

  if (!isDataLoaded) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        Syncing your schedule...
      </div>
    );
  }

  // Metric Calculations
  const todayPlan = activePlan?.days[0];
  const totalTasksToday = 
    (todayPlan?.weekly.items.length ?? 0) + 
    (todayPlan?.homework.items.length ?? 0) + 
    (todayPlan?.revision.slots.length ?? 0) + 
    (todayPlan?.projects.items.length ?? 0);

  return (
    <main className="mx-auto max-w-[1400px] space-y-6">
      <DashboardHeader />

      {/* Control Bar: View Switcher & Snapshot Trigger */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setView("daily")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              view === "daily" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Daily List
          </button>
          <button
            onClick={() => setView("weekly")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              view === "weekly" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Weekly Grid
          </button>
        </div>

        <button
          onClick={handleGeneratePlan}
          className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-all border border-blue-200"
        >
          🔄 Regenerate Plan
        </button>
      </div>

      <DashboardMetrics
        tasksCompleted={completions.completed.size}
        totalTasks={totalTasksToday}
        minutesCompleted={0} // Placeholder for expansion
        minutesPlanned={todayPlan?.totalUsed ?? 0}
        upcomingExams={exams.upcoming.length}
        nextExamLabel={exams.upcoming[0]?.subject ?? undefined}
      />

      {activePlan && (
        <div className={`grid grid-cols-1 gap-8 ${view === "daily" ? "lg:grid-cols-3" : "grid-cols-1"}`}>
          
          {/* Main Column */}
          <div className={`${view === "daily" ? "lg:col-span-2" : "col-span-1"}`}>
            {view === "daily" ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h2 className="text-xl font-bold text-gray-800 tracking-tight">Today's Focus</h2>
                <DailyChecklist 
                  day={activePlan.days[0]} 
                  completions={checklistCompletions} 
                />
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <h2 className="text-xl font-bold text-gray-800 tracking-tight">Weekly Overview</h2>
                <WeeklyView plan={activePlan} />
              </div>
            )}
          </div>

          {/* Sidebar Area: Conditional Render */}
          {view === "daily" && (
            <aside className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <TomorrowChecklist day={activePlan.days[1]} />
              <ComingUp />
            </aside>
          )}
        </div>
      )}
    </main>
  );
}