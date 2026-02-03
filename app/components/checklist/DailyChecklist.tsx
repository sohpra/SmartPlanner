"use client";

import { DayPlan } from "@/lib/planner/buildWeekPlan";

interface Props {
  day: DayPlan;
  completions: {
    completed: Set<string>;
    toggle: (type: string, id: string) => void;
    dateKey: string; // Ensure this is passed from the hook
  };
}

export default function DailyChecklist({ day, completions }: Props) {
  // 1. Unified sections with consistent data mapping
  const sections = [
    { label: "Homework", items: day.homework.items, type: "deadline_task" },
    { label: "Weekly Tasks", items: day.weekly.items, type: "weekly_task" },
    { 
      label: "Revision", 
      items: day.revision.slots.map(s => ({ 
        id: s.examId, 
        name: s.label, 
        subject: s.subject, 
        minutes: s.slotMinutes 
      })), 
      type: "revision" 
    },
    { label: "Projects", items: day.projects.items, type: "project" }
  ];

  return (
    <div className="space-y-8">
      {sections.map(section => section.items.length > 0 && (
        <section key={section.label}>
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
            {section.label}
          </h3>
          <div className="space-y-3">
            {section.items.map((item: any, idx: number) => {
              /**
               * CRITICAL FIX: The key must match the hook's format exactly.
               * We use the ID and Type. The Hook handles the Date filter.
               */
              const itemKey = `${section.type}:${item.id}`;
              const isDone = completions.completed.has(itemKey);
              
              return (
                <div 
                  key={`${itemKey}-${idx}`} 
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    isDone ? "opacity-50 bg-gray-50 border-gray-100" : "bg-white border-gray-200 shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <input 
                      type="checkbox" 
                      checked={isDone} 
                      onChange={() => completions.toggle(section.type, item.id)} 
                      className="h-5 w-5 rounded border-gray-300 text-blue-600 accent-blue-600 cursor-pointer" 
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-bold ${isDone ? "line-through text-gray-400" : "text-gray-800"}`}>
                          {item.name}
                        </p>
                        {/* THE SUBJECT BADGE: Pulled from the engine's mapped subjects */}
                        {item.subject && (
                          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-tight">
                            {item.subject}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-gray-400">
                        {item.minutes} mins
                      </p>
                    </div>
                  </div>
                  
                  {item.dueDate && (
                    <span className="text-[9px] font-bold bg-gray-100 px-2 py-1 rounded text-gray-500 uppercase">
                      Due {new Date(item.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}