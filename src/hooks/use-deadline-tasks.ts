"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type DeadlineTask = {
  id: string;
  name: string;
  due_date: string;
  estimated_minutes: number;
  status: string;
};

export function useDeadlineTasks() {
  const [tasks, setTasks] = useState<DeadlineTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchTasks() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("deadline_tasks")
      .select("id, name, due_date, estimated_minutes, status")
      .eq("status", "active")
      .order("due_date", { ascending: true });

    if (!error && data) {
      setTasks(data as DeadlineTask[]);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  return { tasks, isLoading, fetchTasks };
}