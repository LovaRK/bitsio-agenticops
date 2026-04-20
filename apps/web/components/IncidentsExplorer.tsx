"use client";

import Link from "next/link";

import type { IncidentSummary } from "@/types/api";
import { formatDateTimeUTC } from "@/lib/datetime";
import { getSeverityStyle } from "@/lib/severity";
import { useIncidentFilters } from "@/hooks/useIncidentFilters";
import { TOOLTIP } from "@/lib/uiTooltips";

export function IncidentsExplorer({ incidents }: { incidents: IncidentSummary[] }) {
  const {
    query,
    setQuery,
    showFilters,
    setShowFilters,
    severityFilter,
    setSeverityFilter,
    statusFilter,
    setStatusFilter,
    sourceFilter,
    setSourceFilter,
    sources,
    filtered,
    reset,
  } = useIncidentFilters(incidents);

  return (
    <>
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div>
          <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
            Incident Explorer
          </h2>
          <p className="text-on-surface-variant text-sm">
            Comprehensive archive and real-time feed of all system interventions.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search incidents..."
              data-testid="incidents-search"
              className="bg-surface-container border border-outline-variant/20 rounded-lg px-4 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50 w-64 transition-all"
            />
            <span className="material-symbols-outlined absolute right-3 top-2 text-on-surface-variant text-sm">
              search
            </span>
          </div>
          <button
            type="button"
            data-testid="incidents-filter-toggle"
            title={TOOLTIP.incidents.filters}
            onClick={() => setShowFilters((current) => !current)}
            className="bg-surface-container border border-outline-variant/20 px-4 py-2 rounded-lg text-sm font-bold text-on-surface hover:bg-surface-container-high transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">filter_list</span>
            Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div
          className="mb-6 rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 grid gap-3 md:grid-cols-4"
          data-testid="incidents-filter-panel"
        >
          <label className="text-xs text-on-surface-variant uppercase tracking-wider">
            Severity
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-container-high border border-outline-variant/30 px-2 py-2 text-sm text-on-surface"
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="text-xs text-on-surface-variant uppercase tracking-wider">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-container-high border border-outline-variant/30 px-2 py-2 text-sm text-on-surface"
            >
              <option value="all">All</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="triaging">Triaging</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <label className="text-xs text-on-surface-variant uppercase tracking-wider">
            Source
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-container-high border border-outline-variant/30 px-2 py-2 text-sm text-on-surface"
            >
              <option value="all">All</option>
              {sources.map((source) => (
                <option key={source} value={source.toLowerCase()}>
                  {source}
                </option>
              ))}
            </select>
          </label>
          <div className="flex md:items-end">
            <button
              type="button"
              onClick={reset}
              title="Clear all active filters"
              className="w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      <div className="mb-3 text-xs text-on-surface-variant" data-testid="incidents-filter-summary">
        Showing {filtered.length} of {incidents.length} incidents
      </div>

      <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/15">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant/10">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-widest">
                  Severity
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-widest">
                  Incident
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-widest">
                  Status
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-widest">
                  Timestamp
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-widest text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filtered.map((incident) => {
                const styles = getSeverityStyle(incident.severity);
                return (
                  <tr key={incident.id} className="hover:bg-surface-container/40 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${styles.dot}`} />
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${styles.badge}`}
                        >
                          {incident.severity}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                          {incident.title}
                        </span>
                        <span className="text-[10px] text-outline font-mono">ID: {incident.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs text-on-surface-variant">{incident.status}</td>
                    <td className="px-6 py-5 text-xs text-on-surface-variant font-mono">
                      {formatDateTimeUTC(incident.timestamp)}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link
                        href={`/incidents/${incident.id}`}
                        title={TOOLTIP.incidents.row}
                        className="text-primary hover:bg-primary/10 px-4 py-1.5 rounded-lg text-xs font-bold transition-all border border-primary/20 hover:border-primary/50"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
