"use client";

import React, { useState, useMemo } from "react";
import type { WeekPlan, DayPlan } from "@/lib/planner/buildWeekPlan";
import { ChevronLeft, ChevronRight, Calendar, AlertCircle } from "lucide-react";

type Props = {
  plan: WeekPlan;
};

export function WeeklyView({ plan }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);

  const visibleDays = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const anchorMonday = new Date(today);
    anchorMonday.setHours(0, 0, 0, 0);
    anchorMonday.setDate(today.getDate() + diffToMonday + (weekOffset * 7));
    
    const weekWindow: DayPlan[] = [];
    
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(anchorMonday);
      dayDate.setDate(anchorMonday.getDate() + i);
      const dateStr = dayDate.toISOString().slice(0, 10);
      
      const planDay = plan.days.find(d => d.date === dateStr);
      
      if (planDay) {
        weekWindow.push(planDay);
      } else {
        // TS FIX: added missing 'spare' and double-cast
        weekWindow.push({
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
    return weekWindow;
  }, [plan, weekOffset]);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 🧭 Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-gray-900 tracking-tight">
              {weekOffset === 0 ? "This Week" : weekOffset === 1 ? "Next Week" : `Week +${weekOffset}`}
            </h3>
            {weekOffset === 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded-full border border-blue-100">
                <Calendar className="w-3 h-3" />
                Current
              </span>
            )}
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {new Date(visibleDays[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {new Date(visibleDays[6].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
          <button onClick={() => setWeekOffset(0)} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 rounded-lg">Today</button>
          <button onClick={() => setWeekOffset(prev => prev + 1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
        <div className="grid grid-cols-7 gap-4 min-w-[1000px]">
          {visibleDays.map((day) => (
            <DayColumn key={day.date} day={day} isPast={day.date < todayStr} isToday={day.date === todayStr} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({ day, isPast, isToday }: { day: DayPlan; isPast: boolean; isToday: boolean }) {
  const dateObj = new Date(day.date + "T00:00:00");
  const dayName = dateObj.toLocaleDateString("en-GB", { weekday: "short" });
  const dayNum = dateObj.getDate();
  const loadRatio = day.totalUsed / day.baseCapacity;
  const isOverloaded = day.totalUsed > day.baseCapacity;

  // 📈 Workload Score Logic: Subtlety for sanity
  const score = useMemo(() => {
    if (day.totalUsed === 0) return { dot: "bg-gray-200", text: null };
    if (isOverloaded) return { dot: "bg-red-500", text: "Overload" };
    if (loadRatio > 0.7) return { dot: "bg-orange-400", text: null };
    return { dot: "bg-emerald-500", text: null };
  }, [day.totalUsed, loadRatio, isOverloaded]);

  return (
    <div className={`flex flex-col gap-4 p-2 rounded-2xl border transition-all 
      ${isPast ? "opacity-30 grayscale-[0.4]" : "opacity-100"}
      ${isToday ? "bg-blue-50/30 border-blue-200 shadow-sm ring-1 ring-blue-100" : "border-transparent"}
    `}>
      {/* 📅 Date Header & Indicators */}
      <div className="text-center py-2 relative">
        <div className={`text-[10px] font-black uppercase tracking-widest ${isToday ? "text-blue-600" : "text-gray-400"}`}>
          {dayName}
        </div>
        
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <div className={`text-2xl font-black ${isToday ? "text-blue-600" : isOverloaded ? "text-red-500" : "text-gray-900"}`}>
            {dayNum}
          </div>
          {/* Status Dot: Subtle indicator for balanced/heavy days */}
          {!isPast && (
            <div className={`w-2 h-2 rounded-full ${score.dot} ${isOverloaded ? 'animate-pulse' : ''}`} />
          )}
        </div>

        {/* Capacity Progress Bar */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200/50 overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ${isOverloaded ? "bg-red-500" : "bg-blue-500"}`}
            style={{ width: `${Math.min(100, (day.totalUsed / day.baseCapacity) * 100)}%` }}
          />
        </div>

        {/* ⚠️ Crisis Text: Only shows when Overloaded */}
        {score.text && (
          <p className="text-[8px] font-black uppercase mt-1 tracking-tighter text-red-600 animate-bounce">
            {score.text}
          </p>
        )}
      </div>

      {/* 📝 Task List for the Day */}
      <div className="flex flex-col gap-2">
        {day.weekly.items.map((item) => (
          <TaskBlock key={`week-${item.id}`} label={item.name} minutes={item.minutes} type="Weekly" color="indigo" />
        ))}
        {day.homework.items.map((item) => (
          <TaskBlock key={`hwk-${item.id}`} label={item.name} minutes={item.minutes} type="Hwk" subject={item.subject} color="emerald" />
        ))}
        {day.revision.slots.map((slot, i) => (
          <TaskBlock key={`rev-${i}-${day.date}`} label={slot.label} minutes={slot.slotMinutes} type="Rev" subject={slot.subject} color="amber" />
        ))}
        {day.projects.items.map((p) => (
          <TaskBlock key={`proj-${p.projectId}`} label={p.name} minutes={p.minutes} type="Proj" subject={p.subject} color="sky" />
        ))}
        
        {day.totalUsed === 0 && (
          <div className="py-12 text-center text-[9px] font-black uppercase tracking-tighter text-gray-300 border-2 border-dashed border-gray-100 rounded-xl">
            Rest Day
          </div>
        )}
      </div>
    </div>
  );
}

function TaskBlock({ label, minutes, type, color, subject }: any) {
  const colors: any = {
    indigo: "bg-indigo-50/50 border-indigo-100 text-indigo-700",
    emerald: "bg-emerald-50/50 border-emerald-100 text-emerald-700",
    amber: "bg-amber-50/50 border-amber-100 text-amber-700",
    sky: "bg-sky-50/50 border-sky-100 text-sky-700",
  };

  return (
    <div className={`group rounded-xl border p-2.5 shadow-sm bg-white ${colors[color] || colors.indigo}`}>
      <div className="flex flex-wrap gap-1 mb-1">
        <span className="text-[7px] font-black uppercase px-1 rounded bg-white/80">{type}</span>
        {subject && <span className="text-[7px] font-black uppercase px-1 rounded bg-blue-600 text-white">{subject}</span>}
      </div>
      <div className="text-[11px] font-bold leading-tight line-clamp-2 mb-1 text-gray-800 tracking-tight">{label}</div>
      <div className="text-[9px] font-black opacity-60 uppercase tracking-tighter">{minutes}m</div>
    </div>
  );
}