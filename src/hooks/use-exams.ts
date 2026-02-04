"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

// 🎯 1. Updated Type: Added the new DB columns as optional fields
export type Exam = {
  id: string;
  subject: string | null;
  exam_type: "Internal" | "Board" | "Competitive";
  date: string; 
  preparedness: number | null;
  // New Fields
  topics: string | null;
  exam_board?: string | null;
  competitive_exam_name?: string | null;
};

export function useExams() {
  const [upcoming, setUpcoming] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = useCallback(async () => {
    setLoading(true);

    const today = new Date().toISOString().slice(0, 10);

    // 🎯 2. Updated Select: Pulling the new columns from Supabase
    const { data, error } = await supabase
      .from("exams")
      .select("id, subject, exam_type, date, preparedness, topics, exam_board, competitive_exam_name") 
      .gte("date", today) 
      .order("date", { ascending: true });

    if (error) {
      console.error("Failed to fetch exams:", error);
      setUpcoming([]);
    } else {
      setUpcoming((data ?? []) as Exam[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const subjectCount = Array.from(
    new Set((upcoming ?? []).map((e) => e.subject).filter(Boolean))
  ).length;

  return {
    upcoming,
    subjectCount,
    loading,
    refresh: fetchExams,
  };
}