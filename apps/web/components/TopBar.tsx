"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { listPendingApprovals } from "@/lib/api";

type NotificationItem = {
  id: string;
  title: string;
  href: string;
  level: "info" | "warn";
};

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [actionMessage, setActionMessage] = useState("");
  const [deployLoading, setDeployLoading] = useState(false);
  const [showDeployHelp, setShowDeployHelp] = useState(false);

  const notifications = useMemo<NotificationItem[]>(
    () => [
      {
        id: "n1",
        title:
          pendingApprovals > 0
            ? `${pendingApprovals} approval items are waiting`
            : "No approvals pending",
        href: "/approvals",
        level: pendingApprovals > 0 ? "warn" : "info",
      },
      {
        id: "n2",
        title: "Open latest incidents",
        href: "/incidents",
        level: "info",
      },
    ],
    [pendingApprovals]
  );

  useEffect(() => {
    async function loadNotifications() {
      try {
        const approvals = await listPendingApprovals();
        setPendingApprovals(approvals.length);
      } catch {
        setPendingApprovals(0);
      }
    }

    void loadNotifications();
  }, []);

  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsProfileOpen(false);
        setShowDeployHelp(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  useEffect(() => {
    if (!actionMessage) return;
    const timer = window.setTimeout(() => setActionMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  const handleDeployFix = () => {
    setDeployLoading(true);
    if (pathname.startsWith("/incidents/")) {
      router.push(`${pathname}#approval-section`);
      setActionMessage("Jumped to decision gate for this incident.");
      setTimeout(() => setDeployLoading(false), 600);
      return;
    }

    if (pendingApprovals > 0) {
      router.push("/approvals");
      setActionMessage("Opened approvals queue to deploy reviewed fix.");
      setTimeout(() => setDeployLoading(false), 600);
      return;
    }

    router.push("/incidents");
    setActionMessage("Opened incident explorer to pick a fix candidate.");
    setTimeout(() => setDeployLoading(false), 600);
  };

  const handleProfileAction = (action: "settings" | "support" | "signout") => {
    setIsProfileOpen(false);
    if (action === "settings") {
      router.push("/settings");
      return;
    }
    if (action === "support") {
      router.push("/support");
      return;
    }
    setActionMessage("Sign out is not connected yet (mock boundary).");
  };

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-surface/60 backdrop-blur-xl flex justify-between items-center px-6 md:px-8 border-b border-outline-variant/15 z-40">
      <div className="flex items-center gap-8">
        <div className="text-lg font-bold text-on-surface font-headline">AgenticOps</div>
        <nav className="flex gap-6">
          <Link
            className={`hover:text-on-surface transition-opacity text-sm font-medium ${
              pathname === "/" ? "text-on-surface" : "text-on-surface-variant"
            }`}
            href="/"
          >
            Timeline
          </Link>
          <Link
            className={`hover:text-on-surface transition-opacity text-sm font-medium ${
              pathname.startsWith("/monitoring") ? "text-on-surface" : "text-on-surface-variant"
            }`}
            href="/monitoring"
          >
            Logs
          </Link>
          <Link
            className={`hover:text-on-surface transition-opacity text-sm font-medium ${
              pathname.startsWith("/incidents") ? "text-on-surface" : "text-on-surface-variant"
            }`}
            href="/incidents"
          >
            Traces
          </Link>
          <Link
            className={`hover:text-on-surface transition-opacity text-sm font-medium ${
              pathname.startsWith("/waste") || pathname.startsWith("/telemetry-value")
                ? "text-on-surface"
                : "text-on-surface-variant"
            }`}
            href="/telemetry-value"
          >
            Metrics
          </Link>
        </nav>
      </div>
      <div className="relative flex items-center gap-4" ref={panelRef}>
        <div className="flex items-center gap-2 mr-2">
          <ThemeToggle compact />
          <button
            aria-label="Notifications"
            onClick={() => setIsOpen((current) => !current)}
            className="relative rounded-lg p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined">notifications</span>
            {pendingApprovals > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-error text-[10px] leading-4 text-on-error font-bold">
                {pendingApprovals > 9 ? "9+" : pendingApprovals}
              </span>
            )}
          </button>
          <Link
            aria-label="Recent activity"
            className="rounded-lg p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            href="/incidents"
          >
            <span className="material-symbols-outlined">history_edu</span>
          </Link>
        </div>
        <button
          type="button"
          onClick={handleDeployFix}
          disabled={deployLoading}
          className="bg-primary-container text-on-primary-container px-4 py-1.5 rounded-xl text-sm font-bold glow-primary transition-all active:scale-95"
        >
          <span className="inline-flex items-center gap-2">
            {deployLoading ? (
              <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
            ) : null}
            {deployLoading ? "Loading..." : "Deploy Fix"}
          </span>
        </button>
        <button
          type="button"
          aria-label="Deploy Fix help"
          onClick={() => setShowDeployHelp((current) => !current)}
          className="rounded-lg p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined text-base">help</span>
        </button>
        <button
          type="button"
          aria-label="Profile menu"
          onClick={() => setIsProfileOpen((current) => !current)}
          className="w-8 h-8 rounded-full bg-surface-container overflow-hidden border border-outline-variant/30 hover:ring-2 hover:ring-primary/30 transition-all"
        >
          <img
            alt="User Profile"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDhn0HuwzN8UCY2lmEWKVIHbeVGppY9gOJ_iKxnjiZGLE7fNpG8sZ0GSg9v1KwLGhB4kk_HFxt6c9VIyqCCCAZW6YW0Q-Uv-46VMJBIQUJjoPtRBIoFVW4KFXmhC962Dmb81f_FgKWjcIc2Kfko_JobTeAmwIjJ2DLKlO-RZWtabLy5H8RfjPoERFlVmVy1znwbbA0VQt3Bxj92AoPaITWIJoNUldTrhXPS64lASXiObs1T0idnDuuk-5XnaUUQ6xb2Vx09ovnDoKBp"
          />
        </button>

        {isOpen && (
          <div className="absolute top-14 right-0 w-80 rounded-xl border border-outline-variant/20 bg-surface-container shadow-2xl p-2">
            <div className="px-3 py-2 text-xs font-bold tracking-widest uppercase text-outline">
              Notifications
            </div>
            <div className="space-y-1">
              {notifications.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="block rounded-lg px-3 py-2 hover:bg-surface-container-high transition-colors"
                >
                  <div
                    className={`text-sm font-medium ${
                      item.level === "warn" ? "text-tertiary" : "text-on-surface"
                    }`}
                  >
                    {item.title}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {isProfileOpen && (
          <div className="absolute top-14 right-0 w-56 rounded-xl border border-outline-variant/20 bg-surface-container shadow-2xl p-2 z-50">
            <div className="px-3 py-2 border-b border-outline-variant/15">
              <p className="text-sm font-semibold text-on-surface">Rama</p>
              <p className="text-[11px] text-on-surface-variant">Analyst Workspace</p>
            </div>
            <button
              type="button"
              onClick={() => handleProfileAction("settings")}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-on-surface hover:bg-surface-container-high"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={() => handleProfileAction("support")}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-on-surface hover:bg-surface-container-high"
            >
              Support
            </button>
            <button
              type="button"
              onClick={() => handleProfileAction("signout")}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-error hover:bg-surface-container-high"
            >
              Sign Out
            </button>
          </div>
        )}

        {showDeployHelp && (
          <div className="absolute top-14 right-24 w-80 rounded-xl border border-outline-variant/20 bg-surface-container shadow-2xl p-3 z-50">
            <p className="text-xs font-bold tracking-widest uppercase text-outline">Deploy Fix Behavior</p>
            <ul className="mt-2 space-y-1 text-xs text-on-surface-variant">
              <li>On incident detail: jumps to the decision/approval section.</li>
              <li>When approvals are pending: opens approvals queue.</li>
              <li>Otherwise: opens incidents explorer to pick a fix candidate.</li>
            </ul>
          </div>
        )}

        {actionMessage && (
          <div className="absolute -bottom-10 right-0 max-w-sm rounded-lg bg-surface-container-high border border-outline-variant/20 px-3 py-2 text-xs text-on-surface-variant">
            {actionMessage}
          </div>
        )}
      </div>
    </header>
  );
}
