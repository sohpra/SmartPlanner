"use client";

import React from "react";

interface ComingUpProps {
  // We use specific types or 'any[]' to match the frozen data from the parent
  deadlines: any[]; 
  exams: any[];
}

function daysFromTomorrow(dateStr: string) {
  const date = new Date(dateStr);
  const base = new Date();
  base.setDate(base.getDate() + 1);
  base.setHours(0, 0, 0, 0);

  date.setHours(0, 0, 0, 0);

  const diff = Math.round(
    (date.getTime() - base.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diff;
}

export function ComingUp({ deadlines, exams }: ComingUpProps) {
  const items: {
    id: string;
    label: string;
    meta: string;
  }[] = [];

  // 1. Process Exams from Props
  exams.forEach(exam => {
    const d = daysFromTomorrow(exam.date);
    // Show items happening between 1 and 14 days from tomorrow
    if (d >= 1 && d <= 14) {
      items.push({
        id: `exam-${exam.id}`,
        label: `${exam.subject} Exam`,
        meta: d === 1 ? "In 1 day" : `In ${d} days`,
      });
    }
  });

  // 2. Process Deadlines/Homework from Props
  deadlines.forEach(task => {
    const d = daysFromTomorrow(task.dueDate || task.due_date);
    if (d >= 1 && d <= 14) {
      items.push({
        id: `task-${task.id}`,
        label: task.name,
        meta: d === 1 ? "Due tomorrow" : `Due in ${d} days`,
      });
    }
  });

  // Sort items by urgency (days remaining)
  items.sort((a, b) => {
    const extractDays = (s: string) => parseInt(s.replace(/\D/g, "")) || 0;
    return extractDays(a.meta) - extractDays(b.meta);
  });

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-gray-400">
        Coming Up
      </h3>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-gray-50/50 p-4 text-center text-xs text-gray-400">
          Your schedule looks clear for the next two weeks.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2.5 text-sm transition-hover hover:border-blue-100"
            >
              <span className="font-medium text-gray-700">{item.label}</span>
              <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded">
                {item.meta.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}