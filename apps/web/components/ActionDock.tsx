"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  listPendingApprovals,
  quickResolvePendingApprovals,
  type PendingApprovalItem,
} from "@/lib/api";
import { emitAppAlert } from "@/lib/uiAlerts";

export function ActionDock() {
  const router = useRouter();
  const [isResolving, setIsResolving] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [pendingItems, setPendingItems] = useState<PendingApprovalItem[]>([]);

  const highPriorityCount = pendingItems.filter((item) => {
    const severity = item.severity.toLowerCase();
    return severity === "high" || severity === "critical";
  }).length;

  useEffect(() => {
    async function loadPending() {
      try {
        const items = await listPendingApprovals({ suppressAlerts: true });
        setPendingItems(items);
      } catch {
        setPendingItems([]);
      }
    }
    void loadPending();
  }, []);

  const handleQuickResolve = async () => {
    setIsResolving(true);
    try {
      const resolvedCount = await quickResolvePendingApprovals(pendingItems);
      if (resolvedCount === 0) {
        setToastMessage("No high-priority pending incidents to resolve.");
        emitAppAlert({ level: "info", message: "No high-priority pending incidents to resolve." });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        return;
      } else {
        setToastMessage(
          `Successfully resolved ${resolvedCount} pending high-priority incident${resolvedCount > 1 ? "s" : ""}.`,
        );
        emitAppAlert({
          level: "success",
          message: `Quick resolve completed: ${resolvedCount} incident${resolvedCount > 1 ? "s" : ""}.`,
        });
      }
      try {
        const refreshed = await listPendingApprovals({ suppressAlerts: true });
        setPendingItems(refreshed);
      } catch {
        // Keep latest known queue in-memory; do not hard-fail quick resolve after successful submit.
      }
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch {
      setToastMessage("Quick resolve failed. Check API connection and retry.");
      emitAppAlert({ level: "error", message: "Quick resolve failed. Check API connection and retry." });
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsResolving(false);
    }
  };

  const handleRecentActivity = () => {
    setIsNavigating(true);
    router.push("/incidents");
    setTimeout(() => setIsNavigating(false), 800);
  };

  return (
    <>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-secondary text-on-secondary px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 z-[60]">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Floating Action Dock */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-surface-variant/60 backdrop-blur-xl border border-outline-variant/30 px-6 py-3 rounded-full flex items-center gap-8 shadow-2xl z-50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-on-surface uppercase tracking-wider">System Pulse</span>
          <div className="flex gap-1 items-end h-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-1 rounded-full bg-secondary transition-all duration-300 ${
                  isResolving ? "animate-bounce" : ""
                }`}
                style={{
                  height: `${[12, 20, 16, 24][i - 1]}px`,
                  animationDelay: `${i * 100}ms`
                }}
              ></div>
            ))}
          </div>
        </div>
        
        <div className="h-6 w-px bg-outline-variant/30"></div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={handleQuickResolve}
            disabled={isResolving}
            title="Resolve high-priority pending approvals in one action"
            data-testid="quick-resolve-btn"
            className={`flex items-center gap-2 text-xs font-bold transition-all active:scale-95 ${
              isResolving 
                ? "text-outline bg-surface-container py-1.5 px-3 rounded-lg cursor-not-allowed" 
                : "text-on-surface hover:text-primary"
            }`}
          >
            <span className={`material-symbols-outlined text-sm ${isResolving ? "animate-spin" : ""}`}>
              {isResolving ? "progress_activity" : "bolt"}
            </span>
            {isResolving ? "Resolving..." : `Quick Resolve (${highPriorityCount})`}
          </button>
          
          <button
            onClick={handleRecentActivity}
            disabled={isNavigating}
            title="Jump to incident activity feed"
            className="flex items-center gap-2 text-xs font-bold text-primary hover:text-primary transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className={`material-symbols-outlined text-sm ${isNavigating ? "animate-spin" : ""}`}>
              {isNavigating ? "progress_activity" : "history"}
            </span>
            {isNavigating ? "Opening..." : "Recent Activity"}
          </button>
        </div>
      </div>
    </>
  );
}
