"use client";

import React from "react";
import type { WeekPlan, DayPlan } from "@/lib/planner/buildWeekPlan";

export function MonthView({ plan }: { plan: WeekPlan }) {
  // Logic to handle calendar alignment could go here, 
  // but for a rolling 30-day "Smart Roadmap", we can stick to a clean 7x4 grid.
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/50">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest">
            {d}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7">
        {plan.days.map((day, idx) => (
          <MonthDayCell key={day.date} day={day} isFirst={idx === 0} />
        ))}
      </div>
    </div>
  );
}

function MonthDayCell({ day, isFirst }: { day: DayPlan, isFirst: boolean }) {
  const date = new Date(day.date + "T00:00:00");
  const isToday = day.date === new Date().toISOString().slice(0, 10);
  
  // Logic for Heatmap Intensity
  const loadRatio = day.totalUsed / day.baseCapacity;
  let intensityClass = "bg-white";
  if (loadRatio > 0.1) intensityClass = "bg-blue-50/30";
  if (loadRatio > 0.5) intensityClass = "bg-blue-50";
  if (loadRatio > 0.8) intensityClass = "bg-blue-100";
  if (loadRatio > 1.0) intensityClass = "bg-red-50"; // Overloaded

  return (
    <div className={`min-h-[100px] border-r border-b border-gray-100 p-2 transition-colors hover:bg-gray-50 ${intensityClass}`}>
      <div className="flex justify-between items-start">
        <span className={`text-xs font-bold ${isToday ? "bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded-full" : "text-gray-400"}`}>
          {date.getDate()}
        </span>
        {day.totalUsed > 0 && (
          <span className="text-[9px] font-medium text-gray-400">{Math.round(day.totalUsed / 60)}h</span>
        )}
      </div>

      <div className="mt-2 space-y-1">
        {/* Layer 1: Fixed Dots */}
        {day.weekly.items.length > 0 && (
           <div className="flex items-center gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
             <span className="text-[9px] text-gray-600 truncate">Fixed</span>
           </div>
        )}
        
        {/* Layer 2 & 3: Progress Bars */}
        {day.homework.minutes > 0 && (
          <div className="h-1 w-full bg-emerald-200 rounded-full" title="Deadlines" />
        )}
        {day.revision.minutes > 0 && (
          <div className="h-1 w-full bg-amber-200 rounded-full" title="Revision" />
        )}
        {day.projects.minutes > 0 && (
          <div className="h-1 w-full bg-sky-200 rounded-full" title="Projects" />
        )}
      </div>
    </div>
  );
}