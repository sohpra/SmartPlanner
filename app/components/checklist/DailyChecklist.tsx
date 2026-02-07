"use client";

import { DayPlan } from "@/lib/planner/buildWeekPlan";

interface Props {
  day: DayPlan;
  completions: {
    completed: Set<string>;
    toggle: (type: string, id: string) => void;
    dateKey: string;
  };
}

export default function DailyChecklist({ day, completions }: Props) {
  // 1. Map all items and normalize the data structure
  const allPossibleItems = [
    ...day.homework.items.map(i => ({ ...i, type: "deadline_task", section: "Homework" })),
    ...day.weekly.items.map(i => ({ ...i, type: "weekly_task", section: "Weekly Tasks" })),
    ...day.revision.slots.map(s => ({ 
      id: s.examId, 
      name: s.label, 
      subject: s.subject, 
      minutes: s.slotMinutes,
      type: "revision",
      section: "Revision"
    })),
    ...day.projects.items.map(i => ({ ...i, type: "project", section: "Projects" }))
  ];

  // 2. Filter Logic: 🎯 TRUST THE LOG
  // We determine if an item is finished strictly by checking if its unique 
  // key (type:id) exists in the completions set provided by the hook.
  
  const activeItems = allPossibleItems.filter(item => {
    const key = `${item.type}:${item.id}`;
    return !completions.completed.has(key);
  });

  const finishedItems = allPossibleItems.filter(item => {
    const key = `${item.type}:${item.id}`;
    return completions.completed.has(key);
  });

  // Helper to render a task row
// Helper to render a task row
  const TaskRow = ({ item, isDone }: { item: any, isDone: boolean }) => (
    <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
      isDone ? "opacity-50 bg-gray-50 border-gray-100 italic" : "bg-white border-gray-200 shadow-sm"
    }`}>
      <div className="flex items-center gap-4">
        <input 
          type="checkbox" 
          checked={isDone} 
          onChange={() => completions.toggle(item.type, item.id)} 
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

            {/* 🎯 THE OVERDUE BADGE */}
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
      {/* 🚀 ACTIVE OBJECTIVES */}
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

      {/* 🏁 FINALIZED TODAY */}
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