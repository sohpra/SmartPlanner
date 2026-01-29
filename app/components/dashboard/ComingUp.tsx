"use client";

import { useExams } from "@/hooks/use-exams";
import { useProjects } from "@/hooks/use-projects";

function daysFromTomorrow(date: Date) {
  const base = new Date();
  base.setDate(base.getDate() + 1);
  base.setHours(0, 0, 0, 0);

  date.setHours(0, 0, 0, 0);

  return Math.round(
    (date.getTime() - base.getTime()) / (1000 * 60 * 60 * 24)
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

  exams.upcoming.forEach(exam => {
    const d = daysFromTomorrow(new Date(exam.date));
    if (d >= 1 && d <= 7) {
      items.push({
        id: `exam-${exam.id}`,
        label: `${exam.subject} exam`,
        meta: `In ${d} days`,
      });
    }
  });

  projects
    .filter(p => p.status === "active" && p.due_date)
    .forEach(project => {
      const d = daysFromTomorrow(new Date(project.due_date));
      if (d >= 1 && d <= 7) {
        items.push({
          id: `project-${project.id}`,
          label: project.name,
          meta: `Due in ${d} days`,
        });
      }
    });

  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold">Coming up</h3>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-500">
          Nothing urgent after tomorrow.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className="flex justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <span>{item.label}</span>
              <span className="text-gray-500">{item.meta}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
