"use client";

import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function WeeklyTasksPage() {
  const { tasks, isLoading, error, createTask, deleteTask } = useWeeklyTasks();

  if (isLoading) {
    return <div style={{ padding: 40 }}>Loading weekly tasks…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: "red" }}>
        Error loading weekly tasks: {error}
      </div>
    );
  }

  // Group tasks by day of week
  const grouped = tasks.reduce<Record<number, typeof tasks>>((acc, task) => {
    acc[task.day_of_week] = acc[task.day_of_week] || [];
    acc[task.day_of_week].push(task);
    return acc;
  }, {});

  return (
    <div style={{ padding: 40, maxWidth: 700 }}>
      <h1 style={{ marginBottom: 24 }}>Weekly Tasks</h1>

      {/* TEMP: test button — will be replaced by form */}
      <button
        onClick={async () => {
          await createTask({
            name: "Maths Homework",
            task_type: "homework",
            subject: "Maths",
            day_of_week: 1, // Monday
            duration_minutes: 30,
            color: "#f59e0b",
          });
        }}
        style={{ marginBottom: 24 }}
      >
        Add test task
      </button>

      {Object.keys(grouped).length === 0 && (
        <p style={{ color: "#666" }}>No weekly tasks yet.</p>
      )}

      {Object.entries(grouped).map(([day, dayTasks]) => (
        <div key={day} style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 8 }}>{DAYS[Number(day)]}</h3>

          <ul style={{ paddingLeft: 0, listStyle: "none" }}>
            {dayTasks.map((task) => (
              <li
                key={task.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                }}
              >
                <span>
                  <strong>{task.name}</strong> — {task.duration_minutes} mins
                </span>

                <button
                  onClick={async () => {
                    if (confirm("Delete this weekly task?")) {
                      await deleteTask(task.id);
                    }
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#c00",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
