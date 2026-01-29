"use client";

import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";

export default function WeeklyTasksPage() {
  const { tasks, isLoading, createTask, error } = useWeeklyTasks();

  if (isLoading) {
    return <div style={{ padding: 40 }}>Loading weekly tasks…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: "red" }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Weekly Tasks (v0)</h1>

      <button
        onClick={async () => {
          await createTask({
            name: "Maths Homework",
            task_type: "homework",
            subject: "Maths",
            day_of_week: 1,        // Monday
            duration_minutes: 30,
            color: "#f59e0b",
          });
        }}
      >
        Add test task
      </button>

      <pre style={{ marginTop: 20 }}>
        {JSON.stringify(tasks, null, 2)}
      </pre>
    </div>
  );
}
