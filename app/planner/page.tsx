"use client";

import TodayChecklistSimple from "../components/checklist/TodayChecklistSimple";
import { useDailyCompletions } from "@/hooks/use-daily-completions";
import { useDeadlineTasks } from "@/hooks/use-deadline-tasks";

export default function PlannerPage() {
  const { tasks, isLoading: tasksLoading } = useDeadlineTasks();
  const { completed, toggleDeadlineTask, isLoading: completionsLoading } = useDailyCompletions(new Date());

  const uiTasks = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    dueDate: t.due_date,
    minutes: t.estimated_minutes,
  }));

  if (tasksLoading || completionsLoading) {
    return <div className="p-10 text-center">Loading your tasks...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Daily Planner</h1>
        <p className="text-gray-500">
          {completed.size} of {uiTasks.length} tasks completed today
        </p>
      </header>

      <TodayChecklistSimple
        tasks={uiTasks}
        completedIds={completed}
        onToggle={toggleDeadlineTask}
      />
    </div>
  );
}