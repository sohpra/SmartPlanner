"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type RevisionTask = {
  id: string;
  subject: string;
  date: string;
  duration_minutes: number;
};

export function useRevision() {
  const [tasks, setTasks] = useState<RevisionTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRevision = async () => {
      const { data, error } = await supabase
        .from("revision_slots")
        .select(`
          id,
          date,
          duration_minutes,
          exam:exams!revision_slots_exam_id_fkey (
            subject
          )
        `)
        .order("date", { ascending: true });

      if (error) {
        console.error("Failed to fetch revision slots:", error);
        setTasks([]);
      } else {
        const mapped =
          data?.map((row: any) => ({
            id: row.id,
            date: row.date,
            duration_minutes: row.duration_minutes,
            subject: row.exam?.subject ?? "General",
          })) ?? [];

        setTasks(mapped);
      }

      setLoading(false);
    };

    fetchRevision();
  }, []);

  return {
    tasks,
    loading,
  };
}
