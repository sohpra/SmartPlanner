"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Sparkles, Clock, CheckCircle2 } from "lucide-react";

export function DashboardHeader() {
  const [firstName, setFirstName] = useState("there");
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const metadataName = user.user_metadata?.first_name;
        if (metadataName) {
          setFirstName(metadataName);
        } else if (user.email) {
          const namePart = user.email.split('@')[0].split('.')[0];
          setFirstName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
        }
      }
    };
    getUser();

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-GB", { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: false 
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const todayDate = new Date().toLocaleDateString("en-GB", {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 pb-6 border-b border-slate-100 mb-6 md:mb-8">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="p-1 bg-blue-50 rounded-lg">
            <Sparkles className="w-3 h-3 text-blue-600 fill-current" />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
              The Masterplan
            </p>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-100">
              <CheckCircle2 className="w-2 h-2 text-emerald-500" />
              <span className="text-[7px] md:text-[8px] font-bold text-emerald-600 uppercase tracking-tighter">Live Sync</span>
            </div>
          </div>
        </div>
        
        {/* 🎯 RESPONSIVE TEXT: text-2xl on mobile, text-4xl on desktop */}
        <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter italic leading-none">
          Welcome back, <span className="text-blue-600">{firstName}</span>
        </h1>
      </div>

      <div className="flex items-center justify-between md:justify-end gap-4">
        {/* 🕒 Time & Date */}
        <div className="flex flex-col items-start md:items-end gap-1">
          <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-3 py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl border border-slate-100">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <p className="text-xs md:text-sm font-black tabular-nums tracking-wider leading-none">
              {currentTime || "00:00:00"}
            </p>
          </div>
          <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest italic pr-1">
            {todayDate}
          </p>
        </div>
      </div>
    </div>
  );
}