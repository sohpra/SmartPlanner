"use client";

import React, { useMemo } from "react";
import type { WeekPlan, DayPlan } from "@/lib/planner/buildWeekPlan";
import { usePlannerCapacity } from "@/hooks/use-planner-capacity";
import { Crown, Star, AlertCircle } from "lucide-react";

interface MonthViewProps {
  plan: WeekPlan;
  exams: any[];     
  projects: any[];  
}

export function MonthView({ plan, exams, projects }: MonthViewProps) {
  const { capacityData } = usePlannerCapacity();
  
  const todayStr = useMemo(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
  }, []);

  const calendarDays = useMemo(() => {
    if (!plan.days.length) return [];
    
    const firstDayInPlan = new Date(plan.days[0].date + "T00:00:00");
    const dayOfWeek = firstDayInPlan.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startMonday = new Date(firstDayInPlan);
    startMonday.setDate(firstDayInPlan.getDate() + diffToMonday);

    const fullGrid: DayPlan[] = [];
    for (let i = 0; i < 56; i++) {
      const current = new Date(startMonday);
      current.setDate(startMonday.getDate() + i);
      
      const dateStr = [
        current.getFullYear(),
        String(current.getMonth() + 1).padStart(2, '0'),
        String(current.getDate()).padStart(2, '0')
      ].join('-');
      
      const planDay = plan.days.find(d => d.date === dateStr);
      
      if (planDay) {
        fullGrid.push(planDay);
      } else {
        fullGrid.push({
          date: dateStr,
          totalPlanned: 0,
          baseCapacity: 180,
          weekly: { items: [] },
          homework: { items: [] },
          revision: { items: [] },
          projects: { items: [] }
        } as unknown as DayPlan);
      }
    }
    return fullGrid;
  }, [plan]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      {/* WEEKDAY HEADERS */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/50">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
          <div key={d} className="py-3 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest">
            {d}
          </div>
        ))}
      </div>
      
      {/* CALENDAR GRID */}
      <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
        {calendarDays.map((day) => {
          const isPast = day.date < todayStr;
          const isToday = day.date === todayStr;
          const isOverloaded = day.totalPlanned > day.baseCapacity;

          // 🎯 FETCH OVERRIDES
          const hasOverride = day.date in (capacityData?.dateOverrides || {});
          const overrideLabel = capacityData?.labels?.[day.date];

          // 🎯 FILTER EXAMS & PROJECTS
          const dayExams = (exams || []).filter(e => (e.date || e.due_date || "").slice(0, 10) === day.date);
          const dayProjects = (projects || []).filter(p => (p.due_date || p.date || "").slice(0, 10) === day.date);

          return (
            <div 
              key={day.date} 
              className={`min-h-[140px] p-2 flex flex-col relative transition-all group
                ${isPast ? "bg-gray-50/40 opacity-40 grayscale-[0.6]" : "bg-white"}
                ${isToday ? "bg-blue-50/30 ring-2 ring-inset ring-blue-500/20" : ""}
                ${hasOverride && !isPast ? "bg-amber-50/20" : ""}
              `}
            >
              {/* TOP ROW: DATE & STATUS */}
              <div className="flex justify-between items-center mb-1.5">
                <span className={`text-[11px] font-black tracking-tighter ${
                  isToday ? "text-blue-600 underline decoration-2 underline-offset-2" : 
                  isOverloaded ? "text-red-500" : "text-gray-400"
                }`}>
                  {new Date(day.date + "T00:00:00").getDate()}
                </span>
                
                {!isPast && day.totalPlanned > 0 && (
                  <div className={`w-1.5 h-1.5 rounded-full ${isOverloaded ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                )}
              </div>

              {/* 🎯 EXCEPTION LABEL (High Visibility) */}
              {hasOverride && !isPast && (
                <div className="mb-1.5">
                  <div className="px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[7px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
                    <AlertCircle className="w-2 h-2 shrink-0" />
                    <span className="truncate">{overrideLabel || "MODIFIED"}</span>
                  </div>
                </div>
              )}

              {/* EXAMS & PROJECTS */}
              <div className="space-y-1 mb-2">
                {dayExams.map((exam, i) => (
                  <div key={i} className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase truncate shadow-sm flex items-center gap-1
                    ${exam.exam_type === 'Competitive' 
                      ? 'bg-purple-600 text-white border border-purple-700' 
                      : 'bg-amber-500 text-white border border-amber-600'}`}>
                    <Crown className="w-2 h-2" /> {exam.subject}
                  </div>
                ))}

                {dayProjects.map((proj, i) => (
                  <div key={i} className="px-1.5 py-0.5 rounded-[4px] bg-blue-600 text-white border border-blue-700 text-[8px] font-black uppercase truncate shadow-sm flex items-center gap-1">
                    <Star className="w-2 h-2" /> {proj.name}
                  </div>
                ))}
              </div>

              {/* REVISION PREVIEW */}
              <div className="space-y-0.5 mb-2 flex-1">
                {day.revision.items.slice(0, 3).map((item, i) => (
                  <div key={i} className="px-1 py-0.5 rounded-sm bg-slate-50 border-l-2 border-slate-300 text-[7px] font-bold text-slate-600 truncate leading-none">
                    {item.name || item.label}
                  </div>
                ))}
                {day.revision.items.length > 3 && (
                  <p className="text-[6px] font-black text-slate-300 pl-1">+{day.revision.items.length - 3} MORE</p>
                )}
              </div>

              {/* BOTTOM CAPACITY BAR */}
              <div className="mt-auto pt-1.5 border-t border-gray-100/50">
                {day.baseCapacity > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-tighter">
                      <span className={isOverloaded ? "text-red-600" : "text-gray-400"}>
                        {day.totalPlanned}m
                      </span>
                      <span className="text-gray-300">/ {day.baseCapacity}m</span>
                    </div>
                    <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${isOverloaded ? 'bg-red-500' : 'bg-blue-500'}`} 
                        style={{ width: `${Math.min(100, (day.totalPlanned / day.baseCapacity) * 100)}%` }} 
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[7px] font-black text-gray-300 uppercase italic text-center">Rest Day</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}