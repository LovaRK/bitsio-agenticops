"use client";

import { SideNav } from "@/components/SideNav";
import { TopBar } from "@/components/TopBar";
import { RouteTransition } from "@/components/RouteTransition";
import { AppAlertCenter } from "@/components/AppAlertCenter";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SideNav />
      <TopBar />
      <AppAlertCenter />
      <main className="pl-64 pt-16 min-h-screen">
        <RouteTransition>{children}</RouteTransition>
      </main>
    </>
  );
}
