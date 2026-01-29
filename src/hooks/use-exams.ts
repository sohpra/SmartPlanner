"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    let isMounted = true;

    const fetchExams = async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("id, subject, exam_type, date")
        .order("date", { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error("Failed to fetch exams:", error);
        setUpcoming([]);
      } else {
        setUpcoming(data ?? []);
      }

      setLoading(false);
    };

    fetchExams();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    upcoming,
    subjectCount: Array.from(
      new Set(upcoming.map((e) => e.subject))
    ).length,
    loading,
  };
}
