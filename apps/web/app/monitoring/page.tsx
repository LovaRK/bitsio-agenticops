import { getMonitoringOverview } from "@/lib/api";

export default async function MonitoringPage() {
  let monitoring: Awaited<ReturnType<typeof getMonitoringOverview>>;
  try {
    monitoring = await getMonitoringOverview();
  } catch {
    return (
      <section className="pt-6 pb-12 px-8" data-testid="monitoring-page">
        <div className="rounded-xl border border-error/25 bg-error/10 p-6">
          <h2 className="text-xl font-semibold text-on-surface">Live monitoring data unavailable</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Monitoring is running in live-only mode. Check API/Splunk runtime connection from Settings,
            then refresh this page.
          </p>
        </div>
      </section>
    );
  }
  const services = monitoring.services;
  const runtime = monitoring.agent_runtime;

  const kpis = [
    {
      label: "Global Uptime",
      value: monitoring.kpis.global_uptime,
      sub: `Splunk ${monitoring.server_info.version}`,
      icon: "cloud_done",
    },
    {
      label: "Active Nodes",
      value: String(monitoring.kpis.active_nodes),
      sub: `${monitoring.indexes.length} indexes visible`,
      icon: "dns",
    },
    {
      label: "Avg Latency",
      value: `${monitoring.kpis.avg_latency_ms}ms`,
      sub: "Across core services",
      icon: "speed",
    },
    {
      label: "System Load",
      value: `${monitoring.kpis.system_load_percent}%`,
      sub: `Build ${monitoring.server_info.build}`,
      icon: "query_stats",
    },
  ];

  return (
    <section className="pt-6 pb-12 px-8" data-testid="monitoring-page">
      <div className="mb-10">
        <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
          System Monitoring
        </h2>
        <p className="text-on-surface-variant text-sm">
          Live service telemetry using the current API and Splunk adapter connection.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="card-lift bg-surface-container-low border border-outline-variant/10 p-5 rounded-xl"
            title={`${kpi.label}: ${kpi.sub}`}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="material-symbols-outlined text-primary text-xl">{kpi.icon}</span>
              <span className="text-[10px] font-black text-outline uppercase tracking-widest">
                {kpi.label}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-on-surface">{kpi.value}</span>
              <span className="text-[10px] text-secondary font-medium">{kpi.sub}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/15">
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant/10 flex justify-between items-center">
          <h3 className="font-headline font-bold text-on-surface text-sm">Services Health Matrix</h3>
          <div className="text-xs text-on-surface-variant">
            mode: <span className="font-mono">{monitoring.server_info.mode}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest border-b border-outline-variant/10">
                  Service Name
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest border-b border-outline-variant/10">
                  Status
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest border-b border-outline-variant/10">
                  Latency
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest border-b border-outline-variant/10">
                  Load
                </th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest border-b border-outline-variant/10 text-right">
                  Uptime
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {services.map((service) => (
                <tr key={service.name} className="hover:bg-surface-container/20 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-on-surface">{service.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          service.status === "Healthy"
                            ? "bg-secondary status-glow-success"
                            : "bg-tertiary status-glow-warning"
                        }`}
                      />
                      <span
                        className={`text-xs font-bold ${
                          service.status === "Healthy" ? "text-secondary" : "text-tertiary"
                        }`}
                      >
                        {service.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">
                    {service.latency_ms}ms
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 w-32">
                      <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            service.load_percent > 80 ? "bg-error" : "bg-primary"
                          }`}
                          style={{ width: `${service.load_percent}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-outline">
                        {service.load_percent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-on-surface-variant">
                    {service.uptime}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
          <h3 className="text-lg font-semibold text-on-surface font-headline">How This Is Calculated</h3>
          <div className="mt-4 space-y-3">
            {monitoring.kpi_explanations.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-outline-variant/15 bg-surface-container p-3"
                title={`Formula: ${item.formula}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-on-surface">{item.label}</p>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                      item.source === "reported"
                        ? "border-secondary/40 text-secondary"
                        : item.source === "derived"
                          ? "border-tertiary/40 text-tertiary"
                          : "border-outline-variant/40 text-on-surface-variant"
                    }`}
                  >
                    {item.source === "reported"
                      ? "Measured"
                      : item.source === "derived"
                        ? "Estimated"
                        : "N/A"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">{item.formula}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5">
          <h3 className="text-lg font-semibold text-on-surface font-headline">Agent Runtime Health</h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            Window: last {runtime.window_minutes} minutes | Runtime: {runtime.runtime_mode} | Splunk:{" "}
            {runtime.splunk_mode}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-outline-variant/15 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Model</p>
              <p className="mt-1 text-xs font-mono text-on-surface">
                {runtime.model_provider}:{runtime.model_name}
              </p>
            </div>
            <div className="rounded-lg border border-outline-variant/15 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">LLM Calls</p>
              <p className="mt-1 text-sm font-semibold text-on-surface">{runtime.llm_calls}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/15 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                Retrieval / Policy
              </p>
              <p className="mt-1 text-sm font-semibold text-on-surface">
                {runtime.retrieval_calls} / {runtime.policy_calls}
              </p>
            </div>
            <div className="rounded-lg border border-outline-variant/15 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Avg Latency (LLM)</p>
              <p className="mt-1 text-sm font-semibold text-on-surface">{runtime.avg_llm_latency_ms}ms</p>
            </div>
            <div className="rounded-lg border border-outline-variant/15 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Total Tokens</p>
              <p className="mt-1 text-sm font-semibold text-on-surface">{runtime.total_tokens}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/15 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Estimated Cost</p>
              <p className="mt-1 text-sm font-semibold text-on-surface">${runtime.estimated_cost_usd.toFixed(4)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-on-surface-variant">
            Token source: {runtime.token_source} | Cost source: {runtime.cost_source}
          </p>
        </section>
      </div>
    </section>
  );
}
