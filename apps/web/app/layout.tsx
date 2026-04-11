import "./globals.css";
import type { Metadata } from "next";
import { SideNav } from "@/components/SideNav";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "BitsIO AgenticOps",
  description: "Reasoning-first incident operations dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-surface">
        <SideNav />
        <TopBar />
        <main className="pl-64 pt-16 min-h-screen">{children}</main>
      </body>
    </html>
  );
}
