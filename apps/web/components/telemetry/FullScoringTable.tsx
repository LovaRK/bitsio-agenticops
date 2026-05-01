"use client";

import React from "react";
import { useState, useMemo } from "react";
import { ScoreBreakdownTooltip } from "./ScoreBreakdownTooltip";
import type { SourcetypeScore, TierName } from "@/types/telemetry-executive";

const TIER_COLORS: Record<TierName, string> = {
  Critical: "#4caf50",
  Important: "#2196f3",
  "Nice-to-Have": "#ff9800",
  Wasteful: "#f44336",
};

const TIER_NAMES: TierName[] = ["Critical", "Important", "Nice-to-Have", "Wasteful"];
const PAGE_SIZE = 20;

interface FullScoringTableProps {
  scores: SourcetypeScore[];
  segmentFilter?: "utilized" | "underutilized" | null;
}

type SortKey = "composite" | "utilization" | "detection" | "quality" | "gb_per_day" | "annual_cost_usd" | "sourcetype";

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function FullScoringTableBase({ scores, segmentFilter = null }: FullScoringTableProps) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierName | "All">("All");
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = scores;
    if (segmentFilter === "utilized") {
      result = result.filter((s) => s.tier === "Critical" || s.tier === "Important");
    }
    if (segmentFilter === "underutilized") {
      result = result.filter((s) => s.tier === "Nice-to-Have" || s.tier === "Wasteful");
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.sourcetype.toLowerCase().includes(q) || s.index.toLowerCase().includes(q),
      );
    }
    if (tierFilter !== "All") {
      result = result.filter((s) => s.tier === tierFilter);
    }
    return result;
  }, [scores, search, tierFilter, segmentFilter]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortAsc ? aVal - bVal : bVal - aVal;
        }
        return sortAsc
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }),
    [filtered, sortKey, sortAsc],
  );

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
    setPage(0);
  }

  function SortHeader({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        className="text-left pb-2 pr-3 text-[10px] uppercase tracking-wider text-on-surface-variant font-bold cursor-pointer hover:text-on-surface"
        onClick={() => handleSort(col)}
      >
        {label} {sortKey === col ? (sortAsc ? "↑" : "↓") : ""}
      </th>
    );
  }

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-5 mb-6">
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">
        Full Sourcetype Scoring Table
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search sourcetype or index…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50 w-64"
        />
        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value as TierName | "All"); setPage(0); }}
          className="rounded-lg border border-outline-variant/30 bg-surface-container-high px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="All">All Tiers</option>
          {TIER_NAMES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="text-xs text-on-surface-variant self-center">
          {sorted.length} sourcetypes
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No sourcetypes match the current filter.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/15">
                  <SortHeader col="sourcetype" label="Sourcetype" />
                  <SortHeader col="composite" label="Composite" />
                  <SortHeader col="utilization" label="Util" />
                  <SortHeader col="detection" label="Det" />
                  <SortHeader col="quality" label="Qual" />
                  <th className="text-left pb-2 pr-3 text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Tier</th>
                  <SortHeader col="gb_per_day" label="GB/Day" />
                  <SortHeader col="annual_cost_usd" label="Annual Cost" />
                  <th className="text-left pb-2 text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Det. Gap</th>
                  <th className="text-left pb-2 text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Explain</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((s) => (
                  <React.Fragment key={s.sourcetype}>
                  <tr className="border-b border-outline-variant/10 hover:bg-surface-container-high transition-colors">
                    <td className="py-2.5 pr-3 font-mono text-xs text-on-surface max-w-[160px] truncate">
                      {s.sourcetype}
                      <span className="block text-[10px] text-on-surface-variant">{s.index}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <ScoreBreakdownTooltip
                        label={s.sourcetype}
                        value={s.composite}
                        formula="Composite = U×0.35 + D×0.40 + Q×0.25"
                        inputs={[
                          { label: "Utilization", value: s.utilization, weight: 0.35, color: "#4caf50" },
                          { label: "Detection", value: s.detection, weight: 0.40, color: "#2196f3" },
                          { label: "Quality", value: s.quality, weight: 0.25, color: "#ff9800" },
                        ]}
                        source="composite scorer"
                      >
                        <span
                          className="font-black cursor-help"
                          style={{ color: TIER_COLORS[s.tier] }}
                        >
                          {s.composite}
                        </span>
                      </ScoreBreakdownTooltip>
                    </td>
                    <td className="py-2.5 pr-3 text-on-surface-variant">{s.utilization.toFixed(1)}</td>
                    <td className="py-2.5 pr-3 text-on-surface-variant">{s.detection.toFixed(1)}</td>
                    <td className="py-2.5 pr-3 text-on-surface-variant">{s.quality.toFixed(1)}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          background: `${TIER_COLORS[s.tier]}22`,
                          color: TIER_COLORS[s.tier],
                          border: `1px solid ${TIER_COLORS[s.tier]}44`,
                        }}
                      >
                        {s.tier}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-on-surface">{s.gb_per_day.toFixed(2)}</td>
                    <td className="py-2.5 pr-3 font-semibold text-on-surface">{fmtUsd(s.annual_cost_usd)}</td>
                    <td className="py-2.5">
                      {s.detection_gap ? (
                        <span className="text-[10px] rounded-full bg-error/15 text-error border border-error/30 px-2 py-0.5 font-semibold">
                          GAP
                        </span>
                      ) : (
                        <span className="text-[10px] text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <button
                        className="rounded-md border border-outline-variant/30 px-2 py-1 text-[10px] font-semibold text-on-surface hover:bg-surface-container-high"
                        onClick={() => setExpanded(expanded === s.sourcetype ? null : s.sourcetype)}
                      >
                        Explain Score
                      </button>
                    </td>
                  </tr>
                  {expanded === s.sourcetype && (
                    <tr className="border-b border-outline-variant/10 bg-surface-container-low">
                      <td colSpan={10} className="px-3 py-3">
                        <ScoreBreakdownTooltip
                          label={s.sourcetype}
                          value={s.composite}
                          formula="Composite = U×0.35 + D×0.40 + Q×0.25"
                          inputs={[
                            { label: "Utilization", value: s.utilization, weight: 0.35, color: "#4caf50" },
                            { label: "Detection", value: s.detection, weight: 0.40, color: "#2196f3" },
                            { label: "Quality", value: s.quality, weight: 0.25, color: "#ff9800" },
                          ]}
                          source="composite scorer"
                        >
                          <div className="text-xs text-on-surface-variant">
                            Persistent breakdown view: hover score chip for full formula detail.
                          </div>
                        </ScoreBreakdownTooltip>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center gap-3">
              <button
                className="px-3 py-1 rounded-lg text-xs bg-surface-container-high text-on-surface disabled:opacity-40 hover:bg-outline-variant/20"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ← Prev
              </button>
              <span className="text-xs text-on-surface-variant">
                Page {page + 1} of {totalPages}
              </span>
              <button
                className="px-3 py-1 rounded-lg text-xs bg-surface-container-high text-on-surface disabled:opacity-40 hover:bg-outline-variant/20"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export const FullScoringTable = React.memo(FullScoringTableBase);
