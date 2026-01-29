"use client";

import { Layout } from "../components/Layout";
import { StatCard } from "../components/StatCard";
import { useExams } from "@/hooks/use-exams";
import { useRevision } from "@/hooks/use-revision";

export default function PlannerPage() {
  return (
    <Layout>
      <div>Planner OK</div>
    </Layout>
  );
}


/*
import { Layout } from "../components/Layout";
import { StatCard } from "../components/StatCard";
import { useExams } from "@/hooks/use-exams";
import { useRevision } from "@/hooks/use-revision";

export default function PlannerPage() {
  const exams = useExams();
  const revision = useRevision();

  return (
    <Layout>
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

      <div className="mt-10 text-muted-foreground">
        Planner dashboard UI — mock data
      </div>
    </Layout>
  );
}
*/