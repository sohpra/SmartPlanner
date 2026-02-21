"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

export function useRevision() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRevision = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("revision_slots")
        .select(`
          id, 
          exam_id,
          date, 
          duration_minutes, 
          description, 
          is_completed,
          exam:exams (
            id,
            date,
            subject, 
            exam_type, 
            competitive_exam_name,
            exam_board
          )
        `);

      if (error) {
        console.error("❌ Supabase Error:", error.message);
        throw error;
      }

      const mapped = data?.map((row: any) => ({
          id: row.id,
          exam_id: row.exam_id, // 🎯 Ensure exam_id is mapped for the 'Get Ahead' logic
          date: row.date,
          duration_minutes: row.duration_minutes,
          displayName: row.description,
          subject: row.exam?.subject,
          is_completed: row.is_completed, // Matches your ExamsPage usage
          isDone: row.is_completed, 
          exam: row.exam
      }));

      setTasks(mapped || []);
    } catch (err: any) {
      console.error("❌ HOOK: Fetch Error", err.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRevision();
  }, [fetchRevision]);

  // 🎯 Export 'fetchRevision' as 'refresh' to clear the TS error in ExamsPage
  return { 
    slots: tasks, 
    isLoading: loading, 
    refresh: fetchRevision 
  };
}