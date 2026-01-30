"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSubjects } from "@/hooks/use-subjects";

type TaskType = "weekly" | "deadline" | "project";

type Props = {
  open: boolean;
  onClose: () => void;
};

const DURATION_MINUTES = [15, 30, 45, 60, 75, 90, 120];
const PROJECT_MINUTES = Array.from({ length: 12 }, (_, i) => (i + 1) * 300);

const CATEGORIES = [
  { value: "", label: "General" },
  { value: "homework", label: "Homework" },
  { value: "music", label: "Music practice" },
  { value: "club", label: "Club" },
  { value: "sport", label: "Sport" },
];

export function AddTaskModal({ open, onClose }: Props) {
  const { subjects, loading: subjectsLoading } = useSubjects();

  const [taskType, setTaskType] = useState<TaskType>("weekly");
  const [name, setName] = useState("");

  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [subjectText, setSubjectText] = useState("");

  const [category, setCategory] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [dueDate, setDueDate] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(300);

  useEffect(() => {
    if (open) {
      setTaskType("weekly");
      setName("");
      setSubjectId(null);
      setSubjectText("");
      setCategory("");
      setDayOfWeek(1);
      setDurationMinutes(30);
      setDueDate("");
      setEstimatedMinutes(300);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!user || error) {
      alert("Not authenticated");
      return;
    }

    /* WEEKLY */
    if (taskType === "weekly") {
      const { error } = await supabase.from("recurring_tasks").insert({
        user_id: user.id,
        name,
        subject: subjectText || null,
        category: category || null,
        task_type: category || "homework",
        day_of_week: dayOfWeek,
        duration_minutes: durationMinutes,
      });

      if (error) {
        alert(error.message);
        return;
      }
    }

    /* DEADLINE */
    if (taskType === "deadline") {
      const { error } = await supabase.from("deadline_tasks").insert({
        user_id: user.id,
        name,
        subject_id: subjectId,
        due_date: dueDate,
        estimated_minutes: durationMinutes,
      });

      if (error) {
        alert(error.message);
        return;
      }
    }

    /* PROJECT */
    if (taskType === "project") {
      const { error } = await supabase.from("projects").insert({
        user_id: user.id,
        name,
        subject: subjectText || null,
        due_date: dueDate,
        estimated_minutes: estimatedMinutes,
        status: "active",
      });

      if (error) {
        alert(error.message);
        return;
      }
    }

    onClose();
    window.location.reload(); // 🔥 instant + reliable
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add task</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* Task type */}
        <label className="block mb-4">
          <span className="text-sm font-medium">Task type</span>
          <select
            className="mt-1 w-full rounded border p-2"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as TaskType)}
          >
            <option value="weekly">Weekly recurring</option>
            <option value="deadline">Homework / assignment</option>
            <option value="project">Project</option>
          </select>
        </label>

        {/* Name */}
        <label className="block mb-4">
          <span className="text-sm font-medium">Task name</span>
          <input
            className="mt-1 w-full rounded border p-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        {/* Subject (unified) */}
        <label className="block mb-4">
          <span className="text-sm font-medium">Subject (optional)</span>
          <select
            className="mt-1 w-full rounded border p-2"
            value={subjectId ?? ""}
            onChange={(e) => {
              const id = e.target.value || null;
              setSubjectId(id);

              const s = subjects.find((x) => x.id === id);
              setSubjectText(s?.name ?? "");
            }}
            disabled={subjectsLoading}
          >
            <option value="">
              {subjectsLoading ? "Loading…" : "Select subject"}
            </option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {/* Category */}
        {taskType !== "project" && (
          <label className="block mb-4">
            <span className="text-sm font-medium">Category</span>
            <select
              className="mt-1 w-full rounded border p-2"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Weekly */}
        {taskType === "weekly" && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <select
              className="rounded border p-2"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
            >
              <option value={1}>Monday</option>
              <option value={2}>Tuesday</option>
              <option value={3}>Wednesday</option>
              <option value={4}>Thursday</option>
              <option value={5}>Friday</option>
              <option value={6}>Saturday</option>
              <option value={0}>Sunday</option>
            </select>

            <select
              className="rounded border p-2"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            >
              {DURATION_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m} mins
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Deadline + Project */}
        {(taskType === "deadline" || taskType === "project") && (
          <label className="block mb-4">
            <span className="text-sm font-medium">Due date</span>
            <input
              type="date"
              className="mt-1 w-full rounded border p-2"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        )}

        {/* Project effort */}
        {taskType === "project" && (
          <label className="block mb-6">
            <span className="text-sm font-medium">Estimated effort</span>
            <select
              className="mt-1 w-full rounded border p-2"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
            >
              {PROJECT_MINUTES.map((m) => (
                <option key={m} value={m}>
                  {m / 60} hours
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded border px-4 py-2">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}
