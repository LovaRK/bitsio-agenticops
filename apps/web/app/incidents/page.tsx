import Link from "next/link";
import { type IncidentSummary, listIncidents } from "@/lib/api";

function getSeverityStyles(severity: string) {
  const s = severity.toLowerCase();
  if (s === "critical") {
    return { dot: "bg-error status-glow-error", text: "text-error", badge: "text-error border-error/30" };
  }
  if (s === "high") {
    return { dot: "bg-tertiary status-glow-warning", text: "text-tertiary", badge: "text-tertiary border-tertiary/30" };
  }
  return { dot: "bg-secondary status-glow-success", text: "text-secondary", badge: "text-secondary border-secondary/30" };
}

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
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
            Incident Explorer
          </h2>
          <p className="text-on-surface-variant text-sm">
            Comprehensive archive and real-time feed of all system interventions.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search incidents..." 
              className="bg-surface-container border border-outline-variant/20 rounded-lg px-4 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/50 w-64 transition-all"
            />
            <span className="material-symbols-outlined absolute right-3 top-2 text-on-surface-variant text-sm">search</span>
          </div>
          <button className="bg-surface-container border border-outline-variant/20 px-4 py-2 rounded-lg text-sm font-bold text-on-surface hover:bg-surface-container-high transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">filter_list</span>
            Filters
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/15">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant/10">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-widest">Severity</th>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-widest">Incident</th>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-widest">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-black text-outline uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {incidents.map((incident) => {
                const styles = getSeverityStyles(incident.severity);
                return (
                  <tr key={incident.id} className="hover:bg-surface-container/40 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${styles.dot}`}></div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${styles.badge}`}>
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
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-on-surface-variant">
                        <span className="text-xs font-medium">{incident.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs text-on-surface-variant font-mono">
                      {new Date(incident.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link
                        href={`/incidents/${incident.id}`}
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
    </section>
  );
}
