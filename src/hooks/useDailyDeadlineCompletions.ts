"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type CompletionRow = {
  source_type: "deadline_task";
  source_id: string;
};

export function useDailyDeadlineCompletions() {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  async function fetchCompletions() {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("daily_completions")
      .select("source_id")
      .eq("source_type", "deadline_task");

    if (!error && data) {
      setCompletedIds(new Set(data.map((r) => r.source_id)));
    }

    setIsLoading(false);
  }

  useEffect(() => {
    fetchCompletions();
  }, []);

  async function toggleDeadlineTask(taskId: string) {
    if (completedIds.has(taskId)) {
      await supabase
        .from("daily_completions")
        .delete()
        .eq("source_type", "deadline_task")
        .eq("source_id", taskId);
    } else {
      await supabase.from("daily_completions").insert({
        source_type: "deadline_task",
        source_id: taskId,
      });
    }

    fetchCompletions();
  }

  return {
    completedIds,
    toggleDeadlineTask,
    isLoading,
  };
}
