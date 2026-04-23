"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { APP_ALERT_EVENT, type AppAlertLevel, type AppAlertPayload } from "@/lib/uiAlerts";

type AlertItem = AppAlertPayload & {
  id: string;
};

const MAX_ALERTS = 4;

function getStyles(level: AppAlertLevel): string {
  if (level === "success") return "border-secondary/35 bg-secondary-container/15 text-secondary";
  if (level === "warning") return "border-tertiary/35 bg-tertiary-container/15 text-tertiary";
  if (level === "error") return "border-error/35 bg-error-container/15 text-error";
  return "border-primary/35 bg-primary/10 text-on-surface";
}

function getIcon(level: AppAlertLevel): string {
  if (level === "success") return "check_circle";
  if (level === "warning") return "warning";
  if (level === "error") return "error";
  return "info";
}

export function AppAlertCenter() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const lastAlertFingerprint = useRef<string>("");
  const lastAlertAt = useRef<number>(0);

  useEffect(() => {
    function onAlert(event: Event) {
      const custom = event as CustomEvent<AppAlertPayload>;
      const detail = custom.detail;
      if (!detail?.message) return;
      const fingerprint = `${detail.level}:${detail.message}`;
      const now = Date.now();
      if (fingerprint === lastAlertFingerprint.current && now - lastAlertAt.current < 4000) {
        return;
      }
      lastAlertFingerprint.current = fingerprint;
      lastAlertAt.current = now;

      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setAlerts((current) => [{ id, ...detail }, ...current].slice(0, MAX_ALERTS));
      window.setTimeout(() => {
        setAlerts((current) => current.filter((item) => item.id !== id));
      }, 4500);
    }

    window.addEventListener(APP_ALERT_EVENT, onAlert as EventListener);
    return () => window.removeEventListener(APP_ALERT_EVENT, onAlert as EventListener);
  }, []);

  const visibleAlerts = useMemo(() => alerts.slice(0, MAX_ALERTS), [alerts]);

  return (
    <div className="fixed top-20 right-2 sm:right-4 lg:right-6 z-[120] flex w-[min(24rem,calc(100vw-1rem))] sm:w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 pointer-events-none">
      {visibleAlerts.map((item) => (
        <div
          key={item.id}
          className={`pointer-events-auto rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 ${getStyles(
            item.level,
          )}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-sm leading-none">{getIcon(item.level)}</span>
            <p className="leading-snug">{item.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
