"use client";

import { useState } from "react";

type TempTask = {
  id: string;
  label: string;
};

const INITIAL_TASKS: TempTask[] = [
  { id: "t1", label: "Geog written · 30 mins" },
  { id: "t2", label: "Maths worksheet · 30 mins" },
  { id: "t3", label: "History essay · 30 mins" },
  { id: "t4", label: "Piano practice · 30 mins" },
];

export default function TempPlannerPage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">🧪 Temp Planner (Today)</h1>

      <div className="space-y-3">
        {INITIAL_TASKS.map((task) => {
          const isDone = completed.has(task.id);

          return (
            <div
              key={task.id}
              className={`flex items-center justify-between rounded-lg border p-4 ${
                isDone ? "opacity-60" : ""
              }`}
            >
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => toggle(task.id)}
                />
                <span className={isDone ? "line-through" : ""}>
                  {task.label}
                </span>
              </label>

              {isDone && (
                <span className="text-xs text-green-600 font-medium">
                  Done
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
