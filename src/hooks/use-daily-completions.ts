"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/* ---------- Types ---------- */
export type CompletionItem = {
  source_type: string;
  source_id: string;
  date: string;
};

/* ---------- Hook ---------- */
export function useDailyCompletions(date: Date, onStatusChange?: (id: string, status: string) => void) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [allCompletions, setAllCompletions] = useState<CompletionItem[]>([]);
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
      .select("source_type, source_id, date")
      .eq("user_id", session.user.id);

    if (!error && data) {
      setAllCompletions(data);
      
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

  /**
   * Toggles a task completion status.
   * @param source_type - 'deadline_task', 'revision', 'weekly_task', or 'project'
   * @param source_id - The ID of the task/project
   * @param duration - Required for 'project' type to increment/decrement minutes
   */
  const toggleDeadlineTask = useCallback(async (
    source_type: string, 
    source_id: string, 
    duration?: number
  ) => {
    if (!source_id || source_id === source_type) return;

    const key = `${source_type}:${source_id}`;
    const isCurrentlyDone = completed.has(key);
    
    // 1. UI Optimism: Toggle immediately for a snappy feel
    setCompleted((prev) => {
      const next = new Set(prev);
      if (isCurrentlyDone) next.delete(key);
      else next.add(key);
      return next;
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;

    try {
      if (isCurrentlyDone) {
        // --- REMOVE COMPLETION ---
        const { error: dcErr } = await supabase
          .from("daily_completions")
          .delete()
          .match({ user_id: userId, source_type, source_id, date: dateKey });
        
        if (dcErr) throw dcErr;

        // Specific Table Reversals
        if (source_type === "project" && duration) {
          // Subtract minutes from the project total
          await supabase.rpc('increment_project_minutes', { 
            target_project_id: source_id, 
            minutes: -duration 
          });
        }

        if (source_type === "revision") {
          await supabase
            .from("revision_slots")
            .update({ is_completed: false })
            .match({ id: source_id, user_id: userId });
        }

        if (source_type === "deadline_task") {
          await supabase.from("deadline_tasks").update({ status: 'active' }).eq("id", source_id);
          if (onStatusChange) onStatusChange(source_id, 'active');
        }

      } else {
        // --- ADD COMPLETION ---
        const { error: dcErr } = await supabase
          .from("daily_completions")
          .insert({ user_id: userId, source_type, source_id, date: dateKey });
        
        if (dcErr) throw dcErr;

        // Specific Table Updates
        if (source_type === "project" && duration) {
          // Add minutes via atomic RPC
          await supabase.rpc('increment_project_minutes', { 
            target_project_id: source_id, 
            minutes: duration 
          });
        }

        if (source_type === "revision") {
          await supabase
            .from("revision_slots")
            .update({ is_completed: true })
            .match({ id: source_id, user_id: userId });
        }

        if (source_type === "deadline_task") {
          await supabase.from("deadline_tasks").update({ status: 'completed' }).eq("id", source_id);
          if (onStatusChange) onStatusChange(source_id, 'completed');
        }
      }

      // 3. Final Sync to ensure state is 100% correct
      fetchCompletions(); 
    } catch (err: any) {
      console.error("❌ DATABASE SYNC ERROR:", err.message || err);
      // Rollback UI optimism on failure
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