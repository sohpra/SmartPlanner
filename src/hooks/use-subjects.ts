"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type Subject = {
  id: string;
  name: string;
  color: string;
};

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubjects = async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, color")
        .order("name");

      if (error) {
        console.error("Failed to fetch subjects:", error);
        setSubjects([]);
      } else {
        setSubjects(data ?? []);
      }

      setLoading(false);
    };

    fetchSubjects();
  }, []);

  return { subjects, loading };
}
