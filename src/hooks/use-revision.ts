"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";


export function useRevision() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

const fetchRevision = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("revision_slots")
        .select(`
          id, 
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
        // Log the actual string message from Supabase
        console.error("❌ Supabase Error:", error.message);
        throw error;
      }


      const mapped = data?.map((row: any) => ({
          id: row.id,
          date: row.date,
          duration_minutes: row.duration_minutes,
          displayName: row.description, // Matches 'description' in your SQL
          subject: row.exam?.subject,
          isDone: row.is_completed, // Matches 'is_completed' in your SQL
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

  return { slots: tasks, isLoading: loading };
}