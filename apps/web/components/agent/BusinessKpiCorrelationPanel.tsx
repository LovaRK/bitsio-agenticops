"use client";
const rows = [
  ['Payments', 'app:payments', 'Fraud alerts', '0.82', 'High', 'Do not reduce retention'],
  ['Customer Login', 'okta:auth', 'Login failures', '0.76', 'Medium', 'Keep active monitoring'],
  ['Order API', 'nginx:access', 'API latency', '0.68', 'Medium', 'Filter unused fields'],
  ['Fraud Monitoring', 'suricata:alert', 'Incident count', '0.84', 'High', 'Improve detection mapping'],
];
export function BusinessKpiCorrelationPanel(){return <section className="rounded-2xl border border-white/15 bg-white/[0.04] p-5"><h3 className="text-base font-bold text-white">Business KPI Correlation</h3><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-[0.12em] text-white/55"><tr><th className="pb-2">Service</th><th className="pb-2">Source</th><th className="pb-2">KPI</th><th className="pb-2">Correlation</th><th className="pb-2">Risk</th><th className="pb-2">Recommendation</th></tr></thead><tbody>{rows.map((r)=><tr key={r.join('-')} className="border-t border-white/10 text-white/85"><td className="py-2">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td><td>{r[5]}</td></tr>)}</tbody></table></div></section>;}
