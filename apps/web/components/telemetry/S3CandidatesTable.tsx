"use client";

import { useState } from "react";
import type { S3Candidate, TierName } from "@/types/telemetry-executive";

const TIER_COLORS: Record<TierName, string> = {
  Critical: "#4caf50",
  Important: "#2196f3",
  "Nice-to-Have": "#ff9800",
  Wasteful: "#f44336",
};

const PAGE_SIZE = 10;

interface S3CandidatesTableProps {
  candidates: S3Candidate[];
}

type SortKey = keyof S3Candidate;

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export function S3CandidatesTable({ candidates }: S3CandidatesTableProps) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("annual_cost_usd");
  const [sortAsc, setSortAsc] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const sorted = [...candidates].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    return sortAsc
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function SortHeader({
    col,
    label,
  }: {
    col: SortKey;
    label: string;
  }) {
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
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
        S3 / Cold Storage Candidates
      </p>
      <p className="text-xs text-on-surface-variant mb-4">
        Nice-to-Have and Wasteful sourcetypes eligible for S3 archival or removal. Hover a row for
        score breakdown.
      </p>
      {candidates.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No S3 candidates identified.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/15">
                  <SortHeader col="sourcetype" label="Sourcetype" />
                  <SortHeader col="tier" label="Tier" />
                  <SortHeader col="composite" label="Score" />
                  <SortHeader col="gb_per_day" label="GB/Day" />
                  <SortHeader col="annual_cost_usd" label="License/Year" />
                  <SortHeader col="utilization" label="Util" />
                  <SortHeader col="detection" label="Det" />
                  <th className="text-left pb-2 text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c) => (
                  <tr
                    key={c.sourcetype}
                    className="border-b border-outline-variant/10 transition-colors hover:bg-surface-container-high"
                    onMouseEnter={() => setHoveredRow(c.sourcetype)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="py-2.5 pr-3 font-mono text-xs text-on-surface">
                      {c.sourcetype}
                      {hoveredRow === c.sourcetype && (
                        <div className="text-[10px] text-on-surface-variant mt-0.5">
                          U:{c.utilization.toFixed(0)} D:{c.detection.toFixed(0)} C:{c.composite}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          background: `${TIER_COLORS[c.tier]}22`,
                          color: TIER_COLORS[c.tier],
                          border: `1px solid ${TIER_COLORS[c.tier]}44`,
                        }}
                      >
                        {c.tier}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-on-surface">{c.composite}</td>
                    <td className="py-2.5 pr-3 text-on-surface">{c.gb_per_day.toFixed(2)}</td>
                    <td className="py-2.5 pr-3 font-bold text-error">{fmtUsd(c.annual_cost_usd)}</td>
                    <td className="py-2.5 pr-3 text-on-surface-variant">{c.utilization.toFixed(0)}</td>
                    <td className="py-2.5 pr-3 text-on-surface-variant">{c.detection.toFixed(0)}</td>
                    <td className="py-2.5 text-xs text-on-surface-variant max-w-[200px]">
                      {c.recommended_action}
                    </td>
                  </tr>
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
                {page + 1} / {totalPages}
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
