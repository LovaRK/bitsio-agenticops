"use client";
const nodes=['Splunk Data','Usage Analyzer','Detection Analyzer','Quality Analyzer','Cost Model','Recommendation Engine','Guardrail Engine','Human Approval','Audit Ledger','Memory Ledger'];
export function AgentExecutionGraph({onOpen}:{onOpen:(id:string)=>void}){
  return <section className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
    <h3 className="text-base font-bold text-white">Agent Execution Graph</h3>
    <p className="mt-1 text-sm text-white/65">Data → Analysis → Decision → Guardrail → Approval → Audit</p>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {nodes.map((n, idx)=><div key={n} className="flex items-center gap-2">
        <button onClick={()=>onOpen(n)} className={`rounded-lg border px-3 py-2 text-xs font-medium ${idx===6?'border-amber-400/35 bg-amber-500/10 text-amber-100':idx<6?'border-emerald-400/30 bg-emerald-500/10 text-emerald-100':'border-blue-400/30 bg-blue-500/10 text-blue-100'} hover:border-white/45`}>{n}</button>
        {idx < nodes.length - 1 ? <span className="text-white/35">→</span> : null}
      </div>)}
    </div>
  </section>;
}
