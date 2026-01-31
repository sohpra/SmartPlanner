"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function useDailyCompletions(date: Date) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const dateKey = date.toISOString().slice(0, 10);

  useEffect(() => {
    const fetch = async () => {
      const {
        data,
        error,
      } = await supabase
        .from("daily_completions")
        .select("source_type, source_id")
        .eq("date", dateKey);

      if (error) {
        console.error("Failed to fetch completions", error);
        return;
      }

      setCompleted(
        new Set(data.map((d) => `${d.source_type}:${d.source_id}`))
      );
    };

    fetch();
  }, [dateKey]);

  async function toggle(source_type: string, source_id: string) {
    if (!source_id) {
      console.warn("toggle called with empty source_id");
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

    const key = `${source_type}:${source_id}`;
    const exists = completed.has(key);

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
        next.delete(key);
        return next;
      });
    } else {
      const { error } = await supabase
        .from("daily_completions")
        .insert({
          user_id: user.id,          // 🔥 THIS WAS MISSING
          source_type,
          source_id,
          date: dateKey,
        });

      if (error) {
        console.error("Failed to insert completion", error);
        return;
      }

      setCompleted((prev) => new Set(prev).add(key));
    }
  }

  return { completed, toggle };
}
