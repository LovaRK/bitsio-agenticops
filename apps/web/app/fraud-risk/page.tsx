import Link from "next/link";

import { MotionCard } from "@/components/ui/MotionCard";
import { getFraudOverview } from "@/lib/services/fraud";
import { formatDateTimeUTC } from "@/lib/datetime";
import { TOOLTIP } from "@/lib/uiTooltips";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

function severityTone(score: number): { badge: string; dot: string; label: string } {
  if (score >= 85) {
    return {
      badge: "bg-error-container/20 text-error",
      dot: "bg-error",
      label: "critical",
    };
  }
  if (score >= 70) {
    return {
      badge: "bg-tertiary-container/20 text-tertiary",
      dot: "bg-tertiary",
      label: "high",
    };
  }
  return {
    badge: "bg-secondary-container/20 text-secondary",
    dot: "bg-secondary",
    label: "medium",
  };
}

export default async function FraudRiskPage() {
  let data: Awaited<ReturnType<typeof getFraudOverview>>;
  let liveError: string | null = null;

  try {
    data = await getFraudOverview("live");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    liveError = `Live Splunk data is required for Fraud Risk page. ${message}`;
    return (
      <section className="pt-4 pb-10 px-4 sm:px-6 lg:px-8 sm:pt-6 lg:pb-12" data-testid="fraud-risk-page">
        <div className="max-w-4xl rounded-xl border border-error/30 bg-error/10 p-6">
          <h2 className="text-2xl font-headline font-bold text-error">Live Fraud Data Unavailable</h2>
          <p className="mt-3 text-sm text-on-surface-variant">
            The Fraud Risk page is configured for live Splunk-only mode. Please start the Splunk
            tunnel and verify runtime connections in Settings.
          </p>
          <p className="mt-3 text-xs text-on-surface-variant/90 font-mono break-all">{liveError}</p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-on-primary-container"
            >
              Open Settings
            </Link>
            <Link
              href="/monitoring"
              className="inline-flex items-center justify-center rounded-lg border border-outline-variant/30 px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface"
            >
              Open Monitoring
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const sortedSignals = Object.entries(data.signal_breakdown).sort((a, b) => b[1] - a[1]);
  const incidentContextHref = data.active_cases[0]?.incident_id
    ? `/incidents/${data.active_cases[0].incident_id}`
    : "/incidents/inc_20260408_44";

  return (
    <section className="pt-4 pb-10 px-4 sm:px-6 lg:px-8 sm:pt-6 lg:pb-12" data-testid="fraud-risk-page">
      <div className="mb-10 space-y-3">
        <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight">
          Fraud Risk Analysis
        </h2>
        <p className="text-on-surface-variant text-sm max-w-4xl">
          Correlates payment, identity, and approval telemetry from Splunk to produce auditable
          fraud-risk recommendations with mandatory human approval controls.
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1 text-on-surface-variant">
            Mode: <strong className="text-on-surface">{data.mode === "live" ? "Live Splunk" : "Seeded"}</strong>
          </span>
          <span className="rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1 text-on-surface-variant">
            Generated: <strong className="text-on-surface">{formatDateTimeUTC(data.generated_at)}</strong>
          </span>
          {data.model_meta ? (
            <span className="rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1 text-on-surface-variant">
              Model: <strong className="text-on-surface">{data.model_meta.resolved}</strong> ({data.model_meta.reason})
            </span>
          ) : null}
          {data.degraded_reason ? (
            <span className="rounded-full border border-tertiary/30 bg-tertiary-container/20 px-3 py-1 text-tertiary">
              Fallback: {data.degraded_reason}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <MotionCard className="rounded-xl border border-outline-variant/10 bg-surface-container p-5" title={TOOLTIP.fraud.activeCases}>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
            Open Fraud Cases
          </p>
          <p className="mt-3 text-3xl font-black text-on-surface">{data.summary.open_cases}</p>
          <p className="mt-2 text-xs text-on-surface-variant">
            {data.summary.high_risk_cases} high-risk signals correlated
          </p>
        </MotionCard>

        <MotionCard className="rounded-xl border border-outline-variant/10 bg-surface-container p-5" title={TOOLTIP.fraud.riskScore}>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
            Average Risk Score
          </p>
          <p className="mt-3 text-3xl font-black text-error">{formatPct(data.summary.avg_risk_score)}</p>
          <p className="mt-2 text-xs text-on-surface-variant">
            Approval required for {data.summary.approval_required_cases} cases
          </p>
        </MotionCard>

        <MotionCard className="rounded-xl border border-outline-variant/10 bg-surface-container p-5" title={TOOLTIP.fraud.explainability}>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
            Potential Exposure
          </p>
          <p className="mt-3 text-3xl font-black text-tertiary">
            {formatUsd(data.summary.potential_exposure_usd)}
          </p>
          <p className="mt-2 text-xs text-on-surface-variant">
            Reviewed amount {formatUsd(data.summary.total_amount_reviewed_usd)}
          </p>
        </MotionCard>

        <MotionCard className="rounded-xl border border-outline-variant/10 bg-surface-container p-5" title="Telemetry data quality signal for fraud analysis reliability.">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
            Data Quality
          </p>
          <p className="mt-3 text-3xl font-black text-secondary">
            {formatPct(data.data_quality.completeness_score * 100)}
          </p>
          <p className="mt-2 text-xs text-on-surface-variant">
            Freshness {data.data_quality.freshness_seconds}s | Confidence {formatPct(data.data_quality.accuracy_confidence * 100)}
          </p>
        </MotionCard>
      </div>

      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 mb-8">
        <h3 className="text-lg font-semibold text-on-surface mb-2">Risk Story</h3>
        <p className="text-sm text-on-surface-variant leading-6">{data.narrative}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <article className="xl:col-span-2 rounded-xl border border-outline-variant/10 bg-surface-container-low overflow-hidden">
          <header className="px-5 py-4 border-b border-outline-variant/10">
            <h3 className="text-lg font-semibold text-on-surface">Active Fraud Cases</h3>
            <p className="text-xs text-on-surface-variant mt-1">
              Propose-only workflow: recommendations require explicit human approval before action.
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead className="bg-surface-container border-b border-outline-variant/15 text-[10px] uppercase tracking-widest text-outline">
                <tr>
                  <th className="px-4 py-3">Case</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Signals</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.active_cases.map((item) => {
                  const tone = severityTone(item.risk_score);
                  return (
                    <tr key={item.case_id} className="border-b border-outline-variant/10 align-top">
                      <td className="px-4 py-3 text-xs text-on-surface">
                        <div className="font-mono">{item.case_id}</div>
                        <div className="text-on-surface-variant mt-1">{formatDateTimeUTC(item.timestamp)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-on-surface">{item.vendor}</td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant">{item.user}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-on-surface">{formatUsd(item.amount_usd)}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
                          <span className={`rounded-full px-2 py-0.5 font-bold uppercase tracking-wide ${tone.badge}`}>
                            {tone.label}
                          </span>
                        </div>
                        <div className="text-on-surface-variant">{item.risk_score}/100</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">
                        {item.anomaly_types.join(", ")}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {item.requires_approval ? (
                          <span className="rounded-full border border-tertiary/30 bg-tertiary-container/20 px-2 py-1 text-tertiary font-semibold">
                            Needs Approval
                          </span>
                        ) : (
                          <span className="rounded-full border border-secondary/30 bg-secondary-container/20 px-2 py-1 text-secondary font-semibold">
                            Monitor
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <div className="space-y-6">
          <MotionCard className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5" title={TOOLTIP.fraud.policy}>
            <h4 className="text-sm font-semibold text-on-surface mb-3">Policy Evaluation</h4>
            <div className="space-y-2 text-xs text-on-surface-variant">
              <p>
                <strong className="text-on-surface">Policy:</strong> {data.policy_evaluation.policy_id}
              </p>
              <p>
                <strong className="text-on-surface">Version:</strong> {data.policy_evaluation.policy_version}
              </p>
              <p>
                <strong className="text-on-surface">Rule:</strong> {data.policy_evaluation.rule_triggered}
              </p>
              <p>{data.policy_evaluation.approval_reason}</p>
            </div>
          </MotionCard>

          <MotionCard className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5" title="Data classification, compliance framework, and encryption requirements.">
            <h4 className="text-sm font-semibold text-on-surface mb-3">Compliance & Governance</h4>
            <div className="space-y-2 text-xs text-on-surface-variant">
              <p>
                <strong className="text-on-surface">Classification:</strong> {data.compliance.data_classification}
              </p>
              <p>
                <strong className="text-on-surface">Frameworks:</strong> {data.compliance.compliance_frameworks.join(", ")}
              </p>
              <p>
                <strong className="text-on-surface">Encryption:</strong> {data.compliance.encryption_required}
              </p>
            </div>
          </MotionCard>

          <MotionCard className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5" title="Agent identity, capabilities, confidence, and human-loop mode.">
            <h4 className="text-sm font-semibold text-on-surface mb-3">Agent Telemetry</h4>
            <div className="space-y-2 text-xs text-on-surface-variant">
              <p>
                <strong className="text-on-surface">Agent:</strong> {data.agent_telemetry.agent_id}
              </p>
              <p>
                <strong className="text-on-surface">Version:</strong> {data.agent_telemetry.agent_version}
              </p>
              <p>
                <strong className="text-on-surface">Capabilities:</strong> {data.agent_telemetry.agent_capabilities}
              </p>
              <p>
                <strong className="text-on-surface">Action Confidence:</strong>{" "}
                {formatPct(data.agent_telemetry.action_confidence * 100)}
              </p>
              <p>
                <strong className="text-on-surface">Human in the Loop:</strong>{" "}
                {data.agent_telemetry.human_in_the_loop ? "Required" : "Not required"}
              </p>
              {data.model_meta ? (
                <>
                  <p className="mt-3 text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
                    Model Selection Policy
                  </p>
                  <p>
                    <strong className="text-on-surface">Task:</strong> {data.model_meta.task} ({data.model_meta.complexity})
                  </p>
                  <p>
                    <strong className="text-on-surface">Requested:</strong> {data.model_meta.requested}
                  </p>
                  <p>
                    <strong className="text-on-surface">Resolved:</strong> {data.model_meta.resolved}
                  </p>
                  <p>
                    <strong className="text-on-surface">Reason:</strong> {data.model_meta.reason}
                  </p>
                  <p>
                    <strong className="text-on-surface">Latency Budget:</strong> {data.model_meta.latency_budget_ms}ms
                  </p>
                </>
              ) : null}
            </div>
          </MotionCard>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <MotionCard className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5" title="Distribution of anomaly signal categories in active cases.">
          <h3 className="text-lg font-semibold text-on-surface mb-4">Signal Mix</h3>
          <div className="space-y-3">
            {sortedSignals.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No signal categories available.</p>
            ) : (
              sortedSignals.map(([signal, count]) => (
                <div key={signal} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-on-surface-variant">{signal.replaceAll("_", " ")}</span>
                  <div className="flex items-center gap-3 flex-1 max-w-xs">
                    <div className="h-2 rounded-full bg-surface-container-high flex-1 overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, (count / Math.max(sortedSignals[0][1], 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-on-surface font-semibold min-w-6 text-right">{count}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </MotionCard>

        <MotionCard className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5" title="Commercial packaging context for Fraud Risk Agent deployment.">
          <h3 className="text-lg font-semibold text-on-surface mb-4">Commercial Fit (Pricing Context)</h3>
          <div className="space-y-2 text-sm text-on-surface-variant">
            <p>
              <strong className="text-on-surface">Primary Buyer:</strong> {data.pricing_context.primary_buyer}
            </p>
            <p>
              <strong className="text-on-surface">Annual Subscription (ARR):</strong>{" "}
              {data.pricing_context.annual_subscription_arr_usd}
            </p>
            <p>
              <strong className="text-on-surface">One-time Onboarding:</strong>{" "}
              {data.pricing_context.one_time_onboarding_usd}
            </p>
            <p>
              <strong className="text-on-surface">Optional Managed Tuning:</strong>{" "}
              {data.pricing_context.optional_managed_tuning_usd_per_year}
            </p>
          </div>
          <div className="mt-4 flex gap-3">
            <Link
              href="/approvals"
              className="inline-flex items-center justify-center rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-on-primary-container"
            >
              Open Approvals
            </Link>
            <Link
              href={incidentContextHref}
              className="inline-flex items-center justify-center rounded-lg border border-outline-variant/30 px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface"
            >
              View Incident Context
            </Link>
          </div>
        </MotionCard>
      </div>

      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 text-xs text-on-surface-variant">
        <p>
          Recommended hold amount based on current rules: <strong className="text-on-surface">{formatUsd(data.summary.recommended_hold_amount_usd)}</strong>.
          All actions remain propose-only until an approver accepts through the approval gate.
        </p>
      </div>
    </section>
  );
}
