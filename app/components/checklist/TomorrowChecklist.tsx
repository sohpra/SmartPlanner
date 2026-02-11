"use client";

import { DayPlan } from "@/lib/planner/buildWeekPlan";
import { Calendar } from "lucide-react";

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
    <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
      {/* 🎯 High-Visibility Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter italic">
            Tomorrow
          </h3>
        </div>
        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
          {new Date(day.date + "T00:00:00").toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
        </span>
      </div>

      <div className="space-y-3">
        {tomorrowItems.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-50 rounded-[1.5rem]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 italic">Clear Schedule</p>
          </div>
        ) : (
          tomorrowItems.map((item, idx) => (
            <div key={idx} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 transition-all hover:border-blue-200 group">
              <div className="flex items-start justify-between gap-4 mb-1">
                <p className="text-sm font-black text-slate-800 leading-tight tracking-tight group-hover:text-blue-700 transition-colors">
                  {item.name}
                </p>
                {item.subject && (
                  <span className="shrink-0 text-[8px] font-black text-blue-600 bg-white border border-blue-50 px-2 py-0.5 rounded-lg uppercase tracking-tighter shadow-sm">
                    {item.subject}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                  {item.minutes}m
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-200" />
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest italic opacity-80">
                  {item.category}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}