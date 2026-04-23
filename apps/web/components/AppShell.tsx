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
      <main className="min-h-screen pt-16 pb-20 lg:pb-0 lg:pl-64">
        <RouteTransition>{children}</RouteTransition>
      </main>
    </>
  );
}
