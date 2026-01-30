"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Exam = {
  id: string;
  subject: string;
  exam_type: string;
  date: string;
};

export function useExams() {
  const [upcoming, setUpcoming] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("exams")
      .select("id, subject, exam_type, date")
      .order("date", { ascending: true });

    console.log("FETCH EXAMS", data?.length);

    if (error) {
      console.error("Failed to fetch exams:", error);
      setUpcoming([]);
    } else {
      setUpcoming(data ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  return {
    upcoming,
    subjectCount: Array.from(
      new Set(upcoming.map((e) => e.subject))
    ).length,
    loading,
    refresh: fetchExams, // 🔑 THIS is the missing piece
  };
}
