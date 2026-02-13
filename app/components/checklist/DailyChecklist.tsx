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
    <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
      isDone ? "opacity-50 bg-gray-50 border-gray-100 italic" : "bg-white border-gray-200 shadow-sm"
    }`}>
      <div className="flex items-center gap-4">
        <input 
          type="checkbox" 
          checked={isDone} 
          onChange={() => handleToggle(item)} 
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
          </div>
          <p className="text-[10px] font-bold text-gray-400">
            {item.minutes} mins • <span className="lowercase">{item.section}</span>
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* --- Main Objectives --- */}
      <section className="space-y-4">
        {activeItems.length > 0 ? (
          activeItems.map((item) => (
            <TaskRow key={`${item.type}-${item.id}`} item={item} isDone={false} />
          ))
        ) : (
          <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-[2rem] bg-gray-50/50">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400 italic">Day Secured.</p>
          </div>
        )}
      </section>

      {/* --- Work Ahead Choice UI --- DISBLED FOR NOW 
      
      <div className="pt-4">
        {!showWorkAhead ? (
          <button 
            onClick={() => setShowWorkAhead(true)}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Work Ahead / Add Bonus</span>
          </button>
        ) : (
          <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
                <FastForward className="w-4 h-4" /> Pull Forward
              </h3>
              <button onClick={() => setShowWorkAhead(false)} className="text-[10px] font-bold text-slate-500 hover:text-white">Cancel</button>
            </div>

            <div className="space-y-3">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Active Projects</p>
              <div className="grid grid-cols-1 gap-2">
                {allProjects.filter(p => p.status === 'active').slice(0, 3).map(p => (
                  <button 
                    key={p.id}
                    onClick={() => completions.toggle('project', p.id, 60)}
                    className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl hover:bg-blue-600 transition-all group"
                  >
                    <span className="text-sm font-bold tracking-tight">{p.name}</span>
                    <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 group-hover:text-white">
                      <span>Log 60m</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Upcoming Revision</p>
              <div className="grid grid-cols-1 gap-2">
                {upcomingRevision.slice(0, 3).map(slot => (
                  <button 
                    key={slot.id}
                    onClick={() => handlePullRevision(slot.id)}
                    className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl hover:bg-emerald-600 transition-all group text-left"
                  >
                    <div>
                      <span className="text-sm font-bold tracking-tight block">{slot.subject}</span>
                      <span className="text-[9px] text-slate-500 group-hover:text-emerald-100 font-bold uppercase">{slot.date}</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-white" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      */}

      {/* --- Finalised Today --- */}
      {finishedItems.length > 0 && (
        <section className="pt-6 border-t border-gray-100">
          <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] mb-4 italic flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3" /> Finalised Today
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