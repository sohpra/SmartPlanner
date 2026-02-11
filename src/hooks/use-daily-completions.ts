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
  
  // 1. UI Optimism
  setCompleted((prev) => {
    const next = new Set(prev);
    if (isCurrentlyDone) next.delete(key);
    else next.add(key);
    return next;
  });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.error("❌ AUTH ERROR: No session found");
    return;
  }

  const userId = session.user.id;

  try {
    if (isCurrentlyDone) {
      // --- REMOVE COMPLETION ---
      // 1. Delete from ledger
      const { error: dcErr } = await supabase
        .from("daily_completions")
        .delete()
        .match({ user_id: userId, source_type, source_id, date: dateKey });
      
      if (dcErr) throw dcErr;

      // 2. Specific Table Updates
      if (source_type === "revision") {
        const { error: revErr } = await supabase
          .from("revision_slots")
          .update({ is_completed: false })
          .match({ id: source_id, user_id: userId }); // Match both for RLS
        if (revErr) throw revErr;
      }

      if (source_type === "deadline_task") {
        await supabase.from("deadline_tasks").update({ status: 'active' }).eq("id", source_id);
        if (onStatusChange) onStatusChange(source_id, 'active');
      }

    } else {
      // --- ADD COMPLETION ---
      // 1. Insert into ledger
      const { error: dcErr } = await supabase
        .from("daily_completions")
        .insert({ user_id: userId, source_type, source_id, date: dateKey });
      
      if (dcErr) throw dcErr;

    // 2. Specific Table Updates
    if (source_type === "revision") {
      const { error: revErr } = await supabase
        .from("revision_slots")
        .update({ is_completed: !isCurrentlyDone }) // 🎯 THIS marks it in the DB
        .match({ id: source_id, user_id: userId });
      
      if (revErr) console.error("❌ REVISION SYNC ERROR:", revErr);
    }

      if (source_type === "deadline_task") {
        await supabase.from("deadline_tasks").update({ status: 'completed' }).eq("id", source_id);
        if (onStatusChange) onStatusChange(source_id, 'completed');
      }
    }

    fetchCompletions(); 
  } catch (err: any) {
    console.error("❌ DATABASE SYNC ERROR:", err.message || err);
    fetchCompletions(); // Rollback UI
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