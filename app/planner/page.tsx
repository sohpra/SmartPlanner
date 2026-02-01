"use client";

import TodayChecklistSimple from "../components/checklist/TodayChecklistSimple";
import { useWeekPlan } from "@/hooks/use-week-plan";
import type { DayPlan } from "@/lib/planner/buildWeekPlan";

export default function PlannerPage() {
  const { weekPlan, isLoading } = useWeekPlan();

  if (isLoading || !weekPlan) {
    return (
      <div className="p-6 text-sm text-gray-500">
        Loading planner…
      </div>
    );
  }

  const todayPlan: DayPlan = weekPlan.days[0];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">
        Planner (Temporary Minimal View)
      </h1>

      <section className="rounded-xl border bg-white p-6">
        <TodayChecklistSimple day={todayPlan} />
      </section>
    </div>
  );
}
