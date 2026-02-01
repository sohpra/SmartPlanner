"use client";

import React from "react";
import type { DayPlan } from "@/lib/planner/buildWeekPlan";
import { useDailyCompletions } from "@/hooks/use-daily-completions";

/* ================================
   Helpers
================================ */

function formatDate(date: string) {
  const d = new Date(date + "T00:00:00");
  const dow = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${dow} ${day}/${month}`;
}

/* ================================
   Types
================================ */

export type DailyChecklistProps = {
  day: DayPlan;
};

/* ================================
   Component
================================ */
export default function DailyChecklist({ day }: { day: DayPlan }) {

  const { completed, toggle } = useDailyCompletions(
    new Date(day.date + "T00:00:00")
  );

  const isDone = (key: string) => completed.has(key);

  const taskKeys = [
    ...day.homework.items.map((t) => `deadline_task:${t.id}`),
    ...day.weekly.items.map((t) => `weekly_task:${t.id}`),
    ...day.projects.items.map((p) => `project:${p.projectId}`),
    // NOTE: revision completion is disabled for now, so not counted here
  ];

  const totalTasks =
    day.homework.items.length +
    day.weekly.items.length +
    day.revision.slots.length +
    day.projects.items.length;

  const completedTasks = taskKeys.filter((k) => completed.has(k)).length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Today</h2>
        <span className="text-sm text-gray-600">
          {completedTasks} / {totalTasks} tasks completed
        </span>
      </div>

      {/* OVERLOAD WARNING */}
      {day.totalUsed > day.baseCapacity && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          ⚠️ Day overloaded ({day.totalUsed} / {day.baseCapacity} mins)
        </div>
      )}

      {/* HOMEWORK */}
      <Section title="Homework & assignments">
        {day.homework.items.map((t) => {
          const key = `deadline_task:${t.id}`;
          return (
            <Item
              key={key}
              checked={isDone(key)}
              onToggle={() => toggle("deadline_task", t.id)}
              label={`${t.name} · ${t.minutes} mins`}
              meta={`Due ${formatDate(t.dueDate)}`}
            />
          );
        })}
      </Section>

      {/* WEEKLY */}
      <Section title="Weekly tasks">
        {day.weekly.items.map((t) => {
          const key = `weekly_task:${t.id}`;
          return (
            <Item
              key={key}
              checked={isDone(key)}
              onToggle={() => toggle("weekly_task", t.id)}
              label={`${t.name} · ${t.minutes} mins`}
              meta="Recurring"
            />
          );
        })}
      </Section>

      {/* REVISION (display-only for now) */}
      <Section title="Revision">
        {day.revision.slots.map((s, i) => (
          <Item
            key={`${s.examId}-${i}`}
            checked={false}
            disabled
            label={`${s.label} · ${s.slotMinutes} mins`}
            meta="Revision"
          />
        ))}
      </Section>

      {/* PROJECTS */}
      <Section title="Projects">
        {day.projects.items.map((p) => {
          const key = `project:${p.projectId}`;
          return (
            <Item
              key={key}
              checked={isDone(key)}
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

/* ================================
   Small UI helpers
================================ */

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
  disabled,
}: {
  checked: boolean;
  onToggle?: () => void;
  label: string;
  meta: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border bg-white p-3 ${
        checked ? "opacity-60" : ""
      }`}
    >
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={disabled}
        />
        <span className={`text-sm ${checked ? "line-through" : ""}`}>
          {label}
        </span>
      </label>
      <span className="text-xs text-gray-400">{meta}</span>
    </div>
  );
}
