"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function useDailyCompletions(date: Date) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  
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
      // FIX: Match the key format used in the DailyChecklist component
      const keys = data.map((item) => `${item.source_type}:${item.source_id}`);
      setCompleted(new Set(keys));
    }
    setIsLoading(false);
  }, [dateKey]);

  useEffect(() => {
    fetchCompletions();
  }, [fetchCompletions]);

  const toggleDeadlineTask = useCallback(async (source_type: string, source_id: string) => {
    // Argument swap guard
    if (source_id === "deadline_task" || source_id === "weekly_task" || source_id === "revision") return;

    const key = `${source_type}:${source_id}`;
    const isCurrentlyDone = completed.has(key);

    // Optimistic UI Update
    setCompleted((prev) => {
      const next = new Set(prev);
      if (isCurrentlyDone) next.delete(key);
      else next.add(key);
      return next;
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (isCurrentlyDone) {
      await supabase.from("daily_completions")
        .delete()
        .eq("user_id", session.user.id)
        .eq("source_type", source_type)
        .eq("source_id", source_id)
        .eq("date", dateKey);
      
      // REMOVED: Do NOT update deadline_tasks status to 'active'
      // Keep them active so the engine continues to see them on their due date.
    } else {
      await supabase.from("daily_completions").insert({
        user_id: session.user.id,
        source_type,
        source_id,
        date: dateKey,
      });

      // REMOVED: Do NOT update deadline_tasks status to 'completed'
    }
  }, [completed, dateKey]);

  return { completed, toggleDeadlineTask, dateKey, isLoading, refresh: fetchCompletions };
}