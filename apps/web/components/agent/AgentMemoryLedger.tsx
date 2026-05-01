"use client";
import type { MemoryEntry } from '@/lib/agent/memory';
export function AgentMemoryLedger({items}:{items:MemoryEntry[]}){return <section className="rounded-xl border border-white/10 bg-white/5 p-4"><h3 className="text-sm font-semibold text-white">Agent Memory Ledger</h3><div className="mt-2 space-y-2">{items.map(i=><div key={i.id} className="rounded-lg border border-white/10 bg-slate-900/40 p-2 text-sm text-white/80"><p>{i.note}</p><p className="mt-1 text-xs text-white/60">Type {i.category} · {new Date(i.timestamp).toLocaleString()}</p></div>)}</div></section>;}
