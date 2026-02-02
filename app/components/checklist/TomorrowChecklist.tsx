"use client";

import { DayPlan } from "@/lib/planner/buildWeekPlan";

export function TomorrowChecklist({ day }: { day: DayPlan }) {
  const totalItems = day.homework.items.length + day.weekly.items.length + day.revision.slots.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-800">Tomorrow</h3>
        <span className="text-xs text-gray-400 font-medium">
          {new Date(day.date + "T00:00:00").toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
        </span>
      </div>

      <div className="space-y-3">
        {totalItems === 0 ? (
          <p className="text-sm text-gray-400 italic">Clear schedule!</p>
        ) : (
          <>
            {day.homework.items.map(item => (
              <div key={item.id} className="p-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
                <p className="font-semibold text-gray-700 truncate">{item.name}</p>
                <p className="text-[10px] text-gray-400">{item.minutes} mins</p>
              </div>
            ))}
            {day.revision.slots.map((slot, i) => (
              <div key={i} className="p-3 bg-blue-50/50 rounded-lg text-sm border border-blue-100">
                <p className="font-semibold text-blue-700 truncate">{slot.subject} Revision</p>
                <p className="text-[10px] text-blue-400">{slot.slotMinutes} mins</p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}