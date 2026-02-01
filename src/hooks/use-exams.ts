"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type Exam = {
  id: string;
  subject: string | null;
  exam_type: "Internal" | "Board" | "Competitive";
  date: string; // YYYY-MM-DD
  preparedness: number | null;
};

export function useExams() {
  const [upcoming, setUpcoming] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = useCallback(async () => {
    setLoading(true);

    // 🚀 FILTER: Get today's date in YYYY-MM-DD to filter out past exams
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("exams")
      .select("id, subject, exam_type, date, preparedness")
      .gte("date", today) // Only fetch exams scheduled for today or later
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

  // Derived state remains the same to avoid regressing your metrics
  const subjectCount = Array.from(
    new Set((upcoming ?? []).map((e) => e.subject).filter(Boolean))
  ).length;

  return {
    upcoming, // This is now filtered to only include future exams
    subjectCount,
    loading,
    refresh: fetchExams,
  };
}