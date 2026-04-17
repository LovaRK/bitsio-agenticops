"use client";

type SimilarIncident = {
  incident_id: string;
  title?: string;
  severity?: string;
  timestamp?: string;
  relevance?: number;
};

type Props = {
  incidents: SimilarIncident[];
  onSelect: (incidentId: string) => void;
};

function severityDot(severity?: string): string {
  const normalized = (severity ?? "low").toLowerCase();
  if (normalized === "high" || normalized === "critical") return "bg-error";
  if (normalized === "medium") return "bg-tertiary";
  return "bg-secondary";
}

export function SimilarIncidentsList({ incidents, onSelect }: Props) {
  if (!incidents.length) {
    return (
      <div className="rounded-lg border border-outline-variant/20 bg-surface-container p-4 text-sm text-on-surface-variant">
        No similar incidents found. Try re-running enrichment with a larger lookback window.
      </div>
    );
  }

  return (
    <ul className="space-y-2" data-testid="similar-incidents-list">
      {incidents.map((item) => {
        const relevance = Math.round((item.relevance ?? 0) * 100);
        return (
          <li key={item.incident_id}>
            <button
              type="button"
              onClick={() => onSelect(item.incident_id)}
              className="w-full rounded-lg border border-outline-variant/20 bg-surface-container p-3 text-left hover:border-primary/40"
              data-testid={`similar-incident-${item.incident_id}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${severityDot(item.severity)}`} />
                  <span className="text-sm font-semibold text-on-surface">{item.title ?? item.incident_id}</span>
                </div>
                <span className="text-xs text-on-surface-variant">{item.timestamp ?? "n/a"}</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded bg-surface-container-highest">
                <div
                  className="h-1.5 rounded bg-primary"
                  style={{ width: `${Math.max(0, Math.min(100, relevance))}%` }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
