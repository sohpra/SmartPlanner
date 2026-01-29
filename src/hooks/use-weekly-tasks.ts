"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/* ---------- Types ---------- */

export type WeeklyTask = {
  id: string;
  user_id: string;

  name: string;
  task_type: "homework" | "music" | "club";

  subject: string | null;
  instrument: string | null;

  day_of_week: number;        // 0–6
  duration_minutes: number;

  color: string;
  created_at: string;
};

type CreateWeeklyTaskInput = {
  name: string;
  task_type: WeeklyTask["task_type"];
  subject?: string | null;
  instrument?: string | null;
  day_of_week: number;
  duration_minutes: number;
  color: string;
};

/* ---------- Hook ---------- */

export function useWeeklyTasks() {
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- fetch ---- */

  const fetchTasks = async () => {
    setIsLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("recurring_tasks")
      .select("*")
      .order("day_of_week", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      setTasks([]);
    } else {
      setTasks(data as WeeklyTask[]);
    }

    setIsLoading(false);
  };

  /* ---- create ---- */

  const createTask = async (input: CreateWeeklyTaskInput) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    const { error } = await supabase.from("recurring_tasks").insert({
      user_id: user.id,
      name: input.name,
      task_type: input.task_type,
      subject: input.subject ?? null,
      instrument: input.instrument ?? null,
      day_of_week: input.day_of_week,
      duration_minutes: input.duration_minutes,
      color: input.color,
    });

    if (error) {
      throw error;
    }

    await fetchTasks();
  };

  /* ---- delete ---- */

  const deleteTask = async (id: string) => {
    const { error } = await supabase
      .from("recurring_tasks")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }

    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  /* ---- lifecycle ---- */

  useEffect(() => {
    fetchTasks();
  }, []);

  return {
    tasks,
    isLoading,
    error,
    refetch: fetchTasks,
    createTask,
    deleteTask,
  };
}
