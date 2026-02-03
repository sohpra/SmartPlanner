"use client";

import React, { useMemo } from "react";
import type { WeekPlan, DayPlan } from "@/lib/planner/buildWeekPlan";

interface MonthViewProps {
  plan: WeekPlan;
  exams: any[];     // This will receive exams.upcoming
  projects: any[];  // This will receive projects (which is already an array)
}

export function MonthView({ plan, exams, projects }: MonthViewProps) {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const calendarDays = useMemo(() => {
    // ... (Keep your Monday Anchor logic exactly as is)
    const firstDayInPlan = new Date(plan.days[0].date + "T00:00:00");
    const dayOfWeek = firstDayInPlan.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startMonday = new Date(firstDayInPlan);
    startMonday.setDate(firstDayInPlan.getDate() + diffToMonday);

    const fullGrid: DayPlan[] = [];
    for (let i = 0; i < 28; i++) {
      const current = new Date(startMonday);
      current.setDate(startMonday.getDate() + i);
      const dateStr = current.toISOString().slice(0, 10);
      const planDay = plan.days.find(d => d.date === dateStr);
      
      if (planDay) {
        fullGrid.push(planDay);
      } else {
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
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/50">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
          <div key={d} className="py-3 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest">
            {d}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
        {calendarDays.map((day) => {
          const isPast = day.date < todayStr;
          const isToday = day.date === todayStr;
          const isOverloaded = day.totalUsed > day.baseCapacity;

          // 🎯 THE FIX: Ensure we are filtering the array
          // We normalize strings to prevent timezone/format mismatches
          const dayExams = (exams || []).filter(e => {
            const eDate = e.date?.slice(0, 10);
            return eDate === day.date;
          });

          const dayProjects = (projects || []).filter(p => {
            const pDate = (p.due_date || p.date)?.slice(0, 10);
            return pDate === day.date;
          });

          return (
            <div key={day.date} className={`min-h-[120px] p-2 flex flex-col ${isPast ? "bg-gray-50/50 opacity-40 grayscale-[0.5]" : "bg-white"}`}>
              <div className="flex justify-between items-start mb-1">
                <span className={`text-xs font-black ${isToday ? "text-blue-600" : isOverloaded ? "text-red-500" : "text-gray-400"}`}>
                  {new Date(day.date + "T00:00:00").getDate()}
                </span>
                
                {!isPast && day.totalUsed > 0 && (
                  <div className={`w-2 h-2 rounded-full ${isOverloaded ? 'bg-red-500 animate-pulse' : day.totalUsed / day.baseCapacity > 0.7 ? 'bg-orange-400' : 'bg-emerald-500'}`} />
                )}
              </div>

              {/* Strategic Milestones */}
              <div className="flex-1 space-y-1 mb-2 overflow-hidden">
                {dayExams.map((exam, i) => (
                  <div key={i} className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-[8px] font-black text-amber-800 uppercase truncate shadow-sm">
                    🎓 {exam.subject} Exam
                  </div>
                ))}

                {dayProjects.map((proj, i) => (
                  <div key={i} className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[8px] font-black text-blue-700 uppercase truncate">
                    🏁 {proj.name}
                  </div>
                ))}
              </div>

              {/* Daily Capacity Progress (Bottom) */}
              <div className="mt-auto pt-1 border-t border-gray-50">
                {day.totalUsed > 0 && (
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-[9px] font-black uppercase tracking-tighter ${isOverloaded ? 'text-red-600' : 'text-gray-500'}`}>
                      {Math.floor(day.totalUsed / 60)}h {day.totalUsed % 60}m
                    </p>
                    <div className="h-1 flex-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${isOverloaded ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (day.totalUsed / day.baseCapacity) * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}