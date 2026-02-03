"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Sparkles, Clock, LogOut, CheckCircle2 } from "lucide-react";

export function DashboardHeader() {
  const [firstName, setFirstName] = useState("there");
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    // 1. Fetch the Name from Metadata (Priority)
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

    // 2. Live Clock (24h format)
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login"; // Redirect back to gateway
  };

  const todayDate = new Date().toLocaleDateString("en-GB", {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100 mb-8">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-50 rounded-lg">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 fill-current" />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
              Strategic Roadmap
            </p>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-100">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
              <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-tighter">Live Sync</span>
            </div>
          </div>
        </div>
        
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic leading-none">
          Welcome back, <span className="text-blue-600">{firstName}</span>
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* 🕒 Time & Date */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2.5 text-slate-600 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
            <Clock className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-black tabular-nums tracking-wider leading-none">
              {currentTime || "00:00:00"}
            </p>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic pr-1">
            {todayDate}
          </p>
        </div>

        {/* 🚪 Logout Button */}
        <button 
          onClick={handleLogout}
          className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all group"
          title="Sign Out"
        >
          <LogOut className="w-5 h-5 group-active:scale-90" />
        </button>
      </div>
    </div>
  );
}