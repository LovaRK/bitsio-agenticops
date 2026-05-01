"use client";
export function ExecutiveAgentBrief({primaryDecision,businessImpact,riskLevel,nextAction}:{primaryDecision:string;businessImpact:string;riskLevel:string;nextAction:string}){
  const cards = [
    { k: 'Primary Decision', v: primaryDecision, why: 'Summarizes the current optimal action path.', tone: 'border-blue-400/35' },
    { k: 'Business Impact', v: businessImpact, why: 'Translates telemetry decisions into business outcome.', tone: 'border-emerald-400/35' },
    { k: 'Detection / Compliance Risk', v: riskLevel, why: 'Indicates risk exposure if optimization is applied.', tone: 'border-amber-400/35' },
    { k: 'Recommended Next Action', v: nextAction, why: 'Action selected by the agent based on evidence.', tone: 'border-purple-400/35' },
  ];
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <button key={card.k} className={`rounded-xl border ${card.tone} bg-white/[0.06] p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.09]`}>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">{card.k}</p>
          <p className="mt-2 text-lg font-bold leading-snug text-white">{card.v}</p>
          <p className="mt-2 text-xs text-white/65">{card.why}</p>
          <span className="mt-3 inline-flex rounded-full border border-white/20 px-2 py-0.5 text-[11px] text-white/80">Confidence 92%</span>
        </button>
      ))}
    </section>
  );
}
