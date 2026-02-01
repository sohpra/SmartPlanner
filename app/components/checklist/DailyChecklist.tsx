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
  if (!date) return "";
  const d = new Date(date + "T00:00:00");
  const dow = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${dow} ${day}/${month}`;
}

export default function DailyChecklist({ day, completions }: Props) {
  const { completed, toggle, dateKey } = completions;

  // Canonical key generation: must match exactly what the Hook uses to check .has()
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

      {/* REVISION (Aligned with Layer 2 Engine) */}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const count = React.Children.count(children);
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</h3>
      {count === 0 ? (
        <div className="rounded-lg border bg-gray-50/50 p-3 text-sm text-gray-400 italic">
          Nothing scheduled.
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function Item({ checked, onToggle, label, meta }: { checked: boolean; onToggle: () => void; label: string; meta: string }) {
  return (
    <div className={`group flex items-center justify-between rounded-xl border p-4 transition-all ${checked ? "bg-gray-50 border-gray-100" : "bg-white border-gray-200 hover:border-blue-300 shadow-sm"}`}>
      <label className="flex items-center gap-4 cursor-pointer select-none flex-1">
        <input 
          type="checkbox" 
          checked={checked} 
          onChange={onToggle}
          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all"
        />
        <div className="flex flex-col">
          <span className={`text-sm font-medium transition-all ${checked ? "line-through text-gray-400" : "text-gray-700"}`}>
            {label}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-0.5 md:hidden">
            {meta}
          </span>
        </div>
      </label>
      <span className="hidden md:block text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded">
        {meta}
      </span>
    </div>
  );
}