"use client";

import { useEffect, useState } from "react";

export function DashboardHeader() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const timeStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome back, Rehan
        </h1>
      </div>

      <div className="text-right text-sm text-gray-500">
        <div>{dateStr}</div>
        <div className="font-mono">{timeStr}</div>
      </div>
    </div>
  );
}
