"use client";

import { useState } from "react";
import TodayChecklistSimple from "../components/checklist/TodayChecklistSimple";

export default function DebugPage() {
  // 1. Local-only state. No hooks, no Supabase.
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const mockTasks = [
    { id: "1", name: "Clean Debug Task 1", dueDate: "2026-02-01", minutes: 10 },
    { id: "2", name: "Clean Debug Task 2", dueDate: "2026-02-01", minutes: 20 },
  ];

  const handleToggle = (id: string) => {
    console.log("Toggle clicked for ID:", id);
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="p-10 max-w-xl mx-auto border-4 border-dashed border-blue-200 mt-10">
      <h1 className="text-xl font-bold mb-4 text-blue-600 underline">
        Sanity Check Environment
      </h1>
      
      <p className="mb-4 text-sm bg-blue-50 p-2 rounded">
        Current Completed IDs: {JSON.stringify(Array.from(completed))}
      </p>

      <TodayChecklistSimple
        tasks={mockTasks}
        completedIds={completed}
        onToggle={handleToggle}
      />

      <div className="mt-8 text-xs text-gray-400">
        If this works, the problem is 100% in your Hooks/Supabase logic.
      </div>
    </div>
  );
}