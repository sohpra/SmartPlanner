"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Sparkles, Clock } from "lucide-react";

export function DashboardHeader() {
  const [firstName, setFirstName] = useState("there");
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    // 1. Handle Dynamic Name Greeting
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user?.email) {
        const namePart = data.user.email.split('@')[0].split('.')[0];
        setFirstName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
      }
    };
    getUser();

    // 2. Handle Live Clock
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
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-slate-100 mb-8">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-blue-50 rounded-lg">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 fill-current" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
            Strategic Roadmap
          </p>
        </div>
        
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic leading-none">
          Welcome back, <span className="text-blue-600">{firstName}</span>
        </h1>
      </div>

      {/* 🕒 ENHANCED TIME & DATE SECTION */}
      <div className="flex flex-col md:items-end gap-1.5 min-w-[140px]">
        <div className="flex items-center gap-2.5 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100/50">
          <Clock className="w-4 h-4 text-blue-500" />
          <p className="text-sm font-black tabular-nums tracking-wider leading-none">
            {currentTime || "00:00:00"}
          </p>
        </div>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic pr-1">
          {todayDate}
        </p>
      </div>
    </div>
  );
}