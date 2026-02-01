"use client";

import { useState } from "react";
import { useWeeklyTasks } from "@/hooks/use-weekly-tasks";
import { useSubjects } from "@/hooks/use-subjects";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DURATIONS = [15, 30, 45, 60, 90, 120];

export default function WeeklyTasksPage() {
  const { tasks, isLoading, error, createTask, deleteTask } = useWeeklyTasks();
  const { subjects, loading: subjectsLoading } = useSubjects();

  // form state
  const [taskType, setTaskType] = useState<"homework" | "music" | "club">(
    "homework"
  );
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [instrument, setInstrument] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [duration, setDuration] = useState(30);

  if (isLoading) {
    return <div className="p-8">Loading weekly tasks…</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-red-600">
        Error loading weekly tasks: {error}
      </div>
    );
  }

  // Group tasks by day
  const grouped = tasks.reduce<Record<number, typeof tasks>>((acc, task) => {
    acc[task.day_of_week] = acc[task.day_of_week] || [];
    acc[task.day_of_week].push(task);
    return acc;
  }, {});

  async function handleAddTask() {
    let finalName = name;

    if (!finalName) {
      if (taskType === "homework") finalName = `${subject} Homework`;
      if (taskType === "music") finalName = `${instrument} Practice`;
      if (taskType === "club") finalName = "After School Club";
    }

    await createTask({
      name: finalName,
      task_type: taskType,
      subject: taskType === "homework" ? subject : undefined,
      instrument: taskType === "music" ? instrument : undefined,
      day_of_week: dayOfWeek,
      duration_minutes: duration,
      color:
        taskType === "homework"
          ? "#f59e0b"
          : taskType === "music"
          ? "#8b5cf6"
          : "#10b981",
    });

    // reset form
    setName("");
    setSubject("");
    setInstrument("");
    setTaskType("homework");
    setDayOfWeek(1);
    setDuration(30);
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Weekly Tasks</h1>
      </div>

      {/* Add task */}
      <div className="mb-8 rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-medium">Add weekly task</h2>

        <div className="grid grid-cols-2 gap-6">
          {/* LEFT COLUMN — identity */}
          <div className="space-y-4">
            {/* Task type */}
            <label className="block">
              <span className="text-sm font-medium">Task type</span>
              <select
                className="mt-1 w-full rounded border p-2"
                value={taskType}
                onChange={(e) =>
                  setTaskType(e.target.value as typeof taskType)
                }
              >
                <option value="homework">Homework</option>
                <option value="music">Music practice</option>
                <option value="club">After school club</option>
              </select>
            </label>

            {/* Subject */}
            {taskType === "homework" && (
              <label className="block">
                <span className="text-sm font-medium">Subject</span>
                <select
                  className="mt-1 w-full rounded border p-2"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={subjectsLoading}
                >
                  <option value="">
                    {subjectsLoading
                      ? "Loading subjects…"
                      : "Select subject"}
                  </option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* Instrument */}
            {taskType === "music" && (
              <label className="block">
                <span className="text-sm font-medium">Instrument</span>
                <input
                  className="mt-1 w-full rounded border p-2"
                  value={instrument}
                  onChange={(e) => setInstrument(e.target.value)}
                  placeholder="e.g. Piano"
                />
              </label>
            )}

            {/* Custom name */}
            <label className="block">
              <span className="text-sm font-medium">
                Custom name (optional)
              </span>
              <input
                className="mt-1 w-full rounded border p-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Leave blank to auto-name"
              />
            </label>
          </div>

          {/* RIGHT COLUMN — scheduling (fixed) */}
          <div className="space-y-4">
            {/* Day */}
            <label className="block">
              <span className="text-sm font-medium">Day</span>
              <select
                className="mt-1 w-full rounded border p-2"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            {/* Duration */}
            <label className="block">
              <span className="text-sm font-medium">Duration</span>
              <select
                className="mt-1 w-full rounded border p-2"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} mins
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <button
          onClick={handleAddTask}
          disabled={
            (taskType === "homework" && !subject) ||
            (taskType === "music" && !instrument)
          }
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Add task
        </button>
      </div>

      {/* Task list */}
      <div className="space-y-6">
        {Object.keys(grouped).length === 0 && (
          <div className="rounded-lg border bg-gray-50 p-6 text-sm text-gray-500">
            No weekly tasks added yet.
          </div>
        )}

        {Object.entries(grouped).map(([day, dayTasks]) => (
          <div key={day}>
            <h2 className="mb-2 text-sm font-medium text-gray-500">
              {DAYS[Number(day)]}
            </h2>

            <div className="space-y-3">
              {dayTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border bg-white p-4"
                >
                  <div>
                    <div className="font-medium">{task.name}</div>
                    <div className="text-sm text-gray-500">
                      {task.duration_minutes} mins
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (confirm("Delete this weekly task?")) {
                        await deleteTask(task.id);
                      }
                    }}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
