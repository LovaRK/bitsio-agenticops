"use client";

import { useMemo, useState } from "react";

import {
  buildPlanSteps,
  fraudDecisionTrace,
  fraudInitialSignals,
  fraudPrompts,
  mcpPayloadExample,
  type FraudSignal,
} from "@/lib/mocks/fraud-risk";

type TabKey = "backstory" | "live" | "trace" | "mcp" | "plan" | "prompts";

function fmtUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function FraudRiskDemo() {
  const [activeTab, setActiveTab] = useState<TabKey>("backstory");
  const [signals, setSignals] = useState<FraudSignal[]>(fraudInitialSignals);
  const [approved, setApproved] = useState(false);

  const headline = useMemo(() => {
    const top = signals[0];
    return top ? `${top.id} • ${top.entity} • risk ${top.score}` : "No active fraud cases";
  }, [signals]);

  const liveMetrics = useMemo(() => {
    const open = signals.filter((s) => s.status === "open").length;
    const avgRisk = signals.length > 0 ? Math.round(signals.reduce((a, b) => a + b.score, 0) / signals.length) : 0;
    const estAtRiskUsd = signals.reduce((sum, s) => sum + s.score * 1800, 0);
    return { open, avgRisk, estAtRiskUsd };
  }, [signals]);

  const addSimulatedAlert = () => {
    const next: FraudSignal = {
      id: `fr_${Date.now()}`,
      ts: new Date().toISOString(),
      entity: "vendor:new-shell-partner",
      signal: "Cross-border payment spike + dormant account approval",
      score: 95,
      status: "open",
    };
    setSignals((prev) => [next, ...prev]);
    setApproved(false);
    setActiveTab("live");
  };

  return (
    <section className="pt-6 pb-12 px-8 space-y-6" data-testid="fraud-risk-page">
      <header className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-headline font-black text-on-surface">Fraud Risk Agent</h2>
            <p className="text-sm text-on-surface-variant mt-1">AgenticOps | CFO / Audit / Risk | MCP to Splunk</p>
          </div>
          <button
            type="button"
            onClick={addSimulatedAlert}
            className="rounded-lg bg-error px-4 py-2 text-sm font-bold text-on-error hover:opacity-90"
          >
            Simulate Alert
          </button>
        </div>
        <div className="mt-4 rounded-lg border border-outline-variant/15 bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
          LIVE HEADLINE: <span className="font-semibold text-on-surface">{headline}</span>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          ["backstory", "Backstory"],
          ["live", "Live Dashboard"],
          ["trace", "Decision Trace"],
          ["mcp", "MCP to Splunk"],
          ["plan", "Build Plan"],
          ["prompts", "Agent Prompts"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as TabKey)}
            className={`rounded-lg border px-4 py-2 text-sm font-bold ${
              activeTab === key
                ? "border-primary bg-primary/15 text-on-surface"
                : "border-outline-variant/25 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "backstory" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-5">
            <h3 className="text-xl font-headline font-bold text-on-surface">Why we built this</h3>
            <p className="text-sm text-on-surface-variant mt-2 leading-6">
              Internal audit teams received 40k+ anomalies quarterly, but triage lag stayed near 3 days. A {fmtUsd(340000)} insider-fraud
              pattern remained in logs for 11 days before correlation was done manually.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <article className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
              <h4 className="font-bold text-on-surface">What this agent does</h4>
              <p className="text-sm text-on-surface-variant mt-2">
                Correlates payment anomalies, identity deviations, approval chain irregularities, and vendor onboarding signals into a single
                risk score with decision trace.
              </p>
            </article>
            <article className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
              <h4 className="font-bold text-on-surface">Why not SIEM rules only</h4>
              <p className="text-sm text-on-surface-variant mt-2">
                Rule engines evaluate isolated events. This agent keeps case memory across domains and stores an immutable, regulator-friendly
                reasoning timeline.
              </p>
            </article>
          </div>
        </div>
      )}

      {activeTab === "live" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <article className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
              <p className="text-xs uppercase tracking-widest text-outline">Open Cases</p>
              <p className="text-3xl font-black text-on-surface mt-2">{liveMetrics.open}</p>
            </article>
            <article className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
              <p className="text-xs uppercase tracking-widest text-outline">Average Risk</p>
              <p className="text-3xl font-black text-error mt-2">{liveMetrics.avgRisk}%</p>
            </article>
            <article className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
              <p className="text-xs uppercase tracking-widest text-outline">Estimated Exposure</p>
              <p className="text-3xl font-black text-tertiary mt-2">{fmtUsd(liveMetrics.estAtRiskUsd)}</p>
            </article>
          </div>

          <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-surface-container border-b border-outline-variant/15 text-xs uppercase tracking-widest text-outline">
                <tr>
                  <th className="px-4 py-3">Case</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Signal</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal) => (
                  <tr key={signal.id} className="border-b border-outline-variant/10 text-sm">
                    <td className="px-4 py-3 font-mono text-xs text-on-surface">{signal.id}</td>
                    <td className="px-4 py-3 text-on-surface">{signal.entity}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{signal.signal}</td>
                    <td className="px-4 py-3 text-error font-bold">{signal.score}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-outline-variant/30 px-2 py-1 text-xs text-on-surface-variant">
                        {signal.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "trace" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
            <p className="text-sm text-on-surface-variant">
              Immutable trace: each node run is hashed and persisted for SOX/PCI audit review.
            </p>
          </div>
          <div className="space-y-3">
            {fraudDecisionTrace.map((step) => (
              <article key={step.id} className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-on-surface">{step.node}</h4>
                  <span className="text-xs text-on-surface-variant">{step.latencyMs}ms</span>
                </div>
                <p className="text-sm text-on-surface-variant mt-2">{step.outcome}</p>
                <p className="text-xs text-tertiary mt-1">Confidence impact: +{step.confidenceImpact}%</p>
              </article>
            ))}
          </div>
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
            <p className="text-sm text-on-surface mb-3">CFO approval gate</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setApproved(true)}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-on-secondary"
              >
                Approve Action
              </button>
              <button
                type="button"
                onClick={() => setApproved(false)}
                className="rounded-lg bg-error px-4 py-2 text-sm font-bold text-on-error"
              >
                Reject Action
              </button>
            </div>
            <p className={`mt-3 text-sm ${approved ? "text-secondary" : "text-error"}`}>
              {approved ? "Approved: containment action queued and trace sealed." : "Pending/Rejected: no autonomous action executed."}
            </p>
          </div>
        </div>
      )}

      {activeTab === "mcp" && (
        <div className="space-y-4">
          <article className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
            <h4 className="font-semibold text-on-surface">Payload sent through MCP connector</h4>
            <pre className="mt-3 text-xs overflow-x-auto rounded-lg bg-surface-container-lowest p-3 border border-outline-variant/15 text-on-surface-variant">
{JSON.stringify(mcpPayloadExample, null, 2)}
            </pre>
          </article>
          <article className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
            <h4 className="font-semibold text-on-surface">Dashboard SPL</h4>
            <pre className="mt-3 text-xs overflow-x-auto rounded-lg bg-surface-container-lowest p-3 border border-outline-variant/15 text-on-surface-variant">
{`index="tutorial" (payment OR identity OR approval)
| eval risk_band=case(score>=90,"critical",score>=75,"high",1=1,"medium")
| stats count avg(score) as avg_risk by risk_band entity`}
            </pre>
          </article>
        </div>
      )}

      {activeTab === "plan" && (
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container p-5">
          <h4 className="font-semibold text-on-surface">Implementation / Merge Plan</h4>
          <ol className="mt-4 space-y-2 text-sm text-on-surface-variant list-decimal pl-5">
            {buildPlanSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {activeTab === "prompts" && (
        <div className="space-y-4">
          {fraudPrompts.map((prompt) => (
            <article key={prompt.title} className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
              <h4 className="font-semibold text-on-surface">{prompt.title}</h4>
              <pre className="mt-3 text-xs whitespace-pre-wrap rounded-lg bg-surface-container-lowest p-3 border border-outline-variant/15 text-on-surface-variant">
                {prompt.body}
              </pre>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
