"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Zap, Lock, Mail, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Use window.location to ensure a clean state reset on entry
      window.location.href = "/planner";
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-10 animate-in fade-in duration-700">
        
        {/* 👋 Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-4 bg-slate-900 rounded-[2rem] shadow-2xl shadow-slate-200 mb-4">
            <Zap className="w-8 h-8 text-white fill-current" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic leading-none">
            Plan <span className="text-blue-600">Bee</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            Login to begin your session
          </p>
        </div>

        {/* 🔐 Login Form */}
        <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-600 transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-600 transition-all"
              />
            </div>
          </div>

          <button
            onClick={signIn}
            disabled={loading || !email || !password}
            className="group w-full flex items-center justify-between p-2 bg-blue-600 rounded-[1.5rem] hover:bg-slate-900 transition-all duration-300 disabled:opacity-30"
          >
            <span className="pl-6 text-[10px] font-black uppercase tracking-[0.2em] text-white">
              {loading ? "Authenticating..." : "Authorise"}
            </span>
            <div className="bg-white/20 p-4 rounded-2xl group-hover:bg-white/10">
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
          </button>

          {error && (
            <div className="text-center p-3 bg-red-50 rounded-2xl border border-red-100">
              <p className="text-[10px] font-black uppercase text-red-500 tracking-tight">{error}</p>
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-[9px] font-black text-slate-200 uppercase tracking-[0.3em]">
            Secure Gateway • Build 2026
          </p>
        </div>
      </div>
    </div>
  );
}