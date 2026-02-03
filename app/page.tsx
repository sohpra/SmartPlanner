"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        router.replace("/planner");
      } else {
        router.replace("/login");
      }
    };
    checkAuth();
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-10 w-10 bg-blue-600 rounded-2xl rotate-12 shadow-xl shadow-blue-50" />
      </div>
    </div>
  );
}