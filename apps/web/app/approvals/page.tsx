import Link from "next/link";

import { ApprovalPanel } from "@/components/ApprovalPanel";
import { listPendingApprovals } from "@/lib/api";
import { formatDateTimeUTC } from "@/lib/datetime";

function getSeverityColor(severity: string) {
  if (severity.toLowerCase() === "high" || severity.toLowerCase() === "critical") {
    return { badge: "bg-error-container/20 text-error", dot: "bg-error" };
  }
  if (severity.toLowerCase() === "medium") {
    return { badge: "bg-tertiary-container/20 text-tertiary", dot: "bg-tertiary" };
  }
  return { badge: "bg-secondary-container/20 text-secondary", dot: "bg-secondary" };
}

export default async function ApprovalsPage() {
  let pendingApprovals: Awaited<ReturnType<typeof listPendingApprovals>>;
  try {
    pendingApprovals = await listPendingApprovals();
  } catch {
    return (
      <section className="pt-4 pb-10 px-4 sm:px-6 lg:px-8 sm:pt-6 lg:pb-12" data-testid="approvals-page">
        <div className="rounded-xl border border-error/25 bg-error/10 p-6">
          <h2 className="text-xl font-semibold text-on-surface">Approval queue unavailable</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Could not load live approval data from the API. Verify runtime connectivity in Settings and
            retry.
          </p>
          <Link
            href="/settings"
            className="mt-4 inline-flex rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-on-primary-container"
          >
            Open Settings
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-4 pb-10 px-4 sm:px-6 lg:px-8 sm:pt-6 lg:pb-12" data-testid="approvals-page">
      <div className="mb-10">
        <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
          Approval Gate
        </h2>
        <p className="text-on-surface-variant text-sm">
          Live approval queue sourced from incidents currently marked as pending approval.
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {pendingApprovals.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-30 block mb-4">
              check_circle
            </span>
            <h3 className="text-lg font-semibold text-on-surface mb-2">No pending approvals</h3>
            <p className="text-on-surface-variant text-sm">
              All recommendations have already been reviewed.
            </p>
            <Link
              href="/incidents"
              className="inline-block mt-5 px-4 py-2 rounded-lg text-xs font-bold bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            >
              Open Incidents
            </Link>
          </div>
        ) : (
          pendingApprovals.map((approval) => {
            const severityColor = getSeverityColor(approval.severity);
            return (
              <article
                key={approval.workflow_id}
                className="rounded-xl border border-outline-variant/10 bg-surface-container-low overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-outline-variant/10">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`w-2 h-2 rounded-full ${severityColor.dot}`} />
                    <span
                      className={`text-[10px] font-bold tracking-widest uppercase ${severityColor.badge} px-2 py-0.5 rounded`}
                    >
                      {approval.severity}
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      {approval.incident_id}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-on-surface">{approval.title}</h3>
                  <p className="text-sm text-on-surface-variant mt-1">{approval.recommendation}</p>
                  <div className="flex items-center gap-5 text-xs text-on-surface-variant mt-3">
                    <span>
                      Confidence: <strong>{Math.round(approval.confidence * 100)}%</strong>
                    </span>
                    <span>{formatDateTimeUTC(approval.time_queued)}</span>
                    <Link
                      href={`/incidents/${approval.incident_id}`}
                      className="text-primary font-semibold hover:underline"
                    >
                      View Incident
                    </Link>
                  </div>
                </div>

                <div className="px-6 py-6 bg-surface-container-lowest">
                  <ApprovalPanel workflowId={approval.workflow_id} />
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
