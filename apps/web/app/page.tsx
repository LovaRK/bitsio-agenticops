import Link from "next/link";

import { ActionDock } from "@/components/ActionDock";
import { getDashboardSummary, getSettingsSnapshot } from "@/lib/api";
import { formatDateTimeUTC } from "@/lib/datetime";
import { getTelemetryMetrics } from "@/lib/services/waste";

function formatCompactUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function getSeverityStyles(severity: string) {
  const normalized = severity.toLowerCase();
  if (normalized === "high" || normalized === "critical") {
    return { dot: "bg-error status-glow-error", badge: "text-error border-error/30" };
  }
  if (normalized === "medium") {
    return { dot: "bg-tertiary status-glow-warning", badge: "text-tertiary border-tertiary/30" };
  }
  return { dot: "bg-secondary status-glow-success", badge: "text-secondary border-secondary/30" };
}

export default async function DashboardPage() {
  let summary: Awaited<ReturnType<typeof getDashboardSummary>>;
  let settings: Awaited<ReturnType<typeof getSettingsSnapshot>>;
  let telemetryMetrics: Awaited<ReturnType<typeof getTelemetryMetrics>>;

  try {
    [summary, settings, telemetryMetrics] = await Promise.all([
      getDashboardSummary(),
      getSettingsSnapshot(),
      getTelemetryMetrics(),
    ]);
  } catch {
    return (
      <section className="pt-6 pb-12 px-8" data-testid="dashboard-page">
        <div className="rounded-xl border border-error/25 bg-error/10 p-6">
          <h2 className="text-xl font-semibold text-on-surface">Live dashboard data unavailable</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Dashboard now runs in live-only mode for core tabs. Open Settings and verify API + Splunk
            connectivity, then refresh this page.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Link
              href="/settings"
              className="rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-on-primary-container"
            >
              Open Settings
            </Link>
            <Link
              href="/monitoring"
              className="rounded-lg border border-outline-variant/35 px-3 py-2 text-xs font-bold text-on-surface"
            >
              Open Monitoring
            </Link>
          </div>
        </div>
      </section>
    );
  }
  const recent = summary.items.slice(0, 8);
  const lastUpdated = formatDateTimeUTC(summary.stats.last_updated);

  const stats = [
    {
      label: "Active Incidents",
      value: String(summary.stats.active_incidents),
      sub: `${summary.stats.source_indexes.length} source indexes`,
      icon: "warning",
      color: "bg-error",
    },
    {
      label: "Pending Approvals",
      value: String(summary.stats.pending_approvals),
      sub: "Human review required",
      icon: "pending_actions",
      color: "bg-tertiary",
    },
    {
      label: "Avg Confidence",
      value: `${Math.round(summary.stats.avg_confidence * 100)}%`,
      sub: `Updated ${lastUpdated}`,
      icon: "monitoring",
      color: "bg-secondary",
    },
  ];

  return (
    <section className="pt-6 pb-12 px-8" data-testid="dashboard-page">
      <div className="mb-10">
        <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
          Incident Dashboard
        </h2>
        <p className="text-on-surface-variant text-sm">
          Live view from Splunk incidents, approval queues, and graph outcomes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="card-lift bg-surface-container border border-outline-variant/10 p-6 rounded-xl"
            title={
              stat.label === "Active Incidents"
                ? "Live incidents correlated from Splunk telemetry"
                : stat.label === "Pending Approvals"
                  ? "Human-in-the-loop decisions waiting for approval"
                  : "Average confidence from current agent decision traces"
            }
          >
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-bold text-outline uppercase tracking-widest">{stat.label}</p>
              <span className="material-symbols-outlined text-on-surface-variant text-lg">{stat.icon}</span>
            </div>
            <p className="text-4xl font-headline font-black text-on-surface">{stat.value}</p>
            <p className="text-xs text-on-surface-variant mt-2">{stat.sub}</p>
            <div className="mt-4 w-full bg-surface-container-lowest h-1 rounded-full overflow-hidden">
              <div className={`${stat.color} h-full w-2/3`} />
            </div>
          </article>
        ))}
      </div>

      <div className="mb-8 rounded-xl border border-outline-variant/15 bg-surface-container-low px-5 py-4 flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-outline font-bold">Model Runtime</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface">
          <span className="material-symbols-outlined text-sm">
            {settings.model.runtime === "local" ? "memory" : "cloud"}
          </span>
          {settings.model.runtime}
        </span>
        <span className="inline-flex items-center rounded-full border border-outline-variant/30 bg-surface-container-high px-3 py-1 text-xs font-mono text-on-surface">
          {settings.model.provider}:{settings.model.name}
        </span>
      </div>

      {/* Telemetry Value Metrics Section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-headline font-semibold text-on-surface mb-1">
              Telemetry Value Metrics
            </h3>
            <p className="text-xs text-on-surface-variant">
              Data utilization, cost analysis, and optimization opportunities
            </p>
          </div>
          <Link
            href="/waste"
            className="text-primary hover:bg-primary/10 px-3 py-1 rounded text-xs font-bold transition-all"
          >
            View Full Analysis
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <article className="rounded-xl border border-outline-variant/10 bg-surface-container p-4">
            <p className="sr-only">Live telemetry spend and value metrics.</p>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Total Annual Spend</p>
            <p className="mt-2 text-2xl font-black text-on-surface">
              {formatCompactUsd(telemetryMetrics.summary.total_annual_spend_usd)}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">across all sources</p>
          </article>

          <article className="rounded-xl border border-error/30 bg-error-container/10 p-4">
            <p className="sr-only">Potential savings from telemetry optimization recommendations.</p>
            <p className="text-[10px] uppercase tracking-widest text-error font-bold">Potential Savings</p>
            <p className="mt-2 text-2xl font-black text-error">
              {formatCompactUsd(telemetryMetrics.summary.total_potential_savings_usd)}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">with optimization</p>
          </article>

          <article className="rounded-xl border border-outline-variant/10 bg-surface-container p-4">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Avg Utilization</p>
            <p className="mt-2 text-2xl font-black text-tertiary">{telemetryMetrics.summary.avg_utilization_score}%</p>
            <p className="mt-1 text-xs text-on-surface-variant">across sources</p>
          </article>

          <article className="rounded-xl border border-outline-variant/10 bg-surface-container p-4">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Security Gaps</p>
            <p className="mt-2 text-2xl font-black text-on-surface">{telemetryMetrics.summary.security_gap_count}</p>
            <p className="mt-1 text-xs text-on-surface-variant">found & ranked</p>
          </article>
        </div>
      </div>

      <div
        className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/15"
        data-testid="incident-stream"
      >
        <div className="px-6 py-4 bg-surface-container border-b border-outline-variant/15 flex justify-between items-center">
          <h3 className="font-headline font-bold text-on-surface">Active Incident Stream</h3>
          <Link
            href="/incidents"
            className="text-xs font-bold px-3 py-1 bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Open Explorer
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b border-outline-variant/10">
              <tr>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest">
                  Severity
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest">
                  Incident
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest">
                  Status
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {recent.map((incident) => {
                const styles = getSeverityStyles(incident.severity);
                return (
                  <tr key={incident.id} className="hover:bg-surface-container/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${styles.badge}`}
                        >
                          {incident.severity}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-on-surface">{incident.title}</div>
                      <div className="text-[10px] text-outline font-mono">{incident.id}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant">{incident.status}</td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant font-mono">
                      {formatDateTimeUTC(incident.timestamp)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/incidents/${incident.id}`}
                        className="text-primary hover:bg-primary/10 px-3 py-1 rounded text-xs font-bold transition-all"
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

      <ActionDock />
    </section>
  );
}
