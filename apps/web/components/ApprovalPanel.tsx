"use client";

import { useState } from "react";

import { submitApproval } from "@/lib/api";

export function ApprovalPanel({
  workflowId,
  approver = "analyst1",
}: {
  workflowId: string;
  approver?: string;
}) {
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "approved" | "rejected" | "error">(
    "idle"
  );
  const [activeDecision, setActiveDecision] = useState<"approved" | "rejected" | null>(null);
  const [message, setMessage] = useState("");

  const onDecision = async (decision: "approved" | "rejected") => {
    try {
      setStatus("submitting");
      setActiveDecision(decision);
      setMessage("");
      await submitApproval(workflowId, {
        approver,
        decision,
        reason: comment || "No comment",
      });
      if (decision === "approved") {
        setStatus("approved");
        setMessage("Approval decision sent.");
      } else {
        setStatus("rejected");
        setMessage("Rejection decision sent.");
      }
    } catch (error) {
      console.error("Decision submission failed", error);
      setStatus("error");
      setMessage("Could not submit decision. Check API connection and retry.");
    } finally {
      setActiveDecision(null);
    }
  };

  const isSubmitting = status === "submitting";

  return (
    <div className="space-y-4" data-testid="decision-gate">
      <h2 className="text-lg font-semibold text-on-surface font-headline">Decision Gate</h2>
      <textarea
        className="mt-3 w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary/30"
        rows={4}
        placeholder="Add your approval comment and reasoning..."
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
      <div className="mt-4 flex gap-3">
        <button
          className="flex-1 rounded-xl bg-secondary text-on-secondary px-4 py-3 text-sm font-bold transition-all active:scale-95 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={isSubmitting}
          onClick={() => onDecision("approved")}
        >
          <span
            className={`material-symbols-outlined text-sm mr-2 inline-block ${
              isSubmitting && activeDecision === "approved" ? "animate-spin" : ""
            }`}
          >
            {isSubmitting && activeDecision === "approved" ? "progress_activity" : "check_circle"}
          </span>
          {isSubmitting && activeDecision === "approved" ? "Approving..." : "Approve"}
        </button>
        <button
          className="flex-1 rounded-xl bg-error text-on-error px-4 py-3 text-sm font-bold transition-all active:scale-95 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={isSubmitting}
          onClick={() => onDecision("rejected")}
        >
          <span
            className={`material-symbols-outlined text-sm mr-2 inline-block ${
              isSubmitting && activeDecision === "rejected" ? "animate-spin" : ""
            }`}
          >
            {isSubmitting && activeDecision === "rejected" ? "progress_activity" : "cancel"}
          </span>
          {isSubmitting && activeDecision === "rejected" ? "Rejecting..." : "Reject"}
        </button>
      </div>
      {status === "approved" && <p className="mt-2 text-xs text-secondary font-medium">✓ {message}</p>}
      {status === "rejected" && <p className="mt-2 text-xs text-error font-medium">✗ {message}</p>}
      {status === "error" && <p className="mt-2 text-xs text-error font-medium">⚠ {message}</p>}
    </div>
  );
}
