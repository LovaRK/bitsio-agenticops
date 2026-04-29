"use client";

import { useState } from "react";
import type { QuickWin } from "@/types/telemetry-executive";

interface QuickWinsTableProps {
  wins: QuickWin[];
}

function formatUsd(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

export function QuickWinsTable({ wins }: QuickWinsTableProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-5 mb-6">
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
        Top Quick Wins
      </p>
      <p className="text-xs text-on-surface-variant mb-4">
        Highest-impact single actions ranked by estimated dollar savings.
      </p>
      {wins.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          No quick wins identified for current dataset.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15">
                <th className="text-left pb-2 pr-4 text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                  Rank
                </th>
                <th className="text-left pb-2 pr-4 text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                  Category
                </th>
                <th className="text-left pb-2 pr-4 text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                  Action
                </th>
                <th className="text-right pb-2 text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                  Est. Impact
                </th>
              </tr>
            </thead>
            <tbody>
              {wins.map((win) => (
                <>
                  <tr
                    key={win.rank}
                    className="border-b border-outline-variant/10 cursor-pointer hover:bg-surface-container-high transition-colors"
                    onClick={() => setExpanded(expanded === win.rank ? null : win.rank)}
                  >
                    <td className="py-3 pr-4">
                      <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-primary/20 text-primary font-black text-xs">
                        {win.rank}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-on-surface-variant">{win.category}</td>
                    <td className="py-3 pr-4 text-on-surface max-w-xs truncate">{win.action}</td>
                    <td className="py-3 text-right font-black text-error">
                      {formatUsd(win.estimated_impact_usd)}
                    </td>
                  </tr>
                  {expanded === win.rank && (
                    <tr key={`${win.rank}-expanded`} className="bg-surface-container-low">
                      <td colSpan={4} className="py-3 px-4">
                        <p className="text-xs text-on-surface-variant">
                          <span className="font-semibold text-on-surface">Sourcetype: </span>
                          {win.sourcetype}
                        </p>
                        <p className="text-xs text-on-surface-variant mt-1">{win.details}</p>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
