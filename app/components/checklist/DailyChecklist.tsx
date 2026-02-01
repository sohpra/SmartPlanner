"use client";

import React from "react";
import type { DayPlan } from "@/lib/planner/buildWeekPlan";

type Props = {
  day: DayPlan;
  completions: {
    completed: Set<string>;
    toggle: (source_type: string, source_id: string) => Promise<void> | void;
    dateKey: string;
  };
};

function formatDate(date: string) {
  const d = new Date(date + "T00:00:00");
  const dow = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${dow} ${day}/${month}`;
}

export default function DailyChecklist({ day, completions }: Props) {
  const { completed, toggle, dateKey } = completions;

  // canonical key used in the hook's Set
  const k = (type: string, id: string) => `${type}:${id}:${dateKey}`;

  const hw = day.homework.items.filter((t) => !!t.id);
  const weekly = day.weekly.items.filter((t) => !!t.id);
  const projects = day.projects.items.filter((p) => !!p.projectId);

  return (
    <div className="space-y-8">
      {/* HOMEWORK */}
      <Section title="Homework & assignments">
        {hw.map((t) => {
          const key = k("deadline_task", t.id);
          return (
            <Item
              key={key}
              checked={completed.has(key)}
              onToggle={() => toggle("deadline_task", t.id)}
              label={`${t.name} · ${t.minutes} mins`}
              meta={`Due ${formatDate(t.dueDate)}`}
            />
          );
        })}
      </Section>

      {/* WEEKLY */}
      <Section title="Weekly tasks">
        {weekly.map((t) => {
          const key = k("weekly_task", t.id);
          return (
            <Item
              key={key}
              checked={completed.has(key)}
              onToggle={() => toggle("weekly_task", t.id)}
              label={`${t.name} · ${t.minutes} mins`}
              meta="Recurring"
            />
          );
        })}
      </Section>

      {/* REVISION */}
      <Section title="Revision">
        {day.revision.slots.map((s, i) => {
          // revision has no DB id; use deterministic per-day slot id
          const syntheticId = `${s.examId}:${i}`;
          const key = k("revision", syntheticId);

          return (
            <Item
              key={key}
              checked={completed.has(key)}
              onToggle={() => toggle("revision", syntheticId)}
              label={`${s.label} · ${s.slotMinutes} mins`}
              meta="Revision"
            />
          );
        })}
      </Section>

      {/* PROJECTS */}
      <Section title="Projects">
        {projects.map((p) => {
          const key = k("project", p.projectId);
          return (
            <Item
              key={key}
              checked={completed.has(key)}
              onToggle={() => toggle("project", p.projectId)}
              label={`${p.name} · ${p.minutes} mins`}
              meta="Project"
            />
          );
        })}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const count = React.Children.count(children);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>

      {count === 0 ? (
        <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-500">
          Nothing scheduled.
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function Item({
  checked,
  onToggle,
  label,
  meta,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  meta: string;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg border bg-white p-3`}>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span className={`text-sm ${checked ? "line-through opacity-70" : ""}`}>
          {label}
        </span>
      </label>
      <span className="text-xs text-gray-400">{meta}</span>
    </div>
  );
}
