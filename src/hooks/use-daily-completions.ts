"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/**
 * @param date - The current date being viewed
 * @param onStatusChange - Optional callback to update local task state in the planner
 */
export function useDailyCompletions(date: Date, onStatusChange?: (id: string, status: string) => void) {
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
      const keys = data.map((item) => `${item.source_type}:${item.source_id}`);
      setCompleted(new Set(keys));
    }
    setIsLoading(false);
  }, [dateKey]);

  useEffect(() => {
    fetchCompletions();
  }, [fetchCompletions]);

  const toggleDeadlineTask = useCallback(async (source_type: string, source_id: string) => {
    if (!source_id || source_id === source_type) return;

    const key = `${source_type}:${source_id}`;
    const isCurrentlyDone = completed.has(key);
    
    // Determine the new database status
    const newStatus = isCurrentlyDone ? 'active' : 'completed';

    // 1. Optimistic UI: Update the 'check' mark immediately
    setCompleted((prev) => {
      const next = new Set(prev);
      if (isCurrentlyDone) next.delete(key);
      else next.add(key);
      return next;
    });

    // 2. THE SYNC FIX: Update the Planner's task list status immediately
    // This moves the task between 'Active' and 'Finalized Today' buckets instantly
    if (source_type === "deadline_task" && onStatusChange) {
      onStatusChange(source_id, newStatus);
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      if (isCurrentlyDone) {
        // --- UNCHECKING ---
        await supabase.from("daily_completions")
          .delete()
          .eq("user_id", session.user.id)
          .eq("source_type", source_type)
          .eq("source_id", source_id)
          .eq("date", dateKey);
        
        if (source_type === "deadline_task") {
          await supabase.from("deadline_tasks").update({ status: 'active' }).eq("id", source_id);
        }
      } else {
        // --- CHECKING ---
        await supabase.from("daily_completions").insert({
          user_id: session.user.id,
          source_type,
          source_id,
          date: dateKey,
        });

        if (source_type === "deadline_task") {
          await supabase.from("deadline_tasks").update({ status: 'completed' }).eq("id", source_id);
        }
      }
    } catch (err) {
      console.error("Masterplan Sync Error:", err);
      // Re-fetch to recover from errors
      fetchCompletions();
    }
  }, [completed, dateKey, fetchCompletions, onStatusChange]);

  return { 
    completed, 
    toggleDeadlineTask, 
    dateKey, 
    isLoading, 
    refresh: fetchCompletions 
  };
}