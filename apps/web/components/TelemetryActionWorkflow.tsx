"use client";

import { useMemo, useState } from "react";
import type { TelemetryMetricsResponse } from "@/types/api";

type ActionItem = NonNullable<TelemetryMetricsResponse["actions"]>[number];

function severityTone(severity: "low" | "medium" | "high") {
  if (severity === "high") return "border-error/40 bg-error-container/20 text-error";
  if (severity === "medium") return "border-warning/40 bg-warning/20 text-warning";
  return "border-secondary/40 bg-secondary-container/20 text-secondary";
}

export function TelemetryActionWorkflow({ actions }: { actions: ActionItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [owner, setOwner] = useState("Platform Team");

  const selected = useMemo(
    () => actions.find((action) => action.id === selectedId) ?? null,
    [actions, selectedId],
  );

  return (
    <>
      <div className="space-y-3">
        {actions.map((action) => (
          <div key={action.id} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-on-surface">{action.label}</p>
                <p className="mt-1 text-xs text-on-surface-variant">{action.description}</p>
                <p className="mt-2 text-xs text-on-surface">
                  Source: <span className="font-semibold">{action.source_target ?? "n/a"}</span>
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">{action.issue ?? "No issue metadata."}</p>
              </div>
              <span className={`inline-block rounded-full border px-2 py-1 text-[10px] font-semibold ${severityTone(action.severity)}`}>
                {action.severity.toUpperCase()}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-on-surface-variant">
                Decision confidence: <span className="font-semibold text-on-surface">{Math.round((action.decision_confidence ?? 0.75) * 100)}%</span>
              </p>
              <button
                type="button"
                className="rounded-md border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs text-on-surface hover:bg-surface-container-high"
                onClick={() => setSelectedId(action.id)}
              >
                {action.cta === "review_policy" ? "Review Policy →" : action.cta === "adjust_retention" ? "Adjust Retention →" : "Assign Owner →"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 bg-black/55 p-4 sm:p-6 md:p-10">
          <div className="mx-auto max-w-2xl rounded-xl border border-outline-variant/20 bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-on-surface">{selected.label}</p>
                <p className="mt-1 text-sm text-on-surface-variant">{selected.description}</p>
              </div>
              <button
                type="button"
                className="rounded-md border border-outline-variant/30 px-2 py-1 text-xs text-on-surface"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3 text-sm">
              <p className="text-on-surface">
                <span className="text-on-surface-variant">Source:</span>{" "}
                <span className="font-semibold">{selected.source_target ?? "n/a"}</span>
              </p>
              <p className="mt-1 text-on-surface">
                <span className="text-on-surface-variant">Issue:</span>{" "}
                <span className="font-semibold">{selected.issue ?? "No issue metadata."}</span>
              </p>
              {selected.current_value ? (
                <p className="mt-1 text-on-surface">
                  <span className="text-on-surface-variant">Current:</span> {selected.current_value}
                </p>
              ) : null}
              {selected.suggested_value ? (
                <p className="mt-1 text-on-surface">
                  <span className="text-on-surface-variant">Suggested:</span> {selected.suggested_value}
                </p>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
                <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Savings Delta</p>
                <p className="mt-2 text-sm font-semibold text-secondary">
                  ${(selected.impact_preview?.savings_delta_usd ?? selected.estimated_savings_usd ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
                <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Risk Shift</p>
                <p className="mt-2 text-sm font-semibold text-on-surface capitalize">
                  {(selected.impact_preview?.risk_before ?? "medium")} → {(selected.impact_preview?.risk_after ?? "medium")}
                </p>
              </div>
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
                <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Compliance</p>
                <p className="mt-2 text-sm font-semibold text-on-surface">
                  {selected.impact_preview?.compliance_safe === false ? "Needs review" : "Safe"}
                </p>
              </div>
            </div>

            {selected.cta === "assign_owner" ? (
              <div className="mt-4 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
                <p className="text-xs text-on-surface-variant mb-2">Assign ownership</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={owner}
                    onChange={(event) => setOwner(event.target.value)}
                    className="rounded-md border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface"
                  >
                    <option>Platform Team</option>
                    <option>Security Operations</option>
                    <option>Cloud Infra</option>
                    <option>Data Governance</option>
                  </select>
                  <button
                    type="button"
                    className="rounded-md border border-outline-variant/30 bg-surface px-3 py-2 text-xs text-on-surface"
                  >
                    Save Owner
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
