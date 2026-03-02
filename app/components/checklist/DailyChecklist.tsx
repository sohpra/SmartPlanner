"use client";

import { useState } from "react";
import { DayPlan } from "@/lib/planner/buildWeekPlan";
import { supabase } from "@/lib/supabase/client";
import { Plus, Clock, FastForward, ChevronRight, CheckCircle2 } from "lucide-react";

interface Props {
  day: DayPlan;
  completions: {
    completed: Set<string>;
    toggle: (type: string, id: string, duration?: number) => void | Promise<void>;
    dateKey: string;
    plannedTaskCount: number;
    totalPlannedMinutes: number;
  };
  // 🎯 Add these to your PlannerClient to feed future options
  allProjects?: any[];
  upcomingRevision?: any[];
}

export default function DailyChecklist({ day, completions, allProjects = [], upcomingRevision = [] }: Props) {
  const [showWorkAhead, setShowWorkAhead] = useState(false);

  // 1. Data normalization
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
      name: s.name, 
      subject: s.subject, 
      minutes: s.minutes,
      type: "revision",
      section: "Revision"
    })),
    ...day.projects.items.map(i => ({ ...i, type: "project", section: "Projects" }))
  ];

  const activeItems = allPossibleItems.filter(item => !completions.completed.has(`${item.type}:${item.id}`));
  const finishedItems = allPossibleItems.filter(item => completions.completed.has(`${item.type}:${item.id}`));

  const handleToggle = async (item: any) => {
    const targetId = item.projectId || item.id;
    await completions.toggle(item.type, targetId, item.minutes);
  };

  // 🎯 NEW: Manual Revision Pull
  const handlePullRevision = async (slotId: string) => {
    const { error } = await supabase
      .from("revision_slots")
      .update({ date: completions.dateKey })
      .eq("id", slotId);
    
    if (!error) window.location.reload(); // Refresh to let buildWeekPlan find it
  };

const TaskRow = ({ item, isDone }: { item: any, isDone: boolean }) => (
  <div className={`group flex items-center justify-between py-2 px-3 rounded-xl border transition-all duration-200 ${
    isDone 
      ? "opacity-40 bg-gray-50/50 border-transparent italic" 
      : "bg-white border-slate-100 hover:border-blue-300 hover:shadow-sm"
  }`}>
    <div className="flex items-center gap-3 min-w-0">
      {/* 🔘 Shrunken Checkbox */}
      <input 
        type="checkbox" 
        checked={isDone} 
        onChange={() => handleToggle(item)} 
        className="h-4 w-4 rounded-md border-slate-300 text-blue-600 accent-blue-600 cursor-pointer transition-transform active:scale-90 shrink-0" 
      />
      
      <div className="min-w-0 flex flex-col">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={`text-[11px] font-black tracking-tight truncate ${isDone ? "line-through text-gray-400" : "text-slate-700"}`}>
            {item.name}
          </p>
          
          {/* 🏷️ Micro-Badges */}
          {item.isBonus && (
            <span className="text-[7px] font-black px-1 rounded-sm bg-purple-100 text-purple-600 uppercase italic">
              +1
            </span>
          )}

          {item.isOverdue && !isDone && (
            <span className="text-[7px] font-black px-1 rounded-sm bg-red-100 text-red-600 uppercase animate-pulse">
              !
            </span>
          )}

          {item.subject && (
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter ${
              isDone ? "bg-gray-100 text-gray-300" : "bg-blue-50 text-blue-600"
            }`}>
              {item.subject}
            </span>
          )}
        </div>
        
        {/* 🕒 Metadata Line */}
        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400">
          <div className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            <span>{item.minutes}m</span>
          </div>
          <span className="opacity-30">•</span>
          <span className="lowercase font-medium truncate opacity-70">{item.section}</span>
        </div>
      </div>
    </div>

    {/* 📅 Minimal Deadline Indicator */}
    {item.dueDate && !isDone && (
      <div className="text-right pl-2 shrink-0">
        <p className={`text-[9px] font-black italic tracking-tighter ${item.isOverdue ? "text-red-400" : "text-slate-300"}`}>
          {new Date(item.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
        </p>
      </div>
    )}
  </div>
);

return (
  <div className="space-y-4">
    {/* --- Main Objectives --- */}
    <section className="flex flex-col gap-1">
      {activeItems.length > 0 ? (
        activeItems.map((item) => (
          <TaskRow key={`${item.type}-${item.id}`} item={item} isDone={false} />
        ))
      ) : (
        <div className="py-6 text-center border-2 border-dashed border-slate-50 rounded-[1.5rem] bg-slate-50/30">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-300 italic">Day Secured.</p>
        </div>
      )}
    </section>

    {/* --- Finalised Today --- */}
    {finishedItems.length > 0 && (
      <section className="pt-3 border-t border-slate-50">
        <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 italic flex items-center gap-2 px-1">
          <CheckCircle2 className="w-2.5 h-2.5 text-slate-300" /> Finalised Today
        </h3>
        <div className="flex flex-col gap-1">
          {finishedItems.map((item) => (
            <TaskRow key={`${item.type}-${item.id}`} item={item} isDone={true} />
          ))}
        </div>
      </section>
    )}
  </div>
);
}