"use client";

import React from "react";
import type { WeekPlan, DayPlan } from "@/lib/planner/buildWeekPlan";

export function MonthView({ plan }: { plan: WeekPlan }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Calendar Header */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/50">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest">
            {d}
          </div>
        ))}
      </div>
      
      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {plan.days.map((day) => (
          <div 
            key={day.date} 
            className={`min-h-[100px] border-r border-b border-gray-100 p-2 transition-colors hover:bg-gray-50 ${
              day.totalUsed > day.baseCapacity ? "bg-red-50/30" : "bg-white"
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-400">
                {new Date(day.date + "T00:00:00").getDate()}
              </span>
              {day.totalUsed > 0 && (
                <span className="text-[9px] font-medium text-gray-400">
                  {Math.round(day.totalUsed / 60)}h
                </span>
              )}
            </div>

            {/* Visual Load Bars */}
            <div className="space-y-1">
              {day.homework.minutes > 0 && <div className="h-1 w-full bg-emerald-400 rounded-full" />}
              {day.revision.minutes > 0 && <div className="h-1 w-full bg-amber-400 rounded-full" />}
              {day.projects.minutes > 0 && <div className="h-1 w-full bg-sky-400 rounded-full" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}