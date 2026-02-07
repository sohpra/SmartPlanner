"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function useDailyCompletions(date: Date, onStatusChange?: (id: string, status: string) => void) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [allCompletions, setAllCompletions] = useState<{source_type: string, source_id: string, date: string}[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  
  const dateKey = date.toISOString().slice(0, 10);

  const fetchCompletions = useCallback(async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsLoading(false);
      return;
    }

    // Fetch history
    const { data, error } = await supabase
      .from("daily_completions")
      .select("source_type, source_id, date")
      .eq("user_id", session.user.id);

    if (!error && data) {
      setAllCompletions(data);
      
      // Map keys for the UI checkboxes
      const keys = data
        .filter((item: any) => item.date === dateKey)
        .map((item: any) => `${item.source_type}:${item.source_id}`);
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
    const newStatus = isCurrentlyDone ? 'active' : 'completed';

    // 1. Optimistic Update
    setCompleted((prev: Set<string>) => {
      const next = new Set(prev);
      if (isCurrentlyDone) next.delete(key);
      else next.add(key);
      return next;
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      if (isCurrentlyDone) {
        // DELETE Completion
        await supabase.from("daily_completions")
          .delete()
          .eq("user_id", session.user.id)
          .eq("source_type", source_type)
          .eq("source_id", source_id)
          .eq("date", dateKey);
        
        // 2. Sync with registry ONLY for deadlines
        if (source_type === "deadline_task") {
          await supabase.from("deadline_tasks").update({ status: 'active' }).eq("id", source_id);
          if (onStatusChange) onStatusChange(source_id, 'active');
        }
      } else {
        // INSERT Completion
        await supabase.from("daily_completions").insert({
          user_id: session.user.id,
          source_type,
          source_id,
          date: dateKey,
        });

        // 2. Sync with registry ONLY for deadlines
        if (source_type === "deadline_task") {
          await supabase.from("deadline_tasks").update({ status: 'completed' }).eq("id", source_id);
          if (onStatusChange) onStatusChange(source_id, 'completed');
        }
      }
      // 3. Final Sync
      fetchCompletions(); 
    } catch (err) {
      console.error("Masterplan Sync Error:", err);
      fetchCompletions();
    }
  }, [completed, dateKey, fetchCompletions, onStatusChange]);

  return { 
    completed, 
    allCompletions, 
    toggleDeadlineTask, 
    dateKey, 
    isLoading, 
    refresh: fetchCompletions 
  };
}