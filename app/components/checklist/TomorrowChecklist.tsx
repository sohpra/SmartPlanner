"use client";

import { DayPlan } from "@/lib/planner/buildWeekPlan";
import { Calendar, ArrowRight } from "lucide-react";

export function TomorrowChecklist({ day }: { day: DayPlan }) {
  const tomorrowItems = [
    ...day.homework.items.map(i => ({ ...i, category: 'Homework' })),
    ...day.weekly.items.map(i => ({ ...i, category: 'Weekly' })),
    ...(day.revision.items || []).map(s => ({
      ...s,
      category: 'Revision',
      name: s.name || `Revision: ${s.subject}` 
    }))
  ];

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-5 shadow-sm flex flex-col min-h-0 overflow-hidden">
      {/* 🎯 Condensed Header */}
      <div className="flex justify-between items-center mb-4 shrink-0 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-50 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">
            Tomorrow
          </h3>
        </div>
        <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">
          {new Date(day.date + "T00:00:00").toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
        </span>
      </div>

      {/* 📋 High-Density List */}
      <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1">
        {tomorrowItems.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-50 rounded-xl">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-300 italic">Clear Schedule</p>
          </div>
        ) : (
          tomorrowItems.map((item, idx) => (
            <div key={idx} className="group flex items-center justify-between py-2 px-3 rounded-xl border border-transparent hover:bg-slate-50 hover:border-slate-100 transition-all">
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[11px] font-black text-slate-700 leading-tight truncate group-hover:text-blue-600 transition-colors">
                    {item.name}
                  </p>
                  {item.subject && (
                    <span className="shrink-0 text-[7px] font-black text-blue-500 bg-blue-50/50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                      {item.subject}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                  <span className="flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    {item.minutes}m
                  </span>
                  <span className="opacity-30">•</span>
                  <span className="italic text-slate-300">{item.category}</span>
                </div>
              </div>
              
              <ArrowRight className="w-3 h-3 text-slate-200 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}