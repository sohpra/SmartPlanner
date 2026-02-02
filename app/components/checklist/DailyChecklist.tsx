"use client";

import { DayPlan } from "@/lib/planner/buildWeekPlan";

interface Props {
  day: DayPlan;
  completions: {
    completed: Set<string>;
    toggle: (type: string, id: string) => void;
  };
}

export default function DailyChecklist({ day, completions }: Props) {
  const sections = [
    { label: "Homework", items: day.homework.items, type: "deadline_task" },
    { label: "Weekly Tasks", items: day.weekly.items, type: "weekly_task" },
    { label: "Revision", items: day.revision.slots.map(s => ({ id: s.examId, name: `${s.subject} Revision`, minutes: s.slotMinutes })), type: "revision" },
    { label: "Projects", items: day.projects.items, type: "project" }
  ];

  return (
    <div className="space-y-8">
      {sections.map(section => section.items.length > 0 && (
        <section key={section.label}>
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{section.label}</h3>
          <div className="space-y-3">
            {section.items.map((item: any) => {
              const itemKey = `${section.type}:${item.id}`;
              const isDone = completions.completed.has(itemKey);
              return (
                <div key={itemKey} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isDone ? "opacity-50 bg-gray-50" : "bg-white border-gray-200 shadow-sm"}`}>
                  <div className="flex items-center gap-4">
                    <input type="checkbox" checked={isDone} onChange={() => completions.toggle(section.type, item.id)} className="h-5 w-5 accent-blue-600" />
                    <div>
                      <p className={`text-sm font-semibold ${isDone ? "line-through text-gray-400" : "text-gray-700"}`}>{item.name || item.label}</p>
                      <p className="text-[11px] text-gray-400">{item.minutes} mins</p>
                    </div>
                  </div>
                  {item.dueDate && <span className="text-[9px] font-bold bg-gray-100 px-2 py-1 rounded text-gray-500">DUE {new Date(item.dueDate).toLocaleDateString()}</span>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}