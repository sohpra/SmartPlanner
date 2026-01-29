"use client";

import { LayoutReplit } from "../components/Layout.replit";
import { StatCard } from "../components/StatCard";
import { useExams } from "@/hooks/use-exams";
import { useRevision } from "@/hooks/use-revision";

export default function PlannerPage() {
  const exams = useExams();
  const revision = useRevision();

  return (
    <LayoutReplit>
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

      {/* Next sections will go here */}
      <div className="mt-10 text-sm text-muted-foreground">
        Planner dashboard — mock data
      </div>
    </LayoutReplit>
  );
}
