"use client";

import { StatCard } from "../components/StatCard";
import { DailyChecklist } from "../components/checklist/DailyChecklist";
import { TomorrowChecklist } from "../components/checklist/TomorrowChecklist";
import { ComingUp } from "../components/dashboard/ComingUp";
import { useExams } from "@/hooks/use-exams";
import { useRevision } from "@/hooks/use-revision";

export default function PlannerPage() {
  const exams = useExams();
  const revision = useRevision();

  return (
    <>
      {/* ===================== */}
      {/* STAT CARDS */}
      {/* ===================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Upcoming exams"
          value={exams.upcoming.length}
          icon="📝"
        />
        <StatCard
          title="Subjects"
          value={exams.subjectCount}
          icon="📚"
        />
        <StatCard
          title="Revision tasks"
          value={revision.tasks.length}
          icon="⏱️"
        />
      </div>

      <p className="mt-4 text-sm text-gray-500">
        Here's what’s on your plate.
      </p>

      <div className="mt-10 space-y-12">

        {/* TODAY */}
        <DailyChecklist date={new Date()} />

        {/* TOMORROW */}
        <TomorrowChecklist />

        {/* COMING UP */}
        <ComingUp />

      </div>
    </>
  );
}
