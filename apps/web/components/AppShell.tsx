"use client";

import { SideNav } from "@/components/SideNav";
import { TopBar } from "@/components/TopBar";
import { RouteTransition } from "@/components/RouteTransition";
import { AppAlertCenter } from "@/components/AppAlertCenter";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <SideNav />
      <TopBar />
      <AppAlertCenter />
      <main className="min-h-screen pt-16 pb-20 lg:pb-0 lg:pl-64">
        <RouteTransition>{children}</RouteTransition>
      </main>
    </ErrorBoundary>
  );
}
