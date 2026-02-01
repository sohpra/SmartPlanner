"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type WeeklyTask = {
  id: string;                    // 🔒 REQUIRED
  name: string;
  day_of_week: number;
  duration_minutes: number;
};

export function useWeeklyTasks() {
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("recurring_tasks")
        .select("id,name,day_of_week,duration_minutes")
        .order("day_of_week", { ascending: true });

      if (error) {
        console.error("Failed to fetch weekly tasks", error);
        setTasks([]);
      } else {
        setTasks(data as WeeklyTask[]);
      }

      setIsLoading(false);
    };

    fetch();
  }, []);

  return { tasks, isLoading };
}
