"use client";

import type { DayPlan } from "@/lib/planner/buildWeekPlan";

/* ================================
   Helpers
================================ */

function formatDate(date: string) {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

/* ================================
   Types
================================ */

type Props = {
  day: DayPlan;
};

/* ================================
   Component
================================ */

export function TomorrowChecklist({ day }: Props) {
  const hasAnything =
    day.weekly.items.length > 0 ||
    day.homework.items.length > 0 ||
    day.projects.items.length > 0 ||
    day.revision.slots.length > 0;

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tomorrow</h3>
        <span className="text-sm text-gray-500">
          {formatDate(day.date)}
        </span>
      </div>

      {!hasAnything && (
        <div className="text-sm text-gray-500">
          Nothing scheduled yet.
        </div>
      )}

      {/* WEEKLY */}
      {day.weekly.items.map((t, i) => (
        <Item
          key={`weekly:${t.id}:${day.date}:${i}`}
          label={`${t.name} · ${t.minutes} mins`}
        />
      ))}

      {/* HOMEWORK */}
      {day.homework.items.map((t, i) => (
        <Item
          key={`deadline:${t.id}:${day.date}:${i}`}
          label={`${t.name} · ${t.minutes} mins`}
          meta={`Due ${formatDate(t.dueDate)}`}
        />
      ))}

      {/* PROJECTS */}
      {day.projects.items.map((p, i) => (
        <Item
          key={`project:${p.projectId}:${day.date}:${i}`}
          label={`${p.name} · ${p.minutes} mins`}
        />
      ))}

      {/* REVISION */}
      {day.revision.slots.map((s, i) => (
        <Item
          key={`revision:${s.examId}:${day.date}:${i}`}
          label={`${s.label} · ${s.slotMinutes} mins`}
        />
      ))}
    </div>
  );
}

/* ================================
   Small helper
================================ */

function Item({
  label,
  meta,
}: {
  label: string;
  meta?: string;
}) {
  return (
    <div className="rounded-lg border px-3 py-2 text-sm">
      <div>{label}</div>
      {meta && (
        <div className="text-xs text-gray-400">{meta}</div>
      )}
    </div>
  );
}
