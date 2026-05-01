"use client";

import { useEffect, useRef } from "react";

interface ExplainabilityDrawerProps {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
}

export function ExplainabilityDrawer({ open, title, body, onClose }: ExplainabilityDrawerProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        e.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} role="presentation">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute right-0 top-0 h-full w-full max-w-lg border-l border-white/10 bg-slate-950 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <div className="mt-3 space-y-3 text-sm text-white/85">
          <section><p className="text-xs uppercase tracking-[0.14em] text-white/55">What this is</p><p>{body}</p></section>
          <section><p className="text-xs uppercase tracking-[0.14em] text-white/55">Formula</p><p>Composite = 0.35 × Utilization + 0.40 × Detection + 0.25 × Quality</p></section>
          <section><p className="text-xs uppercase tracking-[0.14em] text-white/55">Example</p><p>Annual Cost = GB/day × 365 × Cost/GB/year</p></section>
          <section><p className="text-xs uppercase tracking-[0.14em] text-white/55">Source fields</p><p>summary.*, sources.*, security_findings.*, query_context.*</p></section>
          <section><p className="text-xs uppercase tracking-[0.14em] text-white/55">Why it matters</p><p>Links telemetry cost to security value and decision confidence.</p></section>
          <section><p className="text-xs uppercase tracking-[0.14em] text-white/55">Decision trace</p><p>Observe → Analyze → Reason → Decide → Action → Audit</p></section>
          <section><p className="text-xs uppercase tracking-[0.14em] text-white/55">Guardrail result</p><p>Risky actions are approval-gated; blocked actions cannot execute.</p></section>
        </div>
        <button
          ref={closeRef}
          className="mt-4 rounded border border-white/15 px-3 py-1 text-sm text-white"
          onClick={onClose}
        >
          Close
        </button>
      </aside>
    </div>
  );
}
