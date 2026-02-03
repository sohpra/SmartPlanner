"use client";

import React, { useMemo } from "react";
import type { WeekPlan, DayPlan } from "@/lib/planner/buildWeekPlan";

export function MonthView({ plan }: { plan: WeekPlan }) {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 1. ANCHOR TO MONDAY: Ensure the grid starts on the Monday of the first week
  const calendarDays = useMemo(() => {
    const firstDayInPlan = new Date(plan.days[0].date + "T00:00:00");
    const dayOfWeek = firstDayInPlan.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const startMonday = new Date(firstDayInPlan);
    startMonday.setDate(firstDayInPlan.getDate() + diffToMonday);

    const fullGrid: DayPlan[] = [];
    // We show 28 or 35 days to keep a clean rectangular grid
    for (let i = 0; i < 28; i++) {
      const current = new Date(startMonday);
      current.setDate(startMonday.getDate() + i);
      const dateStr = current.toISOString().slice(0, 10);
      
      const planDay = plan.days.find(d => d.date === dateStr);
      
      if (planDay) {
        fullGrid.push(planDay);
      } else {
        // Skeleton for past/future padding
        fullGrid.push({
          date: dateStr,
          totalUsed: 0,
          baseCapacity: 180,
          spare: 180,
          weekly: { items: [] },
          homework: { items: [] },
          revision: { slots: [] },
          projects: { items: [] }
        } as unknown as DayPlan);
      }
    }
    return fullGrid;
  }, [plan]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      {/* 📅 Monday-Start Header */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/50">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
          <div key={d} className="py-3 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest">
            {d}
          </div>
        ))}
      </div>
      
      {/* 🗓️ Calendar Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
        {calendarDays.map((day) => {
          const isPast = day.date < todayStr;
          const isToday = day.date === todayStr;
          const isOverloaded = day.totalUsed > day.baseCapacity;
          const loadRatio = day.totalUsed / day.baseCapacity;

          // Consistency: Using the same Dot Logic as Weekly
          let dotColor = "bg-gray-200";
          if (day.totalUsed > 0) {
            if (isOverloaded) dotColor = "bg-red-500";
            else if (loadRatio > 0.7) dotColor = "bg-orange-400";
            else dotColor = "bg-emerald-500";
          }

          return (
            <div 
              key={day.date} 
              className={`min-h-[110px] p-3 transition-all relative
                ${isPast ? "bg-gray-50/50 opacity-40 grayscale-[0.5]" : "bg-white"}
                ${isToday ? "ring-2 ring-inset ring-blue-500/20 bg-blue-50/10" : ""}
              `}
            >
              <div className="flex justify-between items-start">
                <span className={`text-sm font-black ${isToday ? "text-blue-600" : isOverloaded ? "text-red-500" : "text-gray-400"}`}>
                  {new Date(day.date + "T00:00:00").getDate()}
                </span>
                
                {/* Sanity Dot */}
                {!isPast && day.totalUsed > 0 && (
                  <div className={`w-2 h-2 rounded-full ${dotColor} ${isOverloaded ? 'animate-pulse' : ''}`} />
                )}
              </div>

              {/* Day Summary */}
              <div className="mt-2 space-y-1.5">
                {day.totalUsed > 0 && (
                  <p className={`text-[10px] font-black uppercase tracking-tighter ${isOverloaded ? 'text-red-600' : 'text-gray-500'}`}>
                    {Math.floor(day.totalUsed / 60)}h {day.totalUsed % 60}m
                  </p>
                )}
                
                {/* Mini Heatmap Bar */}
                {day.totalUsed > 0 && (
                  <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${isOverloaded ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, (day.totalUsed / day.baseCapacity) * 100)}%` }}
                    />
                  </div>
                )}

                {/* Overload Warning (Only if current/future) */}
                {isOverloaded && !isPast && (
                  <p className="text-[7px] font-black text-red-500 uppercase tracking-widest animate-pulse">
                    Overload
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}