"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function useDailyCompletions(date: Date) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  
  // Format the date consistently as YYYY-MM-DD
  const dateKey = date.toISOString().slice(0, 10);

  const fetchCompletions = useCallback(async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("daily_completions")
      .select("source_type, source_id")
      .eq("user_id", session.user.id)
      .eq("date", dateKey);

    if (!error && data) {
      const keys = data.map((item) => `${item.source_type}:${item.source_id}:${dateKey}`);
      setCompleted(new Set(keys));
    }
    setIsLoading(false);
  }, [dateKey]);

  useEffect(() => {
    fetchCompletions();
  }, [fetchCompletions]);

  const toggleDeadlineTask = useCallback(async (source_type: string, source_id: string) => {
    // 🛡️ Guard against the 400 Error: check if id is actually a type string
    if (source_id === "deadline_task" || source_id === "weekly_task" || source_id === "revision") {
      console.error("Argument Swap Detected! source_id is a type string:", source_id);
      return;
    }

    const key = `${source_type}:${source_id}:${dateKey}`;
    const isCurrentlyDone = completed.has(key);

    // 🚀 Optimistic UI Update (Immediate Checkbox Toggle)
    setCompleted((prev: Set<string>) => {
      const next = new Set(prev);
      if (isCurrentlyDone) next.delete(key);
      else next.add(key);
      return next;
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (isCurrentlyDone) {
      // 1. Remove from daily_completions
      await supabase.from("daily_completions")
        .delete()
        .eq("user_id", session.user.id)
        .eq("source_type", source_type)
        .eq("source_id", source_id)
        .eq("date", dateKey);

      // 2. If it's a deadline task, update its status
      if (source_type === "deadline_task") {
        await supabase.from("deadline_tasks")
          .update({ status: 'active' })
          .eq("id", source_id);
      }
    } else {
      // 1. Add to daily_completions
      await supabase.from("daily_completions").insert({
        user_id: session.user.id,
        source_type,
        source_id,
        date: dateKey,
      });

      // 2. If it's a deadline task, update its status
      if (source_type === "deadline_task") {
        await supabase.from("deadline_tasks")
          .update({ status: 'completed' })
          .eq("id", source_id);
      }
    }
  }, [completed, dateKey]);

  return { 
    completed, 
    toggleDeadlineTask, 
    dateKey, 
    isLoading,
    refresh: fetchCompletions 
  };
}