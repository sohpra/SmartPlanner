"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type RevisionTask = {
  id: string;
  subject: string;
  displayName: string; // 🎯 Added this for the specific Exam Name
  date: string;
  duration_minutes: number;
  exam_type?: string;
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
            subject,
            exam_type,
            competitive_exam_name,
            exam_board
          )
        `) // 🎯 Pulling all specific exam metadata now
        .order("date", { ascending: true });

      if (error) {
        console.error("Failed to fetch revision slots:", error);
        setTasks([]);
      } else {
        const mapped =
          data?.map((row: any) => {
            const exam = row.exam;
            
            // 🎯 LOGIC: Prioritize specific names for Competitive/Board exams
            let name = exam?.subject ?? "General";
            if (exam?.exam_type === "Competitive" && exam.competitive_exam_name) {
              name = exam.competitive_exam_name;
            } else if (exam?.exam_type === "Board" && exam.exam_board) {
              name = `${exam.subject} (${exam.exam_board})`;
            }

            return {
              id: row.id,
              date: row.date,
              duration_minutes: row.duration_minutes,
              subject: exam?.subject ?? "General",
              displayName: name, // This is the "Olympiad" or "Physics P1" label
              exam_type: exam?.exam_type
            };
          }) ?? [];

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