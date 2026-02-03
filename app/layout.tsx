// app/layout.tsx
import "./globals.css";
import LayoutReplit from "./components/Layout.replit";

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
        <LayoutReplit>{children}</LayoutReplit>
      </body>
    </html>
  );
}