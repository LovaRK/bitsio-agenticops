import { IncidentsExplorer } from "@/components/IncidentsExplorer";
import { type IncidentSummary, listIncidents } from "@/lib/api";

export default async function IncidentsPage() {
  let incidents: IncidentSummary[] = [];
  let error: string | null = null;

  try {
    incidents = await listIncidents();
  } catch (e) {
    console.error("Failed to fetch incidents:", e);
    error = "Unable to reach the AgenticOps API. Incidents tab is live-only; verify runtime connectivity in Settings.";
  }

  return (
    <section className="pt-4 pb-10 px-4 sm:px-6 lg:px-8 sm:pt-6 lg:pb-12" data-testid="incidents-page">
      {error && (
        <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg flex items-center gap-3 text-error text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <span className="material-symbols-outlined text-lg">report</span>
          {error}
        </div>
      )}
      <IncidentsExplorer incidents={incidents} />
    </section>
  );
}
