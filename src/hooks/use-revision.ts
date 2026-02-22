"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

export function useRevision() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRevision = useCallback(async () => {
    try {
      setLoading(true);

      const today = new Date().toISOString().split("T")[0];

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("revision_slots")
        .select(`
          id,
          exam_id,
          date,
          duration_minutes,
          description,
          is_completed,
          is_fixed,
          slot_type,
          subject,
          exam:exams (
            id,
            date,
            subject,
            exam_type,
            competitive_exam_name,
            exam_board
          )
        `)
        .eq("user_id", user.id)
        .gte("date", today)
        .order("date", { ascending: true });

      if (error) {
        console.error("❌ Supabase Error:", error.message);
        throw error;
      }

      const mapped = (data ?? []).map((row: any) => ({
        id:               row.id,
        exam_id:          row.exam_id,
        date:             row.date,
        duration_minutes: row.duration_minutes,
        displayName:      row.description,
        // subject: prefer the slot's own subject column, fall back to exam join
        subject:          row.subject ?? row.exam?.subject,
        is_completed:     row.is_completed,
        isDone:           row.is_completed,
        // New fields required by buildWeekPlan and the UI
        is_fixed:         row.is_fixed  ?? false,
        slot_type:        row.slot_type ?? "standard",
        exam:             row.exam,
      }));

      setTasks(mapped);
    } catch (err: any) {
      console.error("❌ HOOK: Fetch Error", err.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRevision();
  }, [fetchRevision]);

  return {
    slots:     tasks,
    isLoading: loading,
    refresh:   fetchRevision,
  };
}