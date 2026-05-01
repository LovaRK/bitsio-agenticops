"use client";
import type { AutonomyLevel } from '@/types/agent';
export function AutonomyControl({value,onChange}:{value:AutonomyLevel;onChange:(v:AutonomyLevel)=>void}){const opts:AutonomyLevel[]=['advisory','assisted','approval_gated','autonomous'];return <select className="rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-sm text-white" value={value} onChange={(e)=>onChange(e.target.value as AutonomyLevel)}>{opts.map(o=><option key={o} value={o}>{o}</option>)}</select>;}
