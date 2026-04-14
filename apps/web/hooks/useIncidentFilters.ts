/**
 * useIncidentFilters hook for incident list filtering.
 * Manages search query and severity/status/source filters.
 */

import { useState, useMemo } from "react";
import type { IncidentSummary } from "@/types/api";

export function useIncidentFilters(incidents: IncidentSummary[]) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const sources = useMemo(() => {
    const all = incidents
      .map((item) => item.source?.trim())
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(all)).sort();
  }, [incidents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return incidents.filter((item) => {
      const matchesQuery =
        q.length === 0 ||
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        (item.source ?? "").toLowerCase().includes(q);
      const matchesSeverity =
        severityFilter === "all" || item.severity.toLowerCase() === severityFilter;
      const matchesStatus = statusFilter === "all" || item.status.toLowerCase() === statusFilter;
      const matchesSource =
        sourceFilter === "all" || (item.source ?? "").toLowerCase() === sourceFilter;
      return matchesQuery && matchesSeverity && matchesStatus && matchesSource;
    });
  }, [incidents, query, severityFilter, sourceFilter, statusFilter]);

  const reset = () => {
    setQuery("");
    setSeverityFilter("all");
    setStatusFilter("all");
    setSourceFilter("all");
  };

  return {
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
  };
}
