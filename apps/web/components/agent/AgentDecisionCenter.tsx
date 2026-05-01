"use client";

import type { AgentDecision } from "@/types/agent";

interface AgentDecisionCenterProps {
  decision: AgentDecision;
  onExplain: () => void;
  onSimulate: () => void;
  onApprove: () => void;
  onOverride: () => void;
  onTeach: () => void;
}

export function AgentDecisionCenter({
  decision,
  onExplain,
  onSimulate,
  onApprove,
  onOverride,
  onTeach,
}: AgentDecisionCenterProps) {
  const actions: Array<{ label: string; onClick: () => void }> = [
    { label: "Explain", onClick: onExplain },
    { label: "Simulate", onClick: onSimulate },
    { label: "Approve", onClick: onApprove },
    { label: "Override", onClick: onOverride },
    { label: "Teach Agent", onClick: onTeach },
  ];

  return (
    <section className="rounded-2xl border border-blue-400/25 bg-gradient-to-br from-blue-950/40 to-slate-900/60 p-6 shadow-[0_0_30px_rgba(59,130,246,0.14)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-white">Agent Decision Center</h3>
        <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/85">Guardrail: approval required</span>
      </div>
      <p className="mt-3 text-2xl font-black leading-tight text-white">{decision.headline}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/75">
        <span>Risk: {decision.risk}</span>
        <span>Confidence: {Math.round(decision.confidence * 100)}%</span>
        <span>Action: {decision.nextAction}</span>
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/85">
        {decision.reasonBullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={`rounded-lg px-3 py-2 text-sm font-medium text-white ${action.label === 'Approve' ? 'bg-blue-600 hover:bg-blue-500' : 'border border-white/20 hover:border-white/35'}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
