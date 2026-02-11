"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export interface DeadlineTask {
  id: string;
  name: string;
  due_date: string;
  scheduled_date: string | null; // 🎯 The Anchor
  is_fixed: boolean;             // 🎯 The "Special Lesson" flag
  estimated_minutes: number;
  status: string;
  subject: string | null;
}

export function useDeadlineTasks() {
  const [tasks, setTasks] = useState<DeadlineTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchTasks() {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from("deadline_tasks")
      .select(`
        id, 
        name, 
        due_date, 
        scheduled_date,
        is_fixed,
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
        subject: Array.isArray(t.subjects) 
          ? t.subjects[0]?.name 
          : t.subjects?.name || "General"
      }));
      setTasks(formattedTasks);
    }
    setIsLoading(false);
  }

  // 🎯 New: Function to update anchors or fixed status
  async function updateTask(taskId: string, updates: Partial<DeadlineTask>) {
    const { error } = await supabase
      .from("deadline_tasks")
      .update(updates)
      .eq("id", taskId);

    if (error) {
      console.error("Update error:", error.message);
      return { success: false };
    }

    // Optimistically update local state
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    return { success: true };
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  return { tasks, isLoading, fetchTasks, updateTask };
}