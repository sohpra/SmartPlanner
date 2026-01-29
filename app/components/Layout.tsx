"use client";

import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div style={{ padding: 32 }}>
      {children}
    </div>
  );
}
