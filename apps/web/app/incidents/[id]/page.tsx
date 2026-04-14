import { ApprovalPanel } from "@/components/ApprovalPanel";
import { ConfidencePanel } from "@/components/ConfidencePanel";
import { ReasoningTimeline } from "@/components/ReasoningTimeline";
import { getIncidentDetail } from "@/lib/api";

function getSeverityBadgeColor(severity: string) {
  if (severity.toLowerCase() === "critical") return "bg-error-container/20 text-error";
  if (severity.toLowerCase() === "high") return "bg-tertiary-container/20 text-tertiary";
  return "bg-secondary-container/20 text-secondary";
}

export default async function IncidentDetailsPage({ params }: { params: { id: string } }) {
  const detail = await getIncidentDetail(params.id);
  const recommendation = detail.approval_required
    ? "Human review required before remediation is applied."
    : "No additional approval required. Continue with guided remediation.";

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
