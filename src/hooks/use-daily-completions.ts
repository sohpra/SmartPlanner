"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

export function useDailyCompletions(date: Date) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  const dateKey = date.toISOString().slice(0, 10);

  /* ================================
     Resolve auth ONCE
     ================================ */

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  /* ================================
     Fetch completions for date
     ================================ */

  useEffect(() => {
    if (!userId) {
      setCompleted(new Set());
      return;
    }

    const fetch = async () => {
      const { data, error } = await supabase
        .from("daily_completions")
        .select("source_type, source_id")
        .eq("user_id", userId)
        .eq("date", dateKey);

      if (error) {
        console.error("Failed to fetch completions", error);
        setCompleted(new Set());
        return;
      }

      setCompleted(
        new Set(data.map((d) => `${d.source_type}:${d.source_id}`))
      );
    };

    fetch();
  }, [userId, dateKey]);

  /* ================================
     Toggle (optimistic)
     ================================ */

  const toggle = useCallback(
    async (source_type: string, source_id: string) => {
      if (!userId || !source_id) return;

      const key = `${source_type}:${source_id}`;
      const exists = completed.has(key);
        console.log("TOGGLE CALLED", source_type, source_id);
      // ✅ optimistic update
      setCompleted((prev) => {
        const next = new Set(prev);
        exists ? next.delete(key) : next.add(key);
        return next;
      });
      

      // 🔁 persist in background
      if (exists) {
        const { error } = await supabase
          .from("daily_completions")
          .delete()
          .eq("user_id", userId)
          .eq("source_type", source_type)
          .eq("source_id", source_id)
          .eq("date", dateKey);

        if (error) {
          console.error("Failed to delete completion", error);
        }
      } else {
        const { error } = await supabase
          .from("daily_completions")
          .insert({
            user_id: userId,
            source_type,
            source_id,
            date: dateKey,
          });

        if (error) {
          console.error("Failed to insert completion", error);
        }
      }
    },
    [completed, userId, dateKey]
  );

  return { completed, toggle, userId };
}
