"use client";

import { useState } from "react";
import type { DayPlan } from "@/lib/planner/buildWeekPlan";

type FlatTask = {
  key: string;
  label: string;
  meta?: string;
};

export default function TodayChecklistSimple({ day }: { day: DayPlan }) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const tasks: FlatTask[] = [
    ...day.homework.items.map((t, i) => ({
      key: `deadline:${t.id ?? "missing"}:${i}`,
      label: `${t.name} · ${t.minutes} mins`,
      meta: `Due ${t.dueDate}`,
    })),

    ...day.weekly.items.map((t, i) => ({
      key: `weekly:${t.id ?? "missing"}:${i}`,
      label: `${t.name} · ${t.minutes} mins`,
      meta: "Recurring",
    })),

    ...day.projects.items.map((p, i) => ({
      key: `project:${p.projectId ?? "missing"}:${i}`,
      label: `${p.name} · ${p.minutes} mins`,
      meta: "Project",
    })),

    ...day.revision.slots.map((s, i) => ({
      key: `revision:${s.examId}:${i}`,
      label: `${s.label} · ${s.slotMinutes} mins`,
      meta: "Revision",
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Today</h2>
        <span className="text-sm text-gray-600">
          {completed.size} / {tasks.length} tasks completed
        </span>
      </div>

      {tasks.length === 0 && (
        <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-500">
          Nothing scheduled today.
        </div>
      )}

      <div className="space-y-3">
        {tasks.map((task) => {
          const isDone = completed.has(task.key);

          return (
            <div
              key={task.key}
              className={`flex items-center justify-between rounded-lg border p-4 ${
                isDone ? "opacity-60" : ""
              }`}
            >
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => toggle(task.key)}
                />
                <span className={isDone ? "line-through" : ""}>
                  {task.label}
                </span>
              </label>

              {task.meta && (
                <span className="text-xs text-gray-400">{task.meta}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
