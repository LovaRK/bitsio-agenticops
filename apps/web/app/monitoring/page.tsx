export default function MonitoringPage() {
  const systems = [
    { name: "Core API Gateway", status: "Healthy", uptime: "99.99%", latency: "24ms", load: 12 },
    { name: "Vector Database Cluster", status: "Degraded", uptime: "98.45%", latency: "142ms", load: 84 },
    { name: "Agent Reasoning Engine", status: "Healthy", uptime: "100%", latency: "850ms", load: 45 },
    { name: "Auth Service (Stripe/Clerk)", status: "Healthy", uptime: "99.95%", latency: "12ms", load: 8 },
    { name: "Stream Processing (Kafka)", status: "Healthy", uptime: "99.98%", latency: "5ms", load: 22 }
  ];

  return (
    <section className="pt-6 pb-12 px-8" data-testid="monitoring-page">
      <div className="mb-10">
        <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
          System Monitoring
        </h2>
        <p className="text-on-surface-variant text-sm">
          Live telemetry and health status of all autonomous infra components.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { label: "Global Uptime", value: "99.98%", sub: "Last 30 days", icon: "cloud_done" },
          { label: "Active Nodes", value: "142", sub: "1 degraded node", icon: "dns" },
          { label: "Avg Latency", value: "42ms", sub: "-4ms vs last hour", icon: "speed" },
          { label: "System Load", value: "24%", sub: "Optimal range", icon: "query_stats" }
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface-container-low border border-outline-variant/10 p-5 rounded-xl">
             <div className="flex justify-between items-start mb-4">
                <span className="material-symbols-outlined text-primary text-xl">{kpi.icon}</span>
                <span className="text-[10px] font-black text-outline uppercase tracking-widest">{kpi.label}</span>
             </div>
             <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-on-surface">{kpi.value}</span>
                <span className="text-[10px] text-secondary font-medium">{kpi.sub}</span>
             </div>
          </div>
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/15">
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant/10 flex justify-between items-center">
          <h3 className="font-headline font-bold text-on-surface text-sm">Services Health Matrix</h3>
          <div className="flex items-center gap-2">
             <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-secondary"></div>
                <span className="text-[10px] text-outline font-bold">Healthy</span>
             </div>
             <div className="flex items-center gap-1 ml-3">
                <div className="w-2 h-2 rounded-full bg-tertiary"></div>
                <span className="text-[10px] text-outline font-bold">Degraded</span>
             </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest border-b border-outline-variant/10">Service Name</th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest border-b border-outline-variant/10">Status</th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest border-b border-outline-variant/10">Latency</th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest border-b border-outline-variant/10">Load</th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest border-b border-outline-variant/10 text-right">Uptime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {systems.map((s) => (
                <tr key={s.name} className="hover:bg-surface-container/20 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-on-surface">{s.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <span className={`w-2 h-2 rounded-full ${s.status === 'Healthy' ? 'bg-secondary status-glow-success' : 'bg-tertiary status-glow-warning'}`}></span>
                       <span className={`text-xs font-bold ${s.status === 'Healthy' ? 'text-secondary' : 'text-tertiary'}`}>{s.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">{s.latency}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 w-32">
                       <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div className={`h-full ${s.load > 80 ? 'bg-error' : 'bg-primary'}`} style={{ width: `${s.load}%` }}></div>
                       </div>
                       <span className="text-[10px] font-mono text-outline">{s.load}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-on-surface-variant">{s.uptime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
