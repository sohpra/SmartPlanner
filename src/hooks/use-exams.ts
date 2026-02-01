"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type Exam = {
  id: string;
  subject: string | null;
  exam_type: "Internal" | "Board" | "Competitive";
  date: string; // YYYY-MM-DD (date-only semantics)
  preparedness: number | null;
};

export function useExams() {
  const [upcoming, setUpcoming] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("exams")
      .select("id, subject, exam_type, date, preparedness")
      .order("date", { ascending: true });

    console.log("FETCH EXAMS", data?.length);

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

  return {
    upcoming,
    subjectCount: Array.from(
      new Set((upcoming ?? []).map((e) => e.subject).filter(Boolean))
    ).length,
    loading,
    refresh: fetchExams,
  };
}
