// app/layout.tsx
import "./globals.css";
import LayoutReplit from "./components/Layout.replit";
import { MobileNav } from "./components/layout/MobileNav"; // 🎯 1. Import the Nav

export const metadata = {
  title: "Plan Bee | Ultimate Planner",
  description: "High-performance planner for the high performer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="bg-white">
        <LayoutReplit>
          {/* 🎯 2. Add padding-bottom (pb-24) to prevent content being hidden behind the bar */}
          <div className="pb-24 md:pb-8">
            {children}
          </div>
        </LayoutReplit>
        
        {/* 🎯 3. Place the MobileNav here (it stays outside the scroll container) */}
        <MobileNav />
      </body>
    </html>
  );
}