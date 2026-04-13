"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { submitApproval } from "@/lib/api";

export function ConfidencePanel({
  confidence,
  workflowId,
  approvalRequired,
  impactedService,
  responders
}: {
  confidence: number;
  workflowId: string;
  approvalRequired: boolean;
  impactedService?: string;
  responders?: Array<{ id: string; name: string; isAI?: boolean }>;
}) {
  const router = useRouter();
  const confidencePercent = Math.round(confidence * 100);
  const [actionState, setActionState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [activeAction, setActiveAction] = useState<"approve" | "escalate" | null>(null);
  const [message, setMessage] = useState("");

  const handleReviewApprove = async () => {
    if (!approvalRequired) {
      setActionState("done");
      setMessage("No approval required for this incident.");
      return;
    }
    setActionState("working");
    setActiveAction("approve");
    setMessage("");
    try {
      await submitApproval(workflowId, {
        approver: "analyst1",
        decision: "approved",
        reason: "Approved from confidence panel quick action",
      });
      setActionState("done");
      setMessage("Approved and recorded successfully.");
      router.refresh();
    } catch {
      setActionState("error");
      setMessage("Approval failed. Please retry.");
    } finally {
      setActiveAction(null);
    }
  };

  const handleEscalate = async () => {
    setActionState("working");
    setActiveAction("escalate");
    setMessage("");
    try {
      await submitApproval(workflowId, {
        approver: "analyst1",
        decision: "rejected",
        reason: "Escalated to human responder from confidence panel",
      });
      setActionState("done");
      setMessage("Escalation sent. Routed to human review queue.");
      router.push("/approvals");
    } catch {
      setActionState("error");
      setMessage("Escalation failed. Please retry.");
    } finally {
      setActiveAction(null);
    }
  };

  const centerService = impactedService || "tutorial";
  const blastNodes = [
    {
      id: "core",
      label: centerService,
      x: "50%",
      y: "42%",
      level: "high" as const,
      note: "Primary impact",
    },
    {
      id: "node1",
      label: "gateway-api",
      x: "25%",
      y: "25%",
      level: confidencePercent > 80 ? ("medium" as const) : ("low" as const),
      note: "Upstream retries",
    },
    {
      id: "node2",
      label: "auth-api",
      x: "75%",
      y: "25%",
      level: "low" as const,
      note: "Token validation delays",
    },
    {
      id: "node3",
      label: "orders-worker",
      x: "22%",
      y: "72%",
      level: confidencePercent > 70 ? ("medium" as const) : ("low" as const),
      note: "Queue lag",
    },
    {
      id: "node4",
      label: "billing-worker",
      x: "78%",
      y: "72%",
      level: approvalRequired ? ("medium" as const) : ("low" as const),
      note: "Deferred settlement",
    },
  ];

  const levelStyles: Record<"high" | "medium" | "low", string> = {
    high: "bg-error text-on-error",
    medium: "bg-tertiary text-on-tertiary-container",
    low: "bg-secondary text-on-secondary",
  };

  return (
    <aside className="col-span-12 lg:col-span-4 sticky top-24" data-testid="confidence-panel">
      <div className="glass-panel p-6 rounded-2xl border border-outline-variant/15 flex flex-col gap-8">
        {/* Confidence Meter */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-6 flex items-center justify-between">
            Confidence Score
            <span className="text-secondary font-headline text-lg">{confidencePercent}%</span>
          </h4>
          <div className="relative h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden mb-2">
            <div
              className="absolute left-0 top-0 h-full bg-secondary rounded-full transition-all duration-500"
              style={{ width: `${confidencePercent}%` }}
            ></div>
            <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          </div>
          <p className="text-[11px] text-on-surface-variant leading-tight">
            System is highly confident based on 4 historic matches and log patterns in Splunk.
          </p>
        </div>

        {/* Contextual Data */}
        <div className="space-y-4">
          {impactedService && (
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
              <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider block mb-1">
                Impacted Service
              </span>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-tertiary">cloud</span>
                <span className="text-sm font-bold font-headline">{impactedService}</span>
              </div>
            </div>
          )}

          {responders && responders.length > 0 && (
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
              <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider block mb-1">
                Active Responders
              </span>
              <div className="flex -space-x-2">
                {responders.map((responder) =>
                  responder.isAI ? (
                    <div
                      key={responder.id}
                      className="w-6 h-6 rounded-full border-2 border-surface bg-primary-container ring-1 ring-outline-variant/30 flex items-center justify-center text-[8px] font-bold"
                    >
                      AI
                    </div>
                  ) : (
                    <div
                      key={responder.id}
                      className="w-6 h-6 rounded-full border-2 border-surface bg-surface-container ring-1 ring-outline-variant/30 overflow-hidden"
                      title={responder.name}
                    >
                      <div className="w-full h-full bg-surface-container-high"></div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Area */}
        <div className="pt-4 border-t border-outline-variant/10">
          <button
            type="button"
            onClick={handleReviewApprove}
            disabled={actionState === "working"}
            className="w-full bg-primary py-4 rounded-xl text-on-primary font-black font-headline tracking-wide glow-primary hover:scale-[1.02] transition-transform active:scale-95 mb-3 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span
              className={`material-symbols-outlined font-bold ${
                actionState === "working" && activeAction === "approve" ? "animate-spin" : ""
              }`}
            >
              {actionState === "working" && activeAction === "approve" ? "progress_activity" : "verified"}
            </span>
            {actionState === "working" && activeAction === "approve" ? "Approving..." : "Review & Approve"}
          </button>
          <button
            type="button"
            onClick={handleEscalate}
            disabled={actionState === "working"}
            className="w-full bg-surface-container-high py-3 rounded-xl text-on-surface text-sm font-bold border border-outline-variant/20 hover:bg-surface-bright transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            <span
              className={`material-symbols-outlined text-sm ${
                actionState === "working" && activeAction === "escalate" ? "animate-spin" : ""
              }`}
            >
              {actionState === "working" && activeAction === "escalate" ? "progress_activity" : "support_agent"}
            </span>
            {actionState === "working" && activeAction === "escalate" ? "Escalating..." : "Escalate to Human"}
          </button>
          {message && (
            <p
              className={`mt-3 text-xs font-medium ${
                actionState === "error" ? "text-error" : "text-secondary"
              }`}
              data-testid="confidence-action-message"
            >
              {message}
            </p>
          )}
        </div>
      </div>

      {/* Secondary Context Map */}
      <div className="mt-6 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
        <h5 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-4">
          Blast Radius Map
        </h5>
        <div className="aspect-video bg-surface-container-lowest rounded-lg relative overflow-hidden px-3 py-2">
          <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-primary/20 via-transparent to-tertiary/20" />

          {/* Connection lines */}
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            <line x1="50%" y1="42%" x2="25%" y2="25%" stroke="rgba(140,144,161,0.55)" strokeWidth="1.5" />
            <line x1="50%" y1="42%" x2="75%" y2="25%" stroke="rgba(140,144,161,0.55)" strokeWidth="1.5" />
            <line x1="50%" y1="42%" x2="22%" y2="72%" stroke="rgba(140,144,161,0.55)" strokeWidth="1.5" />
            <line x1="50%" y1="42%" x2="78%" y2="72%" stroke="rgba(140,144,161,0.55)" strokeWidth="1.5" />
          </svg>

          {blastNodes.map((node) => (
            <div
              key={node.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: node.x, top: node.y }}
            >
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`h-3 w-3 rounded-full ${
                    node.level === "high"
                      ? "bg-error animate-pulse"
                      : node.level === "medium"
                        ? "bg-tertiary"
                        : "bg-secondary"
                  }`}
                />
                <div className="rounded-md border border-outline-variant/25 bg-surface-container px-2 py-1 text-[10px] text-on-surface whitespace-nowrap shadow">
                  {node.label}
                </div>
              </div>
            </div>
          ))}

          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span className="font-semibold text-on-surface">Propagation:</span>
              1-hop services
            </div>
            <div className="flex items-center gap-1">
              <span className={`rounded px-1.5 py-0.5 font-bold ${levelStyles.high}`}>H</span>
              <span className={`rounded px-1.5 py-0.5 font-bold ${levelStyles.medium}`}>M</span>
              <span className={`rounded px-1.5 py-0.5 font-bold ${levelStyles.low}`}>L</span>
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-outline-variant/20 bg-surface-container p-3 text-xs text-on-surface-variant">
          <p className="text-on-surface font-semibold mb-1">Impact Summary</p>
          <p>
            Primary impact is concentrated on <span className="text-on-surface">{centerService}</span>. Related
            service degradation is limited to nearby dependencies, with {approvalRequired ? "human approval required" : "automated handling active"} before remediation actions.
          </p>
        </div>
      </div>
    </aside>
  );
}
