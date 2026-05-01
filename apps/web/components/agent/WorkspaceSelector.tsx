"use client";
import type { WorkspaceContext } from '@/types/agent';
export function WorkspaceSelector({workspaces,value,onChange}:{workspaces:WorkspaceContext[];value:string;onChange:(id:string)=>void}){return <select className="rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-sm text-white" value={value} onChange={(e)=>onChange(e.target.value)}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>;}
