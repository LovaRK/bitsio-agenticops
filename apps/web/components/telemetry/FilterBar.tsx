"use client";

import { useState, useEffect } from "react";
import type { ScoringConfig, TrustMeta } from "@/types/telemetry-executive";

interface FilterBarProps {
  config: Partial<ScoringConfig>;
  onChange: (config: Partial<ScoringConfig>) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  trust?: TrustMeta;
  isLive?: boolean;
}

export function FilterBar({ config, onChange, onRefresh, isLoading = false, trust, isLive }: FilterBarProps) {
  const [customer, setCustomer] = useState("Demo Customer");
  const [costPerGb, setCostPerGb] = useState(config.cost_per_gb_year ?? 10);
  const [storageGbMonth, setStorageGbMonth] = useState(135);
  const [utilW, setUtilW] = useState(config.util_weight ?? 0.35);
  const [detW, setDetW] = useState(config.det_weight ?? 0.40);
  const [qualW, setQualW] = useState(config.qual_weight ?? 0.25);

  const weightSum = utilW + detW + qualW;
  const weightsValid = Math.abs(weightSum - 1.0) < 0.02;

  useEffect(() => {
    if (weightsValid) {
      onChange({
        cost_per_gb_year: costPerGb,
        util_weight: utilW,
        det_weight: detW,
        qual_weight: qualW,
      });
    }
  }, [costPerGb, utilW, detW, qualW]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sticky top-0 z-30 bg-surface-container border-b border-outline-variant/20 px-6 py-4">
      <div className="flex flex-wrap items-end gap-4">
        {/* Customer name */}
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
            Customer
          </label>
          <input
            type="text"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {/* Cost per GB */}
        <div className="flex flex-col gap-1 w-28">
          <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
            $/GB/Year
          </label>
          <input
            type="number"
            min={1}
            max={1000}
            step={10}
            value={costPerGb}
            onChange={(e) => setCostPerGb(Number(e.target.value))}
            className="rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {/* Storage GB/month */}
        <div className="flex flex-col gap-1 w-28">
          <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
            Storage GB/Mo
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={storageGbMonth}
            onChange={(e) => setStorageGbMonth(Number(e.target.value))}
            className="rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {/* Weight inputs */}
        <div className="flex flex-col gap-1 w-24">
          <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
            Util Wt
          </label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={utilW}
            onChange={(e) => setUtilW(Number(e.target.value))}
            className={`rounded-lg border px-3 py-1.5 text-sm text-on-surface bg-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary/50 ${
              !weightsValid ? "border-error" : "border-outline-variant/30"
            }`}
          />
        </div>
        <div className="flex flex-col gap-1 w-24">
          <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
            Det Wt
          </label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={detW}
            onChange={(e) => setDetW(Number(e.target.value))}
            className={`rounded-lg border px-3 py-1.5 text-sm text-on-surface bg-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary/50 ${
              !weightsValid ? "border-error" : "border-outline-variant/30"
            }`}
          />
        </div>
        <div className="flex flex-col gap-1 w-24">
          <label className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
            Qual Wt
          </label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={qualW}
            onChange={(e) => setQualW(Number(e.target.value))}
            className={`rounded-lg border px-3 py-1.5 text-sm text-on-surface bg-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary/50 ${
              !weightsValid ? "border-error" : "border-outline-variant/30"
            }`}
          />
        </div>

        {/* Weight sum indicator */}
        <div className="flex flex-col justify-end pb-1">
          {weightsValid ? (
            <span className="text-xs text-secondary font-semibold">
              Sum = {weightSum.toFixed(2)} ✓
            </span>
          ) : (
            <span className="text-xs text-error font-semibold">
              Sum = {weightSum.toFixed(2)} — must equal 1.0
            </span>
          )}
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg bg-primary/20 border border-primary/30 text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <span className="inline-block animate-spin">⟳</span>
              Refreshing…
            </>
          ) : (
            <>
              🔄 Refresh Data
            </>
          )}
        </button>
      </div>
      {trust && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(isLive || trust.data_source === "live") && (
              <span className="rounded-full border border-secondary/40 bg-secondary/10 px-2 py-0.5 font-semibold text-secondary">
                Live Splunk Data
              </span>
            )}
            {trust.fallback_used && (
              <span className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 font-semibold text-amber-300">
                Using cached data - Splunk unavailable
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant">
            Fetched: {trust.fetched_at ? new Date(trust.fetched_at).toUTCString() : "n/a"} · Latency: {trust.latency_ms}ms · Confidence: {Math.round(trust.confidence * 100)}%
          </p>
        </div>
      )}
    </div>
  );
}
