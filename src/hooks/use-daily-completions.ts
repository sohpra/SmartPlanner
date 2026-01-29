"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function useDailyCompletions(date: Date) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const dateKey = date.toISOString().slice(0, 10);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("daily_completions")
        .select("source_type, source_id")
        .eq("date", dateKey);

      if (data) {
        setCompleted(
          new Set(data.map((d) => `${d.source_type}:${d.source_id}`))
        );
      }
    };

    fetch();
  }, [dateKey]);

  async function toggle(source_type: string, source_id: string) {
    const key = `${source_type}:${source_id}`;
    const exists = completed.has(key);

    if (exists) {
      await supabase
        .from("daily_completions")
        .delete()
        .eq("source_type", source_type)
        .eq("source_id", source_id)
        .eq("date", dateKey);

      setCompleted((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      await supabase.from("daily_completions").insert({
        source_type,
        source_id,
        date: dateKey,
      });

      setCompleted((prev) => new Set(prev).add(key));
    }
  }

  return { completed, toggle };
}
