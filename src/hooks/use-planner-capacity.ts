"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

export type CapacityData = {
  weeklyPattern: Record<number, number>; // 0-6 -> minutes
  dateOverrides: Record<string, number>; // YYYY-MM-DD -> minutes
  labels: Record<string, string>;        // YYYY-MM-DD -> "Half Term"
};

// 🎯 Hardcoded defaults so the UI never starts at 0
const DEFAULT_WEEKLY_PATTERN: Record<number, number> = {
  1: 150, // Mon
  2: 150, // Tue
  3: 150, // Wed
  4: 150, // Thu
  5: 150, // Fri
  6: 150, // Sat
  0: 150  // Sun
};

export function usePlannerCapacity() {
  const [capacityData, setCapacityData] = useState<CapacityData>({
    weeklyPattern: DEFAULT_WEEKLY_PATTERN,
    dateOverrides: {},
    labels: {},
  });
  const [loading, setLoading] = useState(true);

  const fetchCapacity = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch both tables in parallel
      const [settingsResp, overridesResp] = await Promise.all([
        supabase.from("planner_settings").select("day_of_week, base_minutes"),
        supabase.from("planner_overrides").select("date, override_minutes, label")
      ]);

      if (settingsResp.error) throw settingsResp.error;
      if (overridesResp.error) throw overridesResp.error;

      // 2. Process Weekly Pattern (Merge DB values over Defaults)
      const weeklyMap = { ...DEFAULT_WEEKLY_PATTERN };
      if (settingsResp.data && settingsResp.data.length > 0) {
        settingsResp.data.forEach((s) => {
          weeklyMap[s.day_of_week] = s.base_minutes;
        });
      }

      // 3. Process Overrides
      const overridesMap: Record<string, number> = {};
      const labelsMap: Record<string, string> = {};
      if (overridesResp.data) {
        overridesResp.data.forEach((o) => {
          overridesMap[o.date] = o.override_minutes;
          if (o.label) labelsMap[o.date] = o.label;
        });
      }

      setCapacityData({
        weeklyPattern: weeklyMap,
        dateOverrides: overridesMap,
        labels: labelsMap,
      });

    } catch (error) {
      console.error("Error in usePlannerCapacity:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCapacity();
  }, [fetchCapacity]);

  return { 
    capacityData, 
    loading, 
    refresh: fetchCapacity 
  };
}