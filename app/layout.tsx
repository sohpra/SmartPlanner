import "./globals.css";
import { LayoutReplit } from "./components/Layout.replit";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LayoutReplit>{children}</LayoutReplit>
      </body>
    </html>
  );
}
