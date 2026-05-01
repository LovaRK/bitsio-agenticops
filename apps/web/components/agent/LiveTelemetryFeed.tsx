"use client";
import type { LiveTelemetryEvent } from '@/types/agent';
const severityTone = {
  info: 'border-blue-400/35 bg-blue-500/10 text-blue-200',
  warning: 'border-amber-400/35 bg-amber-500/10 text-amber-200',
  critical: 'border-red-400/35 bg-red-500/10 text-red-200',
} as const;
export function LiveTelemetryFeed({events,onOpen}:{events:LiveTelemetryEvent[];onOpen:(id:string)=>void}){
  return <section className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
    <h3 className="text-base font-bold text-white">Live Telemetry Feed</h3>
    <p className="mt-1 text-sm text-white/65">Newest events first with recommended agent response.</p>
    <div className="mt-3 space-y-2">
      {events.map(e=><button key={e.id} onClick={()=>onOpen(e.id)} className="block w-full rounded-lg border border-white/10 bg-slate-900/50 p-3 text-left transition hover:border-white/25">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${severityTone[e.severity]}`}>{e.severity}</span>
          <span className="text-xs text-white/55">{new Date(e.timestamp).toLocaleTimeString()}</span>
          {e.affectedSource ? <span className="text-xs text-white/70">source: {e.affectedSource}</span> : null}
          {e.metricDelta ? <span className="text-xs text-white/70">delta: {e.metricDelta}</span> : null}
        </div>
        <p className="mt-1 text-sm font-semibold text-white">{e.title}</p>
        <p className="text-xs text-white/70">{e.description}</p>
        {e.recommendedAgentResponse ? <p className="mt-1 text-xs text-indigo-200">Recommended: {e.recommendedAgentResponse}</p> : null}
      </button>)}
    </div>
  </section>;
}
