import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: { default: "Astral Companion", template: "%s · Astral Companion" },
  description: "Personal Honkai: Star Rail command center with Silver Wolf as your companion. Local-first.",
};

export const viewport: Viewport = { themeColor: "#05050b", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
