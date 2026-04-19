import { ApprovalPanel } from "@/components/ApprovalPanel";
import { ConfidencePanel } from "@/components/ConfidencePanel";
import { ContextPanel } from "@/components/ContextPanel";
import { ReasoningTimeline } from "@/components/ReasoningTimeline";
import { getIncidentDetail } from "@/lib/api";
import { getTelemetryMetrics } from "@/lib/services/waste";

function getSeverityBadgeColor(severity: string) {
  if (severity.toLowerCase() === "critical") return "bg-error-container/20 text-error";
  if (severity.toLowerCase() === "high") return "bg-tertiary-container/20 text-tertiary";
  return "bg-secondary-container/20 text-secondary";
}

export default async function IncidentDetailsPage({ params }: { params: { id: string } }) {
  const detail = await getIncidentDetail(params.id);

  // Fetch telemetry metrics with error handling
  let sourceMetrics: {
    sourceIndex: string;
    utilizationScore: number;
    valueRating: "High" | "Medium" | "Low";
    annualSpendUsd: number;
    potentialSavingsUsd: number;
  } | undefined;

  try {
    const telemetry = await getTelemetryMetrics();
    const source = telemetry.sources.find(s => s.index === detail.source_index);
    if (source) {
      sourceMetrics = {
        sourceIndex: source.name,
        utilizationScore: source.utilization_score,
        valueRating: source.value_rating as "High" | "Medium" | "Low",
        annualSpendUsd: source.annual_spend_usd,
        potentialSavingsUsd: source.potential_savings_usd
      };
    }
  } catch (error) {
    // Telemetry metrics are optional - page still loads if API fails
    sourceMetrics = undefined;
  }

  const recommendation = detail.approval_required
    ? "Human review required before remediation is applied."
    : "No additional approval required. Continue with guided remediation.";

  const policyChecks = detail.node_runs.flatMap((node) => node.policy_checks ?? []);
  const matchedPolicy = policyChecks.find((check) => check.matched) ?? policyChecks[0];
  const createdAt = Date.parse(detail.timestamp);
  const now = Date.now();
  const derivedFreshnessSeconds = Number.isFinite(createdAt)
    ? Math.max(0, Math.round((now - createdAt) / 1000))
    : 0;
  const derivedValidationPassed = detail.node_runs.every((node) => node.status !== "fail");
  const derivedCompletenessScore = Math.max(
    0.5,
    Math.min(0.99, (detail.evidence_refs.length + 2) / (detail.evidence_refs.length + detail.missing_evidence.length + 3)),
  );
  const derivedAccuracyConfidence = Math.max(0.5, Math.min(0.99, detail.confidence));
  const derivedClassification = detail.severity === "high" ? "restricted" : "internal";
  const derivedComplianceFrameworks = derivedClassification === "restricted" ? "PCI-DSS, SOX" : "SOC 2";
  const derivedEncryptionRequired = derivedClassification === "restricted" ? "in-transit + at-rest" : "in-transit";
  const derivedActionConfidence = Math.max(0.5, Math.min(0.99, detail.confidence * (detail.approval_required ? 0.96 : 1.02)));
  const derivedAgentCapabilities = detail.approval_required ? "propose-only" : "propose + auto-remediate";

  const dataQuality = detail.data_quality ?? {
    completeness_score: derivedCompletenessScore,
    freshness_seconds: derivedFreshnessSeconds,
    accuracy_confidence: derivedAccuracyConfidence,
    validation_passed: derivedValidationPassed,
    source: "derived",
  };
  const policyEvaluation = detail.policy_evaluation ?? {
    policy_id: matchedPolicy?.rule_id ?? "rbac_analyst",
    policy_version: detail.graph_version,
    guardrail_triggered: matchedPolicy?.action ?? (detail.approval_required ? "require_approval" : "allow"),
    approval_reason: detail.approval_required
      ? "Human approval required due to policy gate for this risk profile."
      : "No human gate required for current risk profile.",
    source: "derived",
  };
  const classification = detail.data_classification ?? {
    classification: derivedClassification,
    compliance_frameworks: derivedComplianceFrameworks.split(", "),
    encryption_required: derivedEncryptionRequired.replace(" + ", "+"),
    source: "derived",
  };
  const agentTelemetry = detail.agent_telemetry ?? {
    agent_id: detail.assigned_agent.toLowerCase().replace(/\s+/g, "-"),
    agent_version: detail.graph_version,
    agent_capabilities: derivedAgentCapabilities.replace(" + ", "+"),
    action_confidence: derivedActionConfidence,
    human_in_the_loop: detail.approval_required,
    source: "derived",
  };

  if (!detail.node_runs.length) {
    return (
      <main className="pt-6 pb-12 px-8">
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6">
          <h1 className="text-xl font-semibold text-on-surface">No timeline data available</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            This incident has not been processed yet.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-6 pb-12 px-8" data-testid="incident-detail-page">
      <ContextPanel incidentId={params.id} />

      {/* Incident Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className={`${getSeverityBadgeColor(detail.severity)} px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border`}>
            {detail.severity}
          </span>
          <span className="text-on-surface-variant text-xs font-mono">{detail.incident_id}</span>
        </div>
        <h2 className="text-3xl font-black font-headline tracking-tight text-on-surface">
          {detail.title}
        </h2>
        <p className="text-on-surface-variant mt-2 max-w-2xl">{detail.summary}</p>
      </div>

      <section
        className="mb-8 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6"
        data-testid="story-card"
      >
        <h3 className="text-lg font-semibold text-on-surface font-headline">Incident Story</h3>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-4">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">What Happened</p>
            <p className="mt-2 text-on-surface">{detail.summary}</p>
          </div>
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-4">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Why This Conclusion</p>
            <p className="mt-2 text-on-surface">
              Probable cause was derived from correlated evidence across {detail.evidence_refs.length} evidence references and node-level policy checks.
            </p>
          </div>
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-4">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Evidence Used</p>
            <p className="mt-2 text-on-surface">{detail.evidence_refs.length} evidence links from index <span className="font-mono">{detail.source_index}</span>.</p>
          </div>
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-4">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Recommended Action</p>
            <p className="mt-2 text-on-surface">{recommendation}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-outline-variant/30 bg-surface-container-high px-3 py-1 text-xs text-on-surface">
            Confidence: Probability of decision reliability from available evidence.
          </span>
          <span className="rounded-full border border-outline-variant/30 bg-surface-container-high px-3 py-1 text-xs text-on-surface">
            Correlation: Matching patterns across logs, events, and timeline context.
          </span>
          <span className="rounded-full border border-outline-variant/30 bg-surface-container-high px-3 py-1 text-xs text-on-surface">
            Approval Gate: Human policy checkpoint before risky actions.
          </span>
        </div>
      </section>

      <section
        className="mb-8 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6"
        data-testid="run-metadata"
      >
        <h3 className="text-lg font-semibold text-on-surface font-headline">Run Metadata</h3>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Model</p>
            <p className="mt-1 text-on-surface font-mono">
              {detail.run_metadata?.model_provider ?? "unknown"} / {detail.run_metadata?.model_name ?? "unknown"}
            </p>
          </div>
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Runtime</p>
            <p className="mt-1 text-on-surface font-mono">
              {detail.run_metadata?.runtime_mode ?? "unknown"} | Splunk: {detail.run_metadata?.splunk_mode ?? "unknown"}
            </p>
          </div>
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Workflow</p>
            <p className="mt-1 text-on-surface font-mono">
              {detail.workflow_id} ({detail.run_metadata?.run_time_ms ?? "n/a"}ms)
            </p>
            <p className="mt-1 text-[10px] text-on-surface-variant">
              Metadata source: {detail.run_metadata?.source ?? "reported"}
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="governance-panels">
        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
          <h3 className="text-lg font-semibold text-on-surface font-headline">Data Quality Metadata</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">completeness_score</p>
              <p className="mt-1 text-on-surface font-mono">{dataQuality.completeness_score.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">freshness_seconds</p>
              <p className="mt-1 text-on-surface font-mono">{dataQuality.freshness_seconds}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">accuracy_confidence</p>
              <p className="mt-1 text-on-surface font-mono">{dataQuality.accuracy_confidence.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">validation_passed</p>
              <p className={`mt-1 font-mono ${dataQuality.validation_passed ? "text-secondary" : "text-error"}`}>
                {dataQuality.validation_passed ? "true" : "false"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
          <h3 className="text-lg font-semibold text-on-surface font-headline">Policy Evaluation</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">policy_id</p>
              <p className="mt-1 text-on-surface font-mono">{policyEvaluation.policy_id}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">policy_version</p>
              <p className="mt-1 text-on-surface font-mono">{policyEvaluation.policy_version}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">guardrail_triggered</p>
              <p className="mt-1 text-on-surface font-mono">{policyEvaluation.guardrail_triggered}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">approval_reason</p>
              <p className="mt-1 text-on-surface">{policyEvaluation.approval_reason}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
          <h3 className="text-lg font-semibold text-on-surface font-headline">Data Classification & Compliance</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">data_classification</p>
              <p className="mt-1 text-on-surface font-mono">{classification.classification}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">compliance_framework</p>
              <p className="mt-1 text-on-surface font-mono">{classification.compliance_frameworks.join(", ")}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">encryption_required</p>
              <p className="mt-1 text-on-surface font-mono">{classification.encryption_required.replace("+", " + ")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
          <h3 className="text-lg font-semibold text-on-surface font-headline">Agent Telemetry</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">agent_id</p>
              <p className="mt-1 text-on-surface font-mono">{agentTelemetry.agent_id}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">agent_version</p>
              <p className="mt-1 text-on-surface font-mono">{agentTelemetry.agent_version}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">agent_capabilities</p>
              <p className="mt-1 text-on-surface font-mono">{agentTelemetry.agent_capabilities.replace("+", " + ")}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">action_confidence</p>
              <p className="mt-1 text-on-surface font-mono">{agentTelemetry.action_confidence.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">human_in_the_loop</p>
              <p className={`mt-1 font-mono ${agentTelemetry.human_in_the_loop ? "text-tertiary" : "text-secondary"}`}>
                {agentTelemetry.human_in_the_loop ? "required" : "not_required"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Asymmetric Layout: Reasoning Timeline (Main) & Confidence Panel (Side) */}
      <div className="grid grid-cols-12 gap-8 items-start">
        <ReasoningTimeline nodeRuns={detail.node_runs} runMetadata={detail.run_metadata} />
        <ConfidencePanel
          confidence={detail.confidence}
          workflowId={detail.workflow_id}
          approvalRequired={detail.approval_required}
          impactedService={detail.source_index}
          responders={[
            { id: "user1", name: "Sarah Chen", isAI: false },
            { id: "ai", name: "Observer-Prime", isAI: true }
          ]}
          sourceMetrics={sourceMetrics}
        />
      </div>

      {/* Additional Assessment Section */}
      <div className="mt-8 col-span-12 lg:col-span-8">
        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6">
          <h2 className="text-lg font-semibold text-on-surface font-headline">Final Assessment</h2>
          <p className="mt-3 text-sm text-on-surface leading-relaxed">{detail.summary}</p>
          <p className="mt-3 text-sm text-on-surface leading-relaxed">
            <span className="font-semibold">Probable cause:</span> {detail.probable_cause}
          </p>
          <p className="mt-3 text-sm text-on-surface-variant">
            Graph version: <span className="font-mono">{detail.graph_version}</span>
          </p>
        </section>

        {/* Approval Panel if needed */}
        {detail.approval_required && (
          <section
            className="mt-6 rounded-xl border border-outline-variant/10 bg-surface-container-low p-6"
            data-testid="approval-section"
          >
            <ApprovalPanel workflowId={detail.workflow_id} />
          </section>
        )}
      </div>
    </main>
  );
}
