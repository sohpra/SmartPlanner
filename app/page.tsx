"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/login");
      } else {
        setEmail(data.user.email ?? null);
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return <div style={{ padding: 40 }}>Loading…</div>;
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Smart Planner</h1>

      <p>
        Signed in as <strong>{email}</strong>
      </p>

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.replace("/login");
        }}
      >
        Sign out
      </button>
    </div>
  );
}
