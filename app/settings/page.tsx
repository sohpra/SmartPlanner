"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { LogOut, User, Zap, ChevronRight } from "lucide-react";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <main className="p-4 space-y-6 max-w-lg mx-auto">
      <header className="py-6">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-blue-600 fill-current" />
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Plan Bee System</span>
        </div>
        <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter">Settings</h2>
      </header>

      {/* User Status Card - Mirroring the Sidebar look */}
      <section className="bg-slate-50/50 rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 font-black text-xl shadow-sm">
            {user?.email?.[0].toUpperCase() || "?"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-black text-slate-900 truncate uppercase tracking-tight">
              {user?.email?.split('@')[0] || "Guest User"}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Verified Session
            </span>
          </div>
        </div>

        {/* Reuse the Terminate Button Logic */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-white text-red-500 border border-red-100 hover:bg-red-50 transition-all shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          Terminate Session
        </button>
      </section>

      <p className="text-center text-[9px] font-bold text-slate-300 uppercase tracking-[0.3em]">
        Plan Bee v1.0.4 — Secured
      </p>
    </main>
  );
}