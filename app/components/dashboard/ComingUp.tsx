"use client";

import { useMemo } from "react";
import { Flag, Trophy, Target } from "lucide-react";

interface ComingUpProps {
  exams: any[];
  projects: any[];
}

export function ComingUp({ exams, projects = [] }: ComingUpProps) {
  const todayStr = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split("T")[0];
  }, []);

  const upcomingMilestones = useMemo(() => {
    const milestones = [
      ...(exams || []).map((e) => ({
        name: e.exam_type === "Competitive" ? (e.competitive_exam_name || e.subject) : e.subject,
        date: e.date ? new Date(e.date).toISOString().split("T")[0] : "",
        type: e.exam_type === "Internal" ? "Exam" : e.exam_type,
        subject: e.subject,
      })),
      ...(projects || []).map((p) => ({
        name: p.name,
        date: p.due_date ? new Date(p.due_date).toISOString().split("T")[0] : "",
        type: "Project",
        subject: p.subject,
      })),
    ];

    return milestones
      .filter((event) => event.date && event.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6); // Keep it tight for the cockpit
  }, [exams, projects, todayStr]);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-5 shadow-sm flex flex-col min-h-0">
      <div className="flex justify-between items-center mb-4 shrink-0 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400">
            <Target className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">
            Coming Up
          </h3>
        </div>
      </div>

      <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1 relative">
        {/* Timeline Vertical Line */}
        <div className="absolute left-[13px] top-2 bottom-2 w-[1px] bg-slate-100" />

        {upcomingMilestones.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-slate-50 rounded-xl">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-300 italic">No Milestones</p>
          </div>
        ) : (
          upcomingMilestones.map((event, idx) => {
            const tDate = new Date(todayStr + "T00:00:00");
            const eDate = new Date(event.date + "T00:00:00");
            const diff = Math.round((eDate.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24));
            const isUrgent = diff <= 7;

            return (
              <div key={idx} className="relative flex items-center justify-between py-2 pl-7 pr-2 rounded-xl hover:bg-slate-50 transition-all group">
                {/* Timeline Dot */}
                <div className={`absolute left-[10.5px] h-1.5 w-1.5 rounded-full z-10 border-2 border-white transition-all ${
                  isUrgent ? 'bg-red-500 scale-125' : 'bg-slate-300 group-hover:bg-blue-400'
                }`} />

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-[11px] font-black leading-tight truncate ${
                      isUrgent ? 'text-slate-900' : 'text-slate-600'
                    }`}>
                      {event.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[7px] font-black uppercase tracking-tighter mt-0.5">
                    <span className="text-blue-500 italic">{event.subject}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-300">{event.type}</span>
                  </div>
                </div>

                <div className={`shrink-0 ml-3 px-1.5 py-0.5 rounded-md text-[8px] font-black tabular-nums transition-colors ${
                  isUrgent ? 'bg-red-100 text-red-600' : 'bg-slate-50 text-slate-400 group-hover:text-blue-500'
                }`}>
                  {diff === 0 ? 'TODAY' : diff === 1 ? '1d' : `${diff}d`}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}