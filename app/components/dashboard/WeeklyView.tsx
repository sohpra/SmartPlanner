"use client";

import React from "react";
import type { WeekPlan, DayPlan } from "@/lib/planner/buildWeekPlan";

type Props = {
  plan: WeekPlan;
};

export function WeeklyView({ plan }: Props) {
  return (
    <div className="w-full overflow-x-auto pb-4">
      {/* 7-Column Grid: One for each day of the week */}
      <div className="grid grid-cols-7 gap-3 min-w-[1000px]">
        {plan.days.map((day) => (
          <DayColumn key={day.date} day={day} />
        ))}
      </div>
    </div>
  );
}

function DayColumn({ day }: { day: DayPlan }) {
  const dateObj = new Date(day.date + "T00:00:00");
  const dayName = dateObj.toLocaleDateString("en-GB", { weekday: "short" });
  const dayNum = dateObj.getDate();

  // Calculate fullness percentage
  const loadPercentage = Math.min(100, (day.totalUsed / day.baseCapacity) * 100);
  const isOverloaded = day.totalUsed > day.baseCapacity;

  return (
    <div className="flex flex-col gap-3">
      {/* Header: Date and Capacity Gauge */}
      <div className="text-center">
        <div className="text-xs font-bold uppercase text-gray-400">{dayName}</div>
        <div className="text-lg font-semibold text-gray-700">{dayNum}</div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full transition-all ${
              isOverloaded ? "bg-red-500" : "bg-blue-500"
            }`}
            style={{ width: `${loadPercentage}%` }}
          />
        </div>
      </div>

      {/* Task Blocks */}
      <div className="flex flex-col gap-1.5">
        {/* Layer 1: Weekly */}
        {day.weekly.items.map((item) => (
          <TaskBlock
            key={`weekly-${item.id}`}
            label={item.name}
            minutes={item.minutes}
            colorClass="bg-indigo-50 border-indigo-200 text-indigo-700"
            type="Weekly"
          />
        ))}

        {/* Layer 2: Homework/Deadlines */}
        {day.homework.items.map((item) => (
          <TaskBlock
            key={`hw-${item.id}`}
            label={item.name}
            minutes={item.minutes}
            colorClass="bg-emerald-50 border-emerald-200 text-emerald-700"
            type="Deadline"
          />
        ))}

        {/* Layer 3: Revision */}
        {day.revision.slots.map((slot, i) => (
          <TaskBlock
            key={`rev-${slot.examId}-${i}`}
            label={slot.subject}
            minutes={slot.slotMinutes}
            colorClass="bg-amber-50 border-amber-200 text-amber-700"
            type="Revision"
          />
        ))}

        {/* Layer 4: Projects */}
        {day.projects.items.map((project) => (
          <TaskBlock
            key={`proj-${project.projectId}`}
            label={project.name}
            minutes={project.minutes}
            colorClass="bg-sky-50 border-sky-200 text-sky-700"
            type="Project"
          />
        ))}

        {day.totalUsed === 0 && (
          <div className="py-8 text-center text-[10px] italic text-gray-300 border border-dashed rounded-lg">
            Free Day
          </div>
        )}
      </div>
    </div>
  );
}

function TaskBlock({
  label,
  minutes,
  colorClass,
  type,
}: {
  label: string;
  minutes: number;
  colorClass: string;
  type: string;
}) {
  return (
    <div
      className={`group relative rounded-lg border p-2 shadow-sm transition-all hover:shadow-md ${colorClass}`}
    >
      <div className="truncate text-[11px] font-bold leading-tight">{label}</div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] opacity-70 uppercase font-black tracking-tighter">{type}</span>
        <span className="text-[10px] font-medium">{minutes}m</span>
      </div>
    </div>
  );
}