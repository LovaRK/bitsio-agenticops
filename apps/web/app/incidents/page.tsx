import { IncidentsExplorer } from "@/components/IncidentsExplorer";
import { type IncidentSummary, listIncidents } from "@/lib/api";

export default async function IncidentsPage() {
  let incidents: IncidentSummary[] = [];
  let error: string | null = null;

  try {
    incidents = await listIncidents();
  } catch (e) {
    console.error("Failed to fetch incidents:", e);
    error = "Unable to reach the AgenticOps API. Showing cached or mock data if available.";
  }

  return (
    <section className="pt-6 pb-12 px-8" data-testid="incidents-page">
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
