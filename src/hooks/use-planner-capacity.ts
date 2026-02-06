"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export type CapacityData = {
  weeklyPattern: Record<number, number>; // 0-6 day of week -> minutes
  dateOverrides: Record<string, number>; // YYYY-MM-DD -> minutes
  labels: Record<string, string>;        // YYYY-MM-DD -> "Half Term", etc.
};

export function usePlannerCapacity() {
  const [capacityData, setCapacityData] = useState<CapacityData | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchCapacity() {
    try {
      setLoading(true);
      
      // 1. Fetch Weekly Patterns
      const { data: settings } = await supabase
        .from("planner_settings")
        .select("day_of_week, base_minutes");

      // 2. Fetch Date Overrides
      const { data: overrides } = await supabase
        .from("planner_overrides")
        .select("date, override_minutes, label");

      // 3. Format Weekly Map
      const weeklyMap: Record<number, number> = {};
      (settings || []).forEach((s) => {
        weeklyMap[s.day_of_week] = s.base_minutes;
      });

      // 4. Format Overrides Map
      const overridesMap: Record<string, number> = {};
      const labelsMap: Record<string, string> = {};
      (overrides || []).forEach((o) => {
        overridesMap[o.date] = o.override_minutes;
        if (o.label) labelsMap[o.date] = o.label;
      });

      setCapacityData({
        weeklyPattern: weeklyMap,
        dateOverrides: overridesMap,
        labels: labelsMap,
      });
    } catch (error) {
      console.error("Error fetching capacity:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCapacity();
  }, []);

  return { capacityData, loading, refresh: fetchCapacity };
}