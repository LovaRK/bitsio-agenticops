"use client";
import { ConfidenceBadge } from './ConfidenceBadge';
import { LiveDataPill } from './LiveDataPill';
import { StatusPill } from './StatusPill';
import { WorkspaceSelector } from './WorkspaceSelector';
import { AutonomyControl } from './AutonomyControl';
import type { AgentState, AutonomyLevel, WorkspaceContext } from '@/types/agent';
export function AgentCommandHeader({state,workspaces,workspaceId,onWorkspaceChange,onTogglePause,onRunAnalysis,onOpenAudit,autonomy,onAutonomyChange}:{state:AgentState;workspaces:WorkspaceContext[];workspaceId:string;onWorkspaceChange:(id:string)=>void;onTogglePause:()=>void;onRunAnalysis:()=>void;onOpenAudit:()=>void;autonomy:AutonomyLevel;onAutonomyChange:(v:AutonomyLevel)=>void}){
  return (
    <section className="relative z-20 rounded-2xl border border-white/15 bg-gradient-to-r from-slate-950/95 via-blue-950/80 to-purple-950/70 p-6 shadow-[0_0_48px_rgba(59,130,246,0.2)] backdrop-blur md:sticky md:top-0">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr_1.2fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/60">AI-Powered Telemetry Cost Optimization Platform</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">Telemetry Optimization Agent v1.3</h1>
          <p className="mt-2 text-sm text-white/75">Current goal: Optimize telemetry cost without degrading detection coverage.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Live Agent
            </span>
            <StatusPill label={state.status} tone={state.status==='active'?'ok':state.status==='paused'?'warn':'risk'}/>
            <ConfidenceBadge value={state.confidence}/>
            <LiveDataPill live fallbackReason="fallback profile"/>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Primary Recommendation</p>
          <p className="mt-2 text-xl font-bold text-white">Improve detection coverage before cost pruning</p>
          <p className="mt-3 text-sm text-white/75">Risk is medium and requires guardrail-gated actions with approval.</p>
          <p className="mt-2 text-xs text-white/55">Last decision: {new Date(state.lastDecisionAt).toLocaleTimeString()}</p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <WorkspaceSelector workspaces={workspaces} value={workspaceId} onChange={onWorkspaceChange}/>
            <AutonomyControl value={autonomy} onChange={onAutonomyChange}/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-white hover:border-white/35" onClick={onTogglePause}>Pause Agent</button>
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500" onClick={onRunAnalysis}>Run Analysis</button>
            <button className="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-white hover:border-white/35" onClick={onOpenAudit}>Open Audit Trail</button>
            <button className="rounded-lg border border-indigo-300/25 bg-indigo-400/10 px-3 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-400/20">Formula Catalog</button>
          </div>
        </div>
      </div>
    </section>
  );
}
