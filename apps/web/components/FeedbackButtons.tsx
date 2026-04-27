"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/http";
import { emitAppAlert } from "@/lib/uiAlerts";

type FeedbackCategory =
  | "wrong_reasoning"
  | "missing_context"
  | "poor_formatting"
  | "low_trust"
  | "other";

type FeedbackTargetType =
  | "message"
  | "incident_analysis"
  | "fraud_analysis"
  | "telemetry_response"
  | "batch_result";

type Props = {
  targetType: FeedbackTargetType;
  targetId: string;
  threadId?: string;
  modelProvider?: string;
  modelName?: string;
  artifactType?: string;
  artifactId?: string;
};

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "wrong_reasoning", label: "Wrong reasoning" },
  { value: "missing_context", label: "Missing context" },
  { value: "poor_formatting", label: "Poor formatting" },
  { value: "low_trust", label: "Low trust" },
  { value: "other", label: "Other" },
];

async function submitFeedback(payload: object): Promise<void> {
  await apiFetch("/api/v1/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
    suppressAlerts: true,
  } as Parameters<typeof apiFetch>[1]);
}

export function FeedbackButtons({
  targetType,
  targetId,
  threadId,
  modelProvider,
  modelName,
  artifactType,
  artifactId,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [rating, setRating] = useState<"thumbs_up" | "thumbs_down" | null>(null);
  const [category, setCategory] = useState<FeedbackCategory | "">("");
  const [comment, setComment] = useState("");

  async function handleRating(r: "thumbs_up" | "thumbs_down") {
    setRating(r);
    if (r === "thumbs_up") {
      // Submit immediately for positive — no need for drawer
      await send(r, undefined, undefined);
    } else {
      // Show drawer for negative to capture optional why
      setShowDrawer(true);
    }
  }

  async function send(
    r: "thumbs_up" | "thumbs_down",
    cat: FeedbackCategory | undefined,
    cmt: string | undefined,
  ) {
    setPending(true);
    try {
      await submitFeedback({
        target_type: targetType,
        target_id: targetId,
        rating: r,
        thread_id: threadId ?? null,
        category: cat ?? null,
        comment: cmt ?? null,
        model_provider: modelProvider ?? null,
        model_name: modelName ?? null,
        artifact_type: artifactType ?? null,
        artifact_id: artifactId ?? null,
      });
      setSubmitted(true);
      setShowDrawer(false);
      emitAppAlert({ level: "success", message: "Feedback recorded. Thank you." });
    } catch {
      emitAppAlert({ level: "error", message: "Could not save feedback. Please try again." });
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <span className="text-[11px] text-on-surface-variant italic">
        ✓ Feedback recorded
      </span>
    );
  }

  return (
    <div className="mt-2">
      {/* Thumbs row */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-on-surface-variant">Was this useful?</span>
        <button
          type="button"
          title="Helpful"
          onClick={() => handleRating("thumbs_up")}
          disabled={pending || !!rating}
          className={`rounded p-1 transition-colors ${
            rating === "thumbs_up"
              ? "text-primary"
              : "text-on-surface-variant hover:text-primary"
          } disabled:opacity-50`}
        >
          <span className="material-symbols-outlined text-[18px]">thumb_up</span>
        </button>
        <button
          type="button"
          title="Not helpful"
          onClick={() => handleRating("thumbs_down")}
          disabled={pending || !!rating}
          className={`rounded p-1 transition-colors ${
            rating === "thumbs_down"
              ? "text-error"
              : "text-on-surface-variant hover:text-error"
          } disabled:opacity-50`}
        >
          <span className="material-symbols-outlined text-[18px]">thumb_down</span>
        </button>
      </div>

      {/* Optional "Tell us why" drawer */}
      {showDrawer && (
        <div className="mt-3 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3 space-y-3">
          <p className="text-xs font-semibold text-on-surface">Tell us why (optional)</p>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value === category ? "" : c.value)}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  category === c.value
                    ? "border-primary bg-primary-container text-on-primary-container"
                    : "border-outline-variant/30 text-on-surface-variant hover:border-outline-variant"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Additional comments (optional)"
            maxLength={2000}
            rows={2}
            className="w-full rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs text-on-surface resize-none focus:outline-none focus:border-primary/50"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowDrawer(false);
                setRating(null);
              }}
              disabled={pending}
              className="text-[11px] text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => send("thumbs_down", category as FeedbackCategory || undefined, comment || undefined)}
              disabled={pending}
              className="rounded-lg border border-error/25 bg-error-container/20 px-3 py-1 text-[11px] font-semibold text-error hover:bg-error-container/30 disabled:opacity-50"
            >
              {pending ? "Sending…" : "Submit Feedback"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
