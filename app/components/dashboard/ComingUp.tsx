"use client";

import { useMemo } from "react";

interface ComingUpProps {
  exams: any[];
  projects: any[];
}

export function ComingUp({ exams, projects = [] }: ComingUpProps) {
  // 🎯 Fix 1: Get Today in strict YYYY-MM-DD without timezone shifting
  const todayStr = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];
  }, []);

const upcomingMilestones = useMemo(() => {
  const milestones = [
    ...(exams || []).map((e) => {
      // 🎯 1. Robust Name Logic for all types
      let displayName = `${e.subject} Exam`;
      
      if (e.exam_type === "Competitive") {
        displayName = e.competitive_exam_name || `${e.subject} Competitive`;
      } else if (e.exam_type === "Board") {
        displayName = e.exam_board ? `${e.subject} (${e.exam_board})` : `${e.subject} Board`;
      }

      // 🎯 2. Date Normalization
      const rawDate = e.date ? new Date(e.date).toISOString().split("T")[0] : "";

      return {
        name: displayName,
        date: rawDate,
        type: e.exam_type, // Internal, Board, or Competitive
        subject: e.subject,
      };
    }),
    ...(projects || []).map((p) => ({
      name: p.name,
      date: p.due_date ? new Date(p.due_date).toISOString().split("T")[0] : "",
      type: "Project",
      subject: p.subject,
    })),
  ];

  return milestones
    .filter((event) => event.date && event.date >= todayStr)
    // 🎯 3. Strict Date Sort (Chronological)
    .sort((a, b) => a.date.localeCompare(b.date))
    // 🎯 4. Increased Slice (Show more upcoming dates)
    .slice(0, 10); 
  }, [exams, projects, todayStr]);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter italic">
          Coming Up
        </h3>
      </div>

      <div className="space-y-3">
        {upcomingMilestones.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-50 rounded-3xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 italic">
              No major milestones
            </p>
          </div>
        ) : (
          upcomingMilestones.map((event, idx) => {
            // Calculate difference in days
            const tDate = new Date(todayStr + "T00:00:00");
            const eDate = new Date(event.date + "T00:00:00");
            const diff = Math.round((eDate.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24));

            const isToday = diff === 0;
            const isTomorrow = diff === 1;
            const isUrgent = diff <= 7; // Highlight anything within a week

            return (
              <div key={idx} className={`p-4 rounded-2xl border transition-all ${
                isUrgent ? 'bg-red-50/20 border-red-100' : 'bg-white border-slate-100'
              }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {isUrgent && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
                      <h4 className="text-sm font-black italic tracking-tight text-slate-800">
                        {event.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 text-[8px] font-black uppercase">
                      <span className="text-blue-600">{event.subject}</span>
                      <span className="text-slate-300">{event.type}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg border ${
                      isToday ? 'bg-red-600 text-white' : 
                      isTomorrow ? 'bg-orange-500 text-white' : 
                      'bg-slate-50 text-slate-600'
                    }`}>
                      {isToday ? 'TODAY' : isTomorrow ? 'TOMORROW' : `${diff}d`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}