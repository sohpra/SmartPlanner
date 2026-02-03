"use client";

import { DayPlan } from "@/lib/planner/buildWeekPlan";

export function TomorrowChecklist({ day }: { day: DayPlan }) {
  const items = [
    ...day.homework.items.map(i => ({ ...i, type: 'Homework' })),
    ...day.revision.slots.map(s => ({ ...s, name: s.label, type: 'Revision' })),
    ...day.weekly.items.map(i => ({ ...i, type: 'Weekly' }))
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-black text-gray-900 tracking-tight">Tomorrow</h3>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {new Date(day.date + "T00:00:00").toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
        </span>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-4">Clear schedule tomorrow!</p>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-gray-700 truncate">{item.name}</p>
                {item.subject && (
                  <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">
                    {item.subject}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                {item.minutes} mins • {item.type}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}