"use client";

import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";

function daysUntil(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.round(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function ComingUp() {
  const exams = useExams();
  const { projects } = useProjects();

  const items: {
    id: string;
    label: string;
    meta: string;
  }[] = [];

  exams.upcoming.forEach((exam) => {
    const d = daysUntil(new Date(exam.date));
    if (d >= 0 && d <= 7) {
      items.push({
        id: `exam-${exam.id}`,
        label: `${exam.subject} exam`,
        meta: d === 0 ? "Today" : `In ${d} days`,
      });
    }
  });

  projects
    .filter((p) => p.status === "active")
    .forEach((project) => {
      const d = daysUntil(new Date(project.due_date));
      if (d >= 0 && d <= 7) {
        items.push({
          id: `project-${project.id}`,
          label: project.name,
          meta: d === 0 ? "Due today" : `Due in ${d} days`,
        });
      }
    });

  return (
    <div className="rounded-xl border bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">
        Coming up
      </h2>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-500">
          Nothing urgent in the next week.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border bg-gray-50 p-4"
            >
              <div className="font-medium">{item.label}</div>
              <span className="text-sm text-gray-500">
                {item.meta}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
