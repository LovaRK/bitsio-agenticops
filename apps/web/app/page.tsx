import Link from "next/link";

const mockIncidents = [
  {
    id: "INC-99230-AX",
    name: "Memory Leak: VectorDB-Node-04",
    severity: "critical" as const,
    agentStatus: "Waiting for Approval",
    timeDetected: "14:22:09 (2m ago)",
    owner: { initials: "JD", name: "John Doe" },
    action: "Review"
  },
  {
    id: "INC-99231-BF",
    name: "Anomalous API Latency: Stripe-Auth",
    severity: "high" as const,
    agentStatus: "Agent Running...",
    timeDetected: "14:15:44 (9m ago)",
    owner: { initials: "SA", name: "Sarah A." },
    action: "Trace"
  },
  {
    id: "INC-99234-ZY",
    name: "Stale Cache: Product-Catalog-S3",
    severity: "low" as const,
    agentStatus: "Completed",
    timeDetected: "13:58:12 (26m ago)",
    owner: { initials: "BT", name: "AutoBot" },
    action: "Archive"
  },
  {
    id: "SEC-1102-DF",
    name: "Data Exfiltration Warning: Edge-Node-UK",
    severity: "critical" as const,
    agentStatus: "Intervention Required",
    timeDetected: "13:42:01 (42m ago)",
    owner: { initials: "SR", name: "SecOps" },
    action: "LOCK DOWN"
  }
];

function getSeverityStyles(severity: "critical" | "high" | "low") {
  if (severity === "critical") {
    return { dot: "bg-error status-glow-error", text: "text-error", badge: "text-error uppercase" };
  }
  if (severity === "high") {
    return { dot: "bg-tertiary status-glow-warning", text: "text-tertiary", badge: "text-tertiary uppercase" };
  }
  return { dot: "bg-secondary status-glow-success", text: "text-secondary", badge: "text-secondary uppercase" };
}

function getAgentStatusStyles(status: string) {
  if (status.includes("Waiting")) {
    return "flex items-center gap-2 text-tertiary";
  }
  if (status.includes("Running")) {
    return "flex items-center gap-2 text-secondary";
  }
  if (status.includes("Completed")) {
    return "flex items-center gap-2 text-on-surface-variant";
  }
  return "flex items-center gap-2 text-tertiary";
}

export default function DashboardPage() {
  const stats = [
    { label: "Active Incidents", value: "12", trend: "+2 since last hour", icon: "warning", color: "bg-error" },
    { label: "Pending Approvals", value: "08", trend: "4 Urgent Actions", icon: "pending_actions", color: "bg-tertiary" },
    { label: "Avg Resolution Time", value: "14m", trend: "-3m improvement", icon: "timer", color: "bg-secondary" }
  ];

  return (
    <section className="pt-6 pb-12 px-8" data-testid="dashboard-page">
      {/* Summary Header */}
      <div className="mb-10">
        <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
          Incident Dashboard
        </h2>
        <p className="text-on-surface-variant text-sm">
          Real-time surveillance of autonomous agent operations and system health.
        </p>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-container border border-outline-variant/10 p-6 rounded-xl relative overflow-hidden group"
          >
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
              <span className="material-symbols-outlined text-8xl">{stat.icon}</span>
            </div>
            <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">
              {stat.label}
            </p>
            <div className="flex items-baseline gap-3">
              <h3 className="text-4xl font-headline font-black" style={{ color: `var(--color-${stat.color})` }}>
                {stat.value}
              </h3>
              <span className="text-xs opacity-60 font-medium">{stat.trend}</span>
            </div>
            <div className="mt-4 w-full bg-surface-container-lowest h-1 rounded-full overflow-hidden">
              <div className={`${stat.color} h-full w-2/3`}></div>
            </div>
          </div>
        ))}
      </div>

      {/* High-Density Incident Table */}
      <div
        className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/15"
        data-testid="incident-stream"
      >
        <div className="px-6 py-4 bg-surface-container border-b border-outline-variant/15 flex justify-between items-center">
          <h3 className="font-headline font-bold text-on-surface">Active Incident Stream</h3>
          <div className="flex gap-2">
            <button className="text-xs font-bold px-3 py-1 bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface transition-colors">
              Export Logs
            </button>
            <button className="text-xs font-bold px-3 py-1 bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface transition-colors">
              Filters
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant/10">
              <tr>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest">
                  Severity
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest">
                  Incident Name
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest">
                  Agent Status
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest">
                  Time Detected
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest">
                  Owner
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {mockIncidents.map((incident) => {
                const severityStyle = getSeverityStyles(incident.severity);
                const agentStatusStyle = getAgentStatusStyles(incident.agentStatus);
                const isErrorAction = incident.action === "LOCK DOWN";

                return (
                  <tr key={incident.id} className="hover:bg-surface-container/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${severityStyle.dot}`}></div>
                        <span className={`text-xs font-bold ${severityStyle.badge}`}>
                          {incident.severity}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-on-surface">
                          {incident.name}
                        </span>
                        <span className="text-[10px] text-outline font-mono">ID: {incident.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={agentStatusStyle}>
                        {incident.agentStatus.includes("Running") && (
                          <span className="material-symbols-outlined text-sm animate-pulse">
                            play_arrow
                          </span>
                        )}
                        {incident.agentStatus.includes("Waiting") && (
                          <span className="material-symbols-outlined text-sm">pause_circle</span>
                        )}
                        {incident.agentStatus.includes("Completed") && (
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                          </span>
                        )}
                        {incident.agentStatus.includes("Intervention") && (
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                            report
                          </span>
                        )}
                        <span className="text-xs font-medium">{incident.agentStatus}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant font-mono">
                      {incident.timeDetected}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface">
                          {incident.owner.initials}
                        </div>
                        <span className="text-xs text-on-surface">{incident.owner.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isErrorAction ? (
                        <button className="text-error bg-error/10 hover:bg-error/20 px-3 py-1 rounded text-xs font-bold transition-all">
                          {incident.action}
                        </button>
                      ) : (
                        <Link
                          href={`/incidents/${incident.id.split("-")[1]}`}
                          className="text-primary hover:bg-primary/10 px-3 py-1 rounded text-xs font-bold transition-all"
                        >
                          {incident.action}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Action Dock */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-surface-variant/60 backdrop-blur-xl border border-outline-variant/30 px-6 py-3 rounded-full flex items-center gap-8 shadow-2xl z-50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-on-surface uppercase tracking-wider">System Pulse</span>
          <div className="flex gap-1">
            <div className="w-1 h-3 bg-secondary rounded-full"></div>
            <div className="w-1 h-5 bg-secondary rounded-full"></div>
            <div className="w-1 h-4 bg-secondary rounded-full"></div>
            <div className="w-1 h-6 bg-secondary rounded-full"></div>
          </div>
        </div>
        <div className="h-6 w-px bg-outline-variant/30"></div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 text-xs font-bold text-on-tertiary-fixed hover:text-tertiary transition-colors">
            <span className="material-symbols-outlined text-sm">bolt</span>
            Quick Resolve (4)
          </button>
          <button className="flex items-center gap-2 text-xs font-bold text-primary hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-sm">history</span>
            Recent Activity
          </button>
        </div>
      </div>
    </section>
  );
}
