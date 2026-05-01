"use client";

import { useMemo, useState } from "react";
import { AgentButton } from "./AgentButton";

export interface OpportunityRow {
  id: string;
  action: string;
  sourcetype: string;
  tier: string;
  annualCost: number;
  expectedSavings: number;
  risk: string;
  confidence: number;
  why: string;
}

interface Props {
  rows: OpportunityRow[];
  onExplain: (id: string) => void;
  onApprove: (id: string) => void;
  onSimulate: (id: string) => void;
  onExport: (id: string) => void;
}

const PAGE_SIZE = 10;

export function OptimizationOpportunitiesTable({
  rows,
  onExplain,
  onApprove,
  onSimulate,
  onExport,
}: Props) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);

  const pageRows = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, safePage]);

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Optimization Opportunities</h3>
        <p className="text-xs text-white/60">
          Page {safePage + 1} / {pageCount}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/70">
              <th className="px-2 py-2">Action</th>
              <th className="px-2 py-2">Sourcetype</th>
              <th className="px-2 py-2">Tier</th>
              <th className="px-2 py-2">Annual Cost</th>
              <th className="px-2 py-2">Expected Savings</th>
              <th className="px-2 py-2">Risk</th>
              <th className="px-2 py-2">Why</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id} className="border-b border-white/5 align-top text-white/90">
                <td className="px-2 py-3">{row.action}</td>
                <td className="px-2 py-3">{row.sourcetype}</td>
                <td className="px-2 py-3">{row.tier}</td>
                <td className="px-2 py-3">${Math.round(row.annualCost).toLocaleString()}</td>
                <td className="px-2 py-3">${Math.round(row.expectedSavings).toLocaleString()}</td>
                <td className="px-2 py-3">{row.risk}</td>
                <td className="px-2 py-3 max-w-[240px] text-white/75">{row.why}</td>
                <td className="px-2 py-3">
                  <div className="grid grid-cols-2 gap-1 min-w-[210px]">
                    <AgentButton label="Explain" variant="ghost" onClick={() => onExplain(row.id)} />
                    <AgentButton label="Simulate" variant="secondary" onClick={() => onSimulate(row.id)} />
                    <AgentButton label="Export" variant="secondary" onClick={() => onExport(row.id)} />
                    <AgentButton label="Approve" variant="primary" onClick={() => onApprove(row.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <AgentButton
          label="Prev"
          variant="secondary"
          disabled={safePage === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        />
        <AgentButton
          label="Next"
          variant="secondary"
          disabled={safePage >= pageCount - 1}
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
        />
      </div>
    </section>
  );
}
