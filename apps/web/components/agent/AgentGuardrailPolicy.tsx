"use client";
import type { AgentGuardrailRule } from '@/types/agent';
const laneStyle: Record<string, string> = {
  allowed: 'border-emerald-400/30 bg-emerald-500/5',
  approval_required: 'border-amber-400/30 bg-amber-500/5',
  risk_scored: 'border-blue-400/30 bg-blue-500/5',
  blocked: 'border-red-400/30 bg-red-500/5',
};

export function AgentGuardrailPolicy({ rules }: { rules: AgentGuardrailRule[] }) {
  const groups = {
    allowed: rules.filter((r) => r.decision === 'allowed'),
    approval_required: rules.filter((r) => r.decision === 'approval_required'),
    risk_scored: rules.filter((r) => r.decision === 'risk_scored'),
    blocked: rules.filter((r) => r.decision === 'blocked'),
  };
  return (
    <section className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
      <h2 className="text-base font-bold text-white">Agent Guardrail Policy Board</h2>
      <p className="mt-1 text-sm text-white/65">Guardrails are enforced before any action is approved or executed.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(groups).map(([lane, items]) => (
          <div key={lane} className={`rounded-xl border p-3 ${laneStyle[lane]}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.14em] text-white/70">{lane.replaceAll('_', ' ')}</p>
              <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/90">{items.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {items.length === 0 ? <p className="text-xs text-white/50">No actions.</p> : items.map((rule) => (
                <div key={rule.id} className={`rounded-md border border-white/15 px-2 py-1.5 text-xs ${lane === 'blocked' ? 'opacity-70 line-through' : 'text-white/90'}`} title={rule.reason}>
                  <p className="font-medium">{rule.actionType}</p>
                  <p className="text-[11px] text-white/60">{rule.reason}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
