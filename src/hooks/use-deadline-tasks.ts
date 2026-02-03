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
    // Notice the syntax: subjects(name). This joins the tables.
    const { data, error } = await supabase
      .from("deadline_tasks")
      .select(`
        id, 
        name, 
        due_date, 
        estimated_minutes, 
        status, 
        subject_id,
        subjects (
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

    // Inside fetchTasks()
    if (data) {
      const flattenedTasks = data.map(task => ({
        ...task,
        // subjects is returned as an array: [{ name: "Maths" }]
        // We grab the first item [0] or default to null
        subject: Array.isArray(task.subjects) 
          ? task.subjects[0]?.name 
          : (task.subjects as any)?.name || null
      }));
      setTasks(flattenedTasks as DeadlineTask[]);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  return { tasks, isLoading, fetchTasks };
}