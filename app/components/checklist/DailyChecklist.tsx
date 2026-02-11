"use client";

import { DayPlan } from "@/lib/planner/buildWeekPlan";
import { supabase } from "@/lib/supabase/client";

// 🎯 VERIFY THIS in DailyChecklist.tsx
interface Props {
  day: DayPlan;
  completions: {
    completed: Set<string>;
    toggle: (type: string, id: string) => void | Promise<void>;
    dateKey: string;
    plannedTaskCount: number;      // Matches PlannerClient
    totalPlannedMinutes: number;   // Matches PlannerClient
  };
}

export default function DailyChecklist({ day, completions }: Props) {
  // 1. Data normalization (remains same)
  const allPossibleItems = [
    ...day.homework.items.map(i => ({ 
      ...i, 
      type: "deadline_task", 
      section: "Homework",
      subject: i.subject_name || i.subject,
      isOverdue: i.dueDate < new Date().toISOString().split('T')[0]
    })),
    ...day.weekly.items.map(i => ({ ...i, type: "weekly_task", section: "Weekly Tasks" })),
    ...day.revision.items.map(s => ({ 
      id: s.id, 
      examId: s.examId,
      name: s.name, 
      subject: s.subject, 
      minutes: s.minutes,
      type: "revision",
      section: "Revision"
    })),
    ...day.projects.items.map(i => ({ ...i, type: "project", section: "Projects" }))
  ];

  // 2. Filter Logic
  const activeItems = allPossibleItems.filter(item => !completions.completed.has(`${item.type}:${item.id}`));
  const finishedItems = allPossibleItems.filter(item => completions.completed.has(`${item.type}:${item.id}`));

  // 🎯 3. NEW: Sync Logic
  const handleToggle = async (type: string, id: string) => {
    await completions.toggle(type, id);
  
  };

  const TaskRow = ({ item, isDone }: { item: any, isDone: boolean }) => (
    <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
      isDone ? "opacity-50 bg-gray-50 border-gray-100 italic" : "bg-white border-gray-200 shadow-sm"
    }`}>
      <div className="flex items-center gap-4">
        <input 
          type="checkbox" 
          checked={isDone} 
          // 🎯 Update to use our new handleToggle
          onChange={() => handleToggle(item.type, item.id)} 
          className="h-5 w-5 rounded border-gray-300 text-blue-600 accent-blue-600 cursor-pointer" 
        />
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <p className={`text-sm font-bold ${isDone ? "line-through text-gray-400" : "text-gray-800"}`}>
              {item.name}
            </p>
            {item.subject && (
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tight ${
                isDone ? "bg-gray-100 text-gray-400" : "bg-blue-50 text-blue-600"
              }`}>
                {item.subject}
              </span>
            )}
            {item.isOverdue && !isDone && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tight bg-red-100 text-red-600 animate-pulse">
                Overdue
              </span>
            )}
          </div>
          <p className="text-[10px] font-bold text-gray-400">
            {item.minutes} mins • <span className="lowercase">{item.section}</span>
          </p>
        </div>
      </div>
      
      {item.dueDate && !isDone && (
        <span className={`text-[9px] font-bold px-2 py-1 rounded uppercase ${
          item.isOverdue ? "bg-red-50 text-red-400" : "bg-gray-100 text-gray-500"
        }`}>
          Due {new Date(item.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        {activeItems.length > 0 ? (
          activeItems.map((item) => (
            <TaskRow key={`${item.type}-${item.id}`} item={item} isDone={false} />
          ))
        ) : (
          <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-3xl">
            <p className="text-xs font-black uppercase tracking-widest text-gray-300 italic">Objectives Secured.</p>
          </div>
        )}
      </section>

      {finishedItems.length > 0 && (
        <section className="pt-6 border-t border-gray-100">
          <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4 italic">
            Finalised Today
          </h3>
          <div className="space-y-3">
            {finishedItems.map((item) => (
              <TaskRow key={`${item.type}-${item.id}`} item={item} isDone={true} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}