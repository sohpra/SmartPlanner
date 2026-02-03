// app/layout.tsx
import "./globals.css";
import LayoutReplit from "./components/Layout.replit"; // Removed the curly braces

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