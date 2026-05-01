"use client";

import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import type { SourceProfile } from '@/types/telemetry';

const tierColor = (tier?: string) => tier === 'Critical' ? '#22c55e' : tier === 'Important' ? '#3b82f6' : tier === 'Nice-to-Have' ? '#f59e0b' : '#ef4444';

export function SplunkTelemetryIntelligenceMap({ sources, onSelect }: { sources: SourceProfile[]; onSelect: (id: string) => void }) {
  const points = sources.slice(0, 120).map((s) => ({
    name: s.sourcetype,
    x: s.utilization_score ?? 0,
    y: s.detection_score ?? 0,
    z: Math.max(5, (s.gb_per_day ?? 1) * 0.8),
    tier: s.tier ?? 'Wasteful',
  }));

  return (
    <section className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
      <h3 className="text-base font-bold text-white">Splunk Telemetry Intelligence Map</h3>
      <p className="mt-1 text-sm text-white/65">X: Utilization · Y: Detection · Bubble: GB/day · Color: Tier</p>
      <div className="mt-3 h-[380px] rounded-xl border border-white/10 bg-slate-950/50 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 12, bottom: 12, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
            <XAxis type="number" dataKey="x" domain={[0, 100]} stroke="rgba(255,255,255,0.7)" name="Utilization" />
            <YAxis type="number" dataKey="y" domain={[0, 100]} stroke="rgba(255,255,255,0.7)" name="Detection" />
            <ZAxis type="number" dataKey="z" range={[80, 550]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#020617', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }} />
            <Scatter data={points} fill="#3b82f6">
              {points.map((p) => <Cell key={`${p.name}-c`} fill={tierColor(p.tier)} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {points.slice(0, 12).map((p) => (
          <button key={`${p.name}-select`} onClick={() => onSelect(p.name)} className="rounded-full border border-white/15 px-2 py-1 text-xs text-white/85 hover:border-white/35">
            {p.name}
          </button>
        ))}
      </div>
    </section>
  );
}
