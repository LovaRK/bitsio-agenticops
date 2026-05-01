"use client";
const services = [
  { name: 'Customer Login', health: 92, spend: '$42K', risk: 'Low', rec: 'Keep and monitor', tone: 'emerald' },
  { name: 'Payments', health: 74, spend: '$88K', risk: 'Medium', rec: 'Improve detection rules', tone: 'amber' },
  { name: 'Order API', health: 81, spend: '$61K', risk: 'Medium', rec: 'Reduce noisy fields', tone: 'amber' },
  { name: 'Fraud Monitoring', health: 67, spend: '$57K', risk: 'High', rec: 'Do not reduce retention', tone: 'red' },
  { name: 'Infrastructure', health: 89, spend: '$73K', risk: 'Low', rec: 'Archive low-value logs', tone: 'emerald' },
  { name: 'Security Monitoring', health: 78, spend: '$55K', risk: 'Medium', rec: 'Map missing MITRE coverage', tone: 'amber' },
];
const toneClass: Record<string, string> = { emerald: 'border-emerald-400/35', amber: 'border-amber-400/35', red: 'border-red-400/35' };
export function BusinessServiceImpactMap(){return <section className="rounded-2xl border border-white/15 bg-white/[0.04] p-5"><h3 className="text-base font-bold text-white">Business Service Impact Map</h3><p className="mt-1 text-sm text-white/65">Service health, telemetry spend, risk, and recommendation in one board.</p><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{services.map((s)=><button key={s.name} className={`rounded-xl border bg-slate-900/45 p-4 text-left ${toneClass[s.tone]}`}><p className="text-xs uppercase tracking-[0.12em] text-white/60">{s.name}</p><p className="mt-2 text-2xl font-black text-white">{s.health}<span className="text-sm font-medium text-white/70">/100</span></p><p className="mt-1 text-xs text-white/70">Spend {s.spend} · Risk {s.risk}</p><p className="mt-2 text-sm text-white">{s.rec}</p></button>)}</div></section>;}
