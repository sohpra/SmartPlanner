"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function useDailyCompletions(date: Date) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const dateKey = date.toISOString().slice(0, 10);

  const fetchCompletions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("daily_completions")
      .select("source_id")
      .eq("user_id", user.id)
      .eq("date", dateKey);

    if (data) {
      setCompleted(new Set(data.map((r) => r.source_id)));
    }
    setIsLoading(false);
  }, [dateKey]);

  useEffect(() => {
    fetchCompletions();
  }, [fetchCompletions]);

const toggleDeadlineTask = useCallback(
  async (taskId: string) => {
    // 1. Optimistic UI update
    const isCurrentlyDone = completed.has(taskId);
    setCompleted((prev) => {
      const next = new Set(prev);
      isCurrentlyDone ? next.delete(taskId) : next.add(taskId);
      return next;
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (isCurrentlyDone) {
      // --- UNCHECKING ---
      // Remove from today's log
      await supabase.from("daily_completions")
        .delete()
        .eq("user_id", user.id)
        .eq("source_id", taskId);

      // 🚀 UPDATE status to 'active' (Don't delete the task!)
      await supabase.from("deadline_tasks")
        .update({ status: 'active' })
        .eq("id", taskId);

    } else {
      // --- CHECKING ---
      // Add to today's log
      await supabase.from("daily_completions").insert({
        user_id: user.id,
        source_type: "deadline_task",
        source_id: taskId,
        date: dateKey,
      });

      // 🚀 UPDATE status to 'completed'
      await supabase.from("deadline_tasks")
        .update({ status: 'completed' })
        .eq("id", taskId);
    }
  },
  [completed, dateKey]
);

  return { completed, isLoading, toggleDeadlineTask };
}