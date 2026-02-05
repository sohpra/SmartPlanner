import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

export function usePlannerDeadlineTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlannerData = useCallback(async () => {
    setIsLoading(true);
    // Get local YYYY-MM-DD to match the DB format
    const today = new Date().toLocaleDateString('en-CA'); 
    
    const { data, error } = await supabase
      .from("deadline_tasks")
      .select(`
        id, name, due_date, estimated_minutes, status, subject_id,
        subjects!left ( name )
      `)
      // 🎯 THE UPDATED RULE: 
      // 1. All Active tasks (so the engine can plan ahead)
      // 2. ANY task marked completed (the engine will filter out the old ones using our 'Exorcism' logic)
      .or(`status.eq.active,status.eq.completed`) 
      .order("due_date", { ascending: true });
    if (error) {
      console.error("Planner Fetch Error:", error.message);
    }

    if (data) {
      // Flatten the subject array so the engine receives a clean string
      const formatted = data.map(t => ({
        ...t,
        subject: Array.isArray(t.subjects) 
          ? t.subjects[0]?.name 
          : (t.subjects as any)?.name || "General"
      }));
      setTasks(formatted);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchPlannerData();
  }, [fetchPlannerData]);

  /**
   * 🎯 THE SYNC FIX:
   * This updates the local task status immediately.
   * When you toggle a task, the Checklist sees the status change 
   * and moves it between 'Active' and 'Finalized' without a refresh.
   */
  const updateTaskStatusLocally = useCallback((id: string, newStatus: string) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, status: newStatus } : t
    ));
  }, []);

  return { 
    tasks, 
    isLoading, 
    updateTaskStatusLocally, // 🎯 Return this for useDailyCompletions
    refresh: fetchPlannerData 
  };
}