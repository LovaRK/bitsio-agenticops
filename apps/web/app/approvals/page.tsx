"use client";

import { useState } from "react";
import { ApprovalPanel } from "@/components/ApprovalPanel";

const mockApprovals = [
  {
    id: "wf_20260410_001",
    incidentId: "INC-99230-AX",
    title: "Memory Leak: VectorDB-Node-04",
    severity: "critical" as const,
    confidence: 0.88,
    recommendation: "Restart VectorDB Node 4 and increase memory allocation to 16GB",
    timeQueued: "14:22:09 (2m ago)"
  },
  {
    id: "wf_20260410_002",
    incidentId: "INC-99231-BF",
    title: "Anomalous API Latency: Stripe-Auth",
    severity: "high" as const,
    confidence: 0.76,
    recommendation: "Increase connection pool size from 512 to 1024 and enable circuit breaker",
    timeQueued: "14:15:44 (9m ago)"
  }
];

function getSeverityColor(severity: "critical" | "high" | "low") {
  if (severity === "critical") {
    return { badge: "bg-error-container/20 text-error", dot: "bg-error" };
  }
  if (severity === "high") {
    return { badge: "bg-tertiary-container/20 text-tertiary", dot: "bg-tertiary" };
  }
  return { badge: "bg-secondary-container/20 text-secondary", dot: "bg-secondary" };
}

export default function ApprovalsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(mockApprovals[0].id);

  return (
    <section className="pt-6 pb-12 px-8">
      {/* Summary Header */}
      <div className="mb-10">
        <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
          Approval Gate
        </h2>
        <p className="text-on-surface-variant text-sm">
          Review and approve autonomous agent recommendations before taking action.
        </p>
      </div>

      {/* Approvals List */}
      <div className="grid gap-6 max-w-4xl">
        {mockApprovals.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-30 block mb-4">
              check_circle
            </span>
            <h3 className="text-lg font-semibold text-on-surface mb-2">No pending approvals</h3>
            <p className="text-on-surface-variant text-sm">All recommendations have been processed.</p>
          </div>
        ) : (
          mockApprovals.map((approval) => {
            const severityColor = getSeverityColor(approval.severity);
            const isExpanded = expandedId === approval.id;

            return (
              <div
                key={approval.id}
                className="rounded-xl border border-outline-variant/10 bg-surface-container-low overflow-hidden transition-all"
              >
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : approval.id)}
                  className="w-full px-6 py-4 flex items-start justify-between hover:bg-surface-container/50 transition-colors text-left"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-2 h-2 rounded-full ${severityColor.dot}`}></div>
                      <span className={`text-[10px] font-bold tracking-widest uppercase ${severityColor.badge} px-2 py-0.5 rounded`}>
                        {approval.severity}
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-mono">{approval.incidentId}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-on-surface mb-1">{approval.title}</h3>
                    <p className="text-sm text-on-surface-variant mb-2">{approval.recommendation}</p>
                    <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                      <span>
                        <span className="font-semibold">Confidence:</span> {Math.round(approval.confidence * 100)}%
                      </span>
                      <span>{approval.timeQueued}</span>
                    </div>
                  </div>

                  {/* Toggle Indicator */}
                  <div className="ml-4 mt-1">
                    <span className={`material-symbols-outlined transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </div>
                </button>

                {/* Expandable Content */}
                {isExpanded && (
                  <div className="border-t border-outline-variant/10 px-6 py-6 bg-surface-container-lowest">
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">insights</span>
                        Agent Reasoning
                      </h4>
                      <div className="space-y-2 text-sm text-on-surface-variant">
                        <p>
                          The agent detected abnormal memory allocation patterns consistent with a memory leak based on:
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>12 correlated log entries from Splunk showing heap growth</li>
                          <li>Vector database query latency increased 4x in last 30 minutes</li>
                          <li>Historical similarity to INC-4410 (previous memory leak incident)</li>
                        </ul>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">policy</span>
                        Policy Checks
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="material-symbols-outlined text-sm text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                          </span>
                          <span className="text-on-surface">Escalation policy: Passed</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="material-symbols-outlined text-sm text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                          </span>
                          <span className="text-on-surface">Change window: Within business hours</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="material-symbols-outlined text-sm text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                          </span>
                          <span className="text-on-surface">Rate limiting: Not exceeded</span>
                        </div>
                      </div>
                    </div>

                    {/* Approval Controls */}
                    <ApprovalPanel workflowId={approval.id} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Info Panel */}
      <div className="mt-12 p-6 bg-surface-container-low rounded-xl border border-outline-variant/10">
        <h3 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">info</span>
          About Approvals
        </h3>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          All autonomous agent recommendations are held for human approval before execution. Each decision trace
          is immutable and auditable. You can review the full reasoning timeline, evidence, and policy checks before
          deciding to approve or reject.
        </p>
      </div>
    </section>
  );
}
