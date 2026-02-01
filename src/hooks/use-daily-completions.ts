"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function useDailyCompletions(date: Date) {
  const dateKey = useMemo(() => toDateKey(date), [date]);

  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("daily_completions")
      .select("source_type, source_id, date")
      .eq("date", dateKey);

    if (error) {
      console.error("Failed to fetch completions", error);
      setCompleted(new Set());
      setIsLoading(false);
      return;
    }

    // canonical storage key for current date only
    const next = new Set<string>(
      (data ?? []).map((r) => `${r.source_type}:${r.source_id}:${r.date}`)
    );

    setCompleted(next);
    setIsLoading(false);
  }, [dateKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const toggle = useCallback(
    async (source_type: string, source_id: string) => {
      if (!source_id) {
        console.warn("toggle called with empty source_id", { source_type });
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("No authenticated user", userError);
        return;
      }

      const rowKey = `${source_type}:${source_id}:${dateKey}`;
      const exists = completed.has(rowKey);

      if (exists) {
        const { error } = await supabase
          .from("daily_completions")
          .delete()
          .eq("user_id", user.id)
          .eq("source_type", source_type)
          .eq("source_id", source_id)
          .eq("date", dateKey);

        if (error) {
          console.error("Failed to delete completion", error);
          return;
        }

        setCompleted((prev) => {
          const next = new Set(prev);
          next.delete(rowKey);
          return next;
        });
      } else {
        const { error } = await supabase.from("daily_completions").insert({
          user_id: user.id,
          source_type,
          source_id,
          date: dateKey,
        });

        if (error) {
          console.error("Failed to insert completion", error);
          return;
        }

        setCompleted((prev) => new Set(prev).add(rowKey));
      }
    },
    [completed, dateKey]
  );

  return { completed, toggle, isLoading, refetch, dateKey };
}
