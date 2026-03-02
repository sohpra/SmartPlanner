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
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 shrink-0">
      {/* 🚀 LEFT: Identity & Status */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-0.5">
            <Sparkles className="w-2.5 h-2.5 text-blue-600 fill-current" />
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-600 italic">
              Masterplan
            </p>
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 rounded-md border border-emerald-100">
              <CheckCircle2 className="w-2 h-2 text-emerald-500" />
              <span className="text-[7px] font-black text-emerald-600 uppercase">Live</span>
            </div>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter italic leading-none">
            Welcome, <span className="text-blue-600">{firstName}</span>
          </h1>
        </div>
      </div>

      {/* 🕒 RIGHT: Chrono Hub */}
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
            {todayDate}
          </p>
          <div className="flex items-center justify-end gap-1.5 text-slate-600">
            <Clock className="w-3 h-3 text-blue-500" />
            <p className="text-xs md:text-sm font-black tabular-nums tracking-wider leading-none">
              {currentTime || "00:00:00"}
            </p>
          </div>
        </div>
        
        {/* Mobile-only compact clock */}
        <div className="sm:hidden bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
          <p className="text-[10px] font-black tabular-nums text-slate-600">
            {currentTime?.split(':').slice(0,2).join(':') || "00:00"}
          </p>
        </div>
      </div>
    </div>
  );
}