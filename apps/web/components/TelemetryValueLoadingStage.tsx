"use client";

import { useEffect, useMemo, useState } from "react";

const STAGES = [
  { key: "connect", label: "Connecting to API and Splunk adapter" },
  { key: "indexes", label: "Scanning Splunk indexes and source profiles" },
  { key: "usage", label: "Aggregating search usage and dashboard references" },
  { key: "score", label: "Scoring utilization, waste, and savings signals" },
  { key: "render", label: "Rendering telemetry value dashboard" },
];

const QUERY_PREVIEW = [
  "search index=* ... | stats ... BY index, sourcetype",
  "index=_audit action=search ... | stats ... BY source_type",
  "index=_audit action=search ... | stats ... BY index_name",
];

export function TelemetryValueLoadingStage() {
  const [elapsed, setElapsed] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const elapsedTimer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    const stageTimer = setInterval(
      () => setStageIndex((prev) => Math.min(prev + 1, STAGES.length - 1)),
      1800,
    );

    return () => {
      clearInterval(elapsedTimer);
      clearInterval(stageTimer);
    };
  }, []);

  const progressPct = useMemo(
    () => Math.round(((stageIndex + 1) / STAGES.length) * 100),
    [stageIndex],
  );

  return (
    <div className="rounded-xl border border-primary/25 bg-primary-container/10 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-on-surface">Live Splunk telemetry query in progress</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            This route loads fresh query-based metrics (not static cards). Large index windows may take longer.
          </p>
        </div>
        <span className="text-xs font-bold text-secondary whitespace-nowrap">{elapsed}s</span>
      </div>

      <div className="mt-4 h-2 w-full rounded-full bg-surface-container-high">
        <div
          className="h-2 rounded-full bg-secondary transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <p className="mt-3 text-xs font-medium text-on-surface">
        {STAGES[stageIndex]?.label ?? STAGES[0].label}
      </p>

      <ul className="mt-3 space-y-1.5 text-xs">
        {STAGES.map((stage, idx) => {
          const isDone = idx < stageIndex;
          const isActive = idx === stageIndex;
          return (
            <li
              key={stage.key}
              className={`flex items-center gap-2 ${
                isDone ? "text-secondary" : isActive ? "text-on-surface" : "text-on-surface-variant"
              }`}
            >
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  isDone ? "bg-secondary" : isActive ? "bg-primary" : "bg-outline-variant/50"
                }`}
              />
              <span>{stage.label}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
          Planned SPL query sequence
        </p>
        <ul className="mt-2 space-y-1.5 text-xs text-on-surface-variant">
          {QUERY_PREVIEW.map((query) => (
            <li key={query} className="font-mono">
              {query}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
