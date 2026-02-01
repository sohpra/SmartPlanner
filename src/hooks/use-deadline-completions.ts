"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function useDailyDeadlineCompletions() {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const date = todayKey();

  // 🔹 fetch completions for today
  const fetchCompletions = useCallback(async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("daily_completions")
      .select("source_id")
      .eq("source_type", "deadline_task")
      .eq("date", date);

    if (error) {
      console.error("Failed to fetch completions", error);
      setCompletedIds(new Set());
    } else {
      setCompletedIds(new Set(data.map((r) => r.source_id)));
    }

    setIsLoading(false);
  }, [date]);

  useEffect(() => {
    fetchCompletions();
  }, [fetchCompletions]);

  // 🔹 toggle completion
  const toggleDeadlineTask = async (taskId: string) => {
    if (completedIds.has(taskId)) {
      // un-complete
      const { error } = await supabase
        .from("daily_completions")
        .delete()
        .eq("source_type", "deadline_task")
        .eq("source_id", taskId)
        .eq("date", date);

      if (!error) {
        setCompletedIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      } else {
        console.error("Failed to delete completion", error);
      }
    } else {
      // complete
      const { error } = await supabase
        .from("daily_completions")
        .insert({
          source_type: "deadline_task",
          source_id: taskId,
          date,
        });

      if (!error) {
        setCompletedIds((prev) => new Set(prev).add(taskId));
      } else {
        console.error("Failed to insert completion", error);
      }
    }
  };

  return {
    completedIds,
    isLoading,
    toggleDeadlineTask,
  };
}
