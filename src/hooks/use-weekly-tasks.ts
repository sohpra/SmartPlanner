"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/* ================================
   Types
   ================================ */

export type WeeklyTask = {
  id: string;
  name: string;
  day_of_week: number;
  duration_minutes: number;
  task_type: "homework" | "music" | "club";
  subject: string | null;
  instrument: string | null;
  category: string | null;
  color: string;
};

/**
 * What UI is allowed to pass when creating a weekly task.
 * Matches DB defaults.
 */
export type CreateWeeklyTaskInput = {
  name: string;
  day_of_week: number;
  duration_minutes: number;
  task_type: "homework" | "music" | "club";
  subject?: string | null;
  instrument?: string | null;
  category?: string | null;
  color?: string;
};

/* ================================
   Hook
   ================================ */

export function useWeeklyTasks() {
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ===========================
     Fetch
     =========================== */

  async function fetchTasks() {
    setIsLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("recurring_tasks")
      .select(
        "id,name,day_of_week,duration_minutes,task_type,subject,instrument,category,color"
      )
      .order("day_of_week", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      setTasks([]);
    } else {
      setTasks((data ?? []) as WeeklyTask[]);
    }

    setIsLoading(false);
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  /* ===========================
     Mutations
     =========================== */

  async function createTask(input: CreateWeeklyTaskInput) {
    const { error } = await supabase
      .from("recurring_tasks")
      .insert({
        ...input,
        // rely on DB defaults:
        // duration_minutes default
        // color default
      });

    if (error) throw error;

    await fetchTasks();
  }

  async function deleteTask(id: string) {
    const { error } = await supabase
      .from("recurring_tasks")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await fetchTasks();
  }

  return {
    tasks,
    isLoading,
    error,
    createTask,
    deleteTask,
  };
}
