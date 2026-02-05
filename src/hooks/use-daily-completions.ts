"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function useDailyCompletions(date: Date, onStatusChange?: (id: string, status: string) => void) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  // 🎯 Added specific type to avoid 'any' errors
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

    // Fetch all history so we can filter out past completed tasks
    const { data, error } = await supabase
      .from("daily_completions")
      .select("source_type, source_id, date")
      .eq("user_id", session.user.id);

    if (!error && data) {
      setAllCompletions(data);
      
      // Map only today's keys for the UI checkboxes
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

    setCompleted((prev) => {
      const next = new Set(prev);
      if (isCurrentlyDone) next.delete(key);
      else next.add(key);
      return next;
    });

    if (source_type === "deadline_task" && onStatusChange) {
      onStatusChange(source_id, newStatus);
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      if (isCurrentlyDone) {
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
      // Refresh allCompletions after toggle to keep buildWeekPlan in sync
      fetchCompletions(); 
    } catch (err) {
      console.error("Masterplan Sync Error:", err);
      fetchCompletions();
    }
  }, [completed, dateKey, fetchCompletions, onStatusChange]);

  return { 
    completed, 
    allCompletions, // 🎯 Included in return
    toggleDeadlineTask, // 🎯 Shorthand property fixed
    dateKey, 
    isLoading, 
    refresh: fetchCompletions 
  };
}