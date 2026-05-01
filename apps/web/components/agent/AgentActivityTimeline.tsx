"use client";
import type { AgentActivityItem } from '@/types/agent';
const stageIcon: Record<string, string> = { observe: '👁', analyze: '📊', reason: '🧠', decide: '🧭', action: '⚙', audit: '🧾', learn: '📚' };
const statusTone: Record<string, string> = { success: 'text-emerald-300', warning: 'text-amber-300', error: 'text-red-300', running: 'text-blue-300' };
export function AgentActivityTimeline({items,onOpen}:{items:AgentActivityItem[];onOpen:(id:string)=>void}){
  return <section className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
    <h3 className="text-base font-bold text-white">Agent Activity Timeline</h3>
    <p className="mt-1 text-sm text-white/65">Observe → Analyze → Reason → Decide → Action → Audit → Learn</p>
    <div className="mt-3 space-y-3">
      {items.map(i=><button key={i.id} onClick={()=>onOpen(i.id)} className="relative block w-full rounded-lg border border-white/10 bg-slate-900/50 p-3 pl-11 text-left transition hover:border-white/30">
        <span className="absolute left-3 top-3 text-lg">{stageIcon[i.stage] ?? '•'}</span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`font-semibold uppercase ${statusTone[i.status] ?? 'text-white/70'}`}>{i.status}</span>
          <span className="text-white/55">{i.stage}</span>
          <span className="text-white/55">{new Date(i.timestamp).toLocaleTimeString()}</span>
          <span className="text-white/55">{i.toolName ?? 'agent-core'}</span>
          <span className="text-white/55">{i.durationMs ?? 0}ms</span>
          <span className="text-white/55">evidence {i.evidenceCount}</span>
          <span className="text-white/55">confidence {Math.round(i.confidence * 100)}%</span>
        </div>
        <p className="mt-1 text-sm text-white">{i.message}</p>
      </button>)}
    </div>
  </section>;
}
