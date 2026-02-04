"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export interface DeadlineTask {
  id: string;
  name: string;
  due_date: string;
  estimated_minutes: number;
  status: string;
  subject: string | null; // This will now hold the string from the join
}

export function useDeadlineTasks() {
  const [tasks, setTasks] = useState<DeadlineTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchTasks() {
    setIsLoading(true);
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from("deadline_tasks")
      .select(`
        id, 
        name, 
        due_date, 
        estimated_minutes, 
        status, 
        subject_id,
        subjects!left (
          name
        )
      `)
      .eq("status", "active")
      .order("due_date", { ascending: true });

    if (error) {
      console.error("Fetch error:", error.message);
      setIsLoading(false);
      return;
    }

    if (data) {
      const formattedTasks = data.map((t: any) => ({
        ...t,
        // Handle the array-vs-object mismatch for TypeScript
        subject: Array.isArray(t.subjects) 
          ? t.subjects[0]?.name 
          : t.subjects?.name || "General"
      }));
      setTasks(formattedTasks);
    }
    setIsLoading(false);

  }


  useEffect(() => {
    fetchTasks();
  }, []);

  return { tasks, isLoading, fetchTasks };
}