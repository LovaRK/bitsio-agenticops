"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export function ActionDock() {
  const router = useRouter();
  const [isResolving, setIsResolving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleQuickResolve = () => {
    setIsResolving(true);
    // Simulate resolution process
    setTimeout(() => {
      setIsResolving(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }, 1500);
  };

  const handleRecentActivity = () => {
    router.push("/incidents");
  };

  return (
    <>
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-secondary text-on-secondary px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 z-[60]">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <span className="text-sm font-bold">Successfully resolved 4 pending high-priority incidents.</span>
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
            className={`flex items-center gap-2 text-xs font-bold transition-all active:scale-95 ${
              isResolving 
                ? "text-outline bg-surface-container py-1.5 px-3 rounded-lg cursor-not-allowed" 
                : "text-on-tertiary-fixed hover:text-tertiary"
            }`}
          >
            <span className={`material-symbols-outlined text-sm ${isResolving ? "animate-spin" : ""}`}>
              {isResolving ? "progress_activity" : "bolt"}
            </span>
            {isResolving ? "Resolving..." : "Quick Resolve (4)"}
          </button>
          
          <button
            onClick={handleRecentActivity}
            className="flex items-center gap-2 text-xs font-bold text-primary hover:text-primary transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">history</span>
            Recent Activity
          </button>
        </div>
      </div>
    </>
  );
}
