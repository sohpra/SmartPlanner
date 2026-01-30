"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type DeadlineTask = {
  id: string;
  user_id: string;
  subject_id: string | null;
  name: string;
  due_date: string; // ISO date (yyyy-mm-dd)
  estimated_minutes: number;
  completed_minutes: number;
  status: string;
  created_at: string;
};

export function useDeadlineTasks() {
  const [tasks, setTasks] = useState<DeadlineTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from("deadline_tasks")
        .select("*")
        .order("due_date", { ascending: true });

      if (error) {
        console.error("Failed to fetch deadline tasks:", error);
        setTasks([]);
      } else {
        setTasks(data ?? []);
      }

      setIsLoading(false);
    };

    fetchTasks();
  }, []);

  return { tasks, isLoading };
}
