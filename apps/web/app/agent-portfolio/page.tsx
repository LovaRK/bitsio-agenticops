"use client";

import { useMemo, useState } from "react";
import { getAgentPortfolioData } from "@/lib/services/agentPortfolio";

function bandClass(band: string): string {
  if (band === "green" || band === "go") return "bg-secondary/15 text-secondary border-secondary/30";
  if (band === "amber" || band === "conditional-go") return "bg-tertiary/15 text-tertiary border-tertiary/30";
  return "bg-error/15 text-error border-error/30";
}

function timelineDot(status: string): string {
  if (status === "success") return "bg-secondary";
  if (status === "running") return "bg-primary animate-pulse";
  if (status === "blocked") return "bg-tertiary";
  return "bg-error";
}

export default function AgentPortfolioPage() {
  const { customerHealth, recovery, migration } = useMemo(() => getAgentPortfolioData(), []);
  const [tab, setTab] = useState<"ch" | "rec" | "mig">("ch");
  const customerKeys = Object.keys(customerHealth);
  const [selectedAccount, setSelectedAccount] = useState<string>(customerKeys[0] ?? "");

  const ch = customerHealth[selectedAccount];
  const rec = recovery.replica_lag;
  const mig = migration;

  return (
    <main className="pt-6 pb-12 px-8" data-testid="agent-portfolio-page">
      <section className="mb-6">
        <h1 className="text-3xl font-black font-headline tracking-tight text-on-surface">Agent Portfolio</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Wave 4-6 expansion: Customer Health, Recovery Orchestrator, and Migration Assurance agents.
        </p>
      </section>

      <section className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Agent portfolio tabs">
        <button
          role="tab"
          aria-selected={tab === "ch"}
          onClick={() => setTab("ch")}
          className={`rounded-lg border px-4 py-2 text-sm font-bold ${tab === "ch" ? "bg-primary/15 text-on-surface border-primary/40" : "bg-surface-container text-on-surface-variant border-outline-variant/30"}`}
        >
          Customer Health
        </button>
        <button
          role="tab"
          aria-selected={tab === "rec"}
          onClick={() => setTab("rec")}
          className={`rounded-lg border px-4 py-2 text-sm font-bold ${tab === "rec" ? "bg-primary/15 text-on-surface border-primary/40" : "bg-surface-container text-on-surface-variant border-outline-variant/30"}`}
        >
          Recovery Orchestrator
        </button>
        <button
          role="tab"
          aria-selected={tab === "mig"}
          onClick={() => setTab("mig")}
          className={`rounded-lg border px-4 py-2 text-sm font-bold ${tab === "mig" ? "bg-primary/15 text-on-surface border-primary/40" : "bg-surface-container text-on-surface-variant border-outline-variant/30"}`}
        >
          Migration Assurance
        </button>
      </section>

      {tab === "ch" && ch && (
        <section className="space-y-4" data-testid="ch-tab">
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-4 text-sm text-on-surface-variant">
            Top-20 enterprise churn prevention view with explainable health scoring and approval-gated plays.
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {customerKeys.map((key) => {
              const acct = customerHealth[key];
              const selected = key === selectedAccount;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedAccount(key)}
                  className={`rounded-xl border p-4 text-left ${selected ? "border-primary/50 bg-surface-container-high" : "border-outline-variant/20 bg-surface-container-low"}`}
                >
                  <p className="text-sm font-bold text-on-surface">{acct.final_output.account_name}</p>
                  <p className="text-xs text-on-surface-variant mt-1">{acct.final_output.account_tier}</p>
                  <p className="mt-3 text-3xl font-black font-mono" style={{ color: "var(--secondary)" }}>
                    {Math.round(acct.final_output.composite_health * 100)}
                  </p>
                  <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${bandClass(acct.final_output.churn_risk_band)}`}>
                    {acct.final_output.churn_risk_band} · {acct.final_output.trend}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
              <h2 className="text-lg font-bold text-on-surface">Composite Health</h2>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-4xl font-black font-mono text-on-surface">{Math.round(ch.final_output.composite_health * 100)}%</span>
                <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold uppercase ${bandClass(ch.final_output.churn_risk_band)}`}>
                  {ch.final_output.churn_risk_band}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {Object.entries(ch.final_output.dimension_scores).map(([name, value]) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs text-on-surface-variant">
                      <span className="uppercase tracking-wider">{name}</span>
                      <span>{Math.round(value * 100)}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-surface-container-high">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.round(value * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-on-surface"><strong>Recommended Play:</strong> {ch.final_output.recommended_play}</p>
            </div>

            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
              <h2 className="text-lg font-bold text-on-surface">Top Signals</h2>
              <div className="mt-3 space-y-2">
                {ch.final_output.top_signals.map((signal) => (
                  <div key={signal.evidence_id} className="rounded-lg border border-outline-variant/20 bg-surface-container p-3">
                    <p className="text-sm text-on-surface">{signal.description}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {signal.source} · {signal.result_count} results · {signal.severity}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "rec" && (
        <section className="space-y-4" data-testid="rec-tab">
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-4 text-sm text-on-surface-variant">
            Guarded recovery sequencing with blast-radius scoring and mandatory approval gate.
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
              <h2 className="text-lg font-bold text-on-surface">Recovery Options</h2>
              <p className="mt-1 text-xs text-on-surface-variant font-mono">{rec.incident_id}</p>
              <div className="mt-3 space-y-3">
                {rec.candidate_options.map((opt) => (
                  <div key={opt.name} className="rounded-lg border border-outline-variant/20 bg-surface-container p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-on-surface">{opt.name}</p>
                      <p className="text-xs font-mono text-secondary">{Math.round(opt.confidence * 100)}%</p>
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">{opt.description}</p>
                    <p className="mt-2 text-[11px] text-on-surface-variant">
                      Blast: {opt.blast_radius.resources_affected} resources · {opt.blast_radius.users_affected_estimate.toLocaleString()} users · {opt.blast_radius.expected_downtime_seconds}s
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
              <h2 className="text-lg font-bold text-on-surface">Execution Timeline</h2>
              <div className="mt-3 space-y-2">
                {rec.node_runs.map((node) => (
                  <div key={node.node_name} className="flex items-start gap-2 rounded-lg border border-outline-variant/20 bg-surface-container p-3">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full ${timelineDot(node.status)}`} />
                    <div>
                      <p className="text-sm font-mono text-on-surface">{node.node_name}</p>
                      <p className="text-xs text-on-surface-variant">{node.note || node.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "mig" && (
        <section className="space-y-4" data-testid="mig-tab">
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-4 text-sm text-on-surface-variant">
            Continuous QRadar-to-Splunk parity with blocking-issue visibility and cutover readiness classification.
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-on-surface-variant">Risk Score</p>
              <p className="mt-2 text-4xl font-black font-mono text-error">{Math.round(mig.final_output.risk_score * 100)}%</p>
              <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs font-bold uppercase ${bandClass(mig.final_output.risk_band)}`}>
                {mig.final_output.risk_band}
              </span>
            </div>
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-on-surface-variant">Cutover Readiness</p>
              <p className="mt-2 text-xl font-black text-on-surface">{mig.final_output.cutover_readiness.toUpperCase()}</p>
            </div>
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-on-surface-variant">Coverage</p>
              <p className="mt-2 text-lg font-mono text-on-surface">
                {mig.final_output.coverage_summary.mapped}/{mig.final_output.coverage_summary.total}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {mig.final_output.coverage_summary.compliance_gaps} compliance gaps
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
              <h2 className="text-lg font-bold text-on-surface">Blocking Issues</h2>
              <div className="mt-3 space-y-2">
                {mig.final_output.blocking_issues.map((issue, idx) => (
                  <div key={idx} className="rounded-lg border border-error/30 bg-error/10 p-3">
                    <p className="text-xs uppercase tracking-widest text-error">{String(issue.type).replaceAll("_", " ")}</p>
                    <p className="mt-1 text-sm text-on-surface">{Object.entries(issue).slice(1, 3).map(([, val]) => String(val)).join(" · ")}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
              <h2 className="text-lg font-bold text-on-surface">Reasoning Timeline</h2>
              <div className="mt-3 space-y-2">
                {mig.node_runs.map((node) => (
                  <div key={node.node_name} className="flex items-start gap-2 rounded-lg border border-outline-variant/20 bg-surface-container p-3">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full ${timelineDot(node.status)}`} />
                    <div>
                      <p className="text-sm font-mono text-on-surface">{node.node_name}</p>
                      <p className="text-xs text-on-surface-variant">{node.note || node.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
