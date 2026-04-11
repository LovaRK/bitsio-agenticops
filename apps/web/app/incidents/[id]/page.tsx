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

      {/* Asymmetric Layout: Reasoning Timeline (Main) & Confidence Panel (Side) */}
      <div className="grid grid-cols-12 gap-8 items-start">
        <ReasoningTimeline nodeRuns={detail.node_runs} />
        <ConfidencePanel
          confidence={detail.confidence}
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
