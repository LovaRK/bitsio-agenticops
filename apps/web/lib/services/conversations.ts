/**
 * Conversation API service — multi-turn thread management.
 */

import { apiFetch } from "@/lib/http";
import type {
  BatchResult,
  ConversationMessage,
  ConversationThread,
  ConversationThreadWithMessages,
  ThreadListResponse,
} from "@/types/conversations";

export async function createConversationThread(payload: {
  thread_type: string;
  artifact_type?: string | null;
  artifact_id?: string | null;
  title?: string | null;
  created_by?: string;
}): Promise<ConversationThread> {
  return apiFetch<ConversationThread>("/api/v1/conversations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listConversationThreads(params?: {
  artifact_type?: string;
  artifact_id?: string;
  limit?: number;
}): Promise<ThreadListResponse> {
  const qs = params
    ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()
    : "";
  return apiFetch<ThreadListResponse>(`/api/v1/conversations${qs}`);
}

export async function getConversationThread(
  threadId: string,
): Promise<ConversationThreadWithMessages> {
  return apiFetch<ConversationThreadWithMessages>(`/api/v1/conversations/${threadId}`);
}

export async function addConversationMessage(
  threadId: string,
  payload: { role?: string; content: string; debug?: boolean },
): Promise<ConversationMessage> {
  return apiFetch<ConversationMessage>(`/api/v1/conversations/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ role: "user", ...payload }),
  });
}

export async function submitAIFeedback(payload: {
  target_type: string;
  target_id: string;
  rating: "thumbs_up" | "thumbs_down";
  thread_id?: string | null;
  category?: string | null;
  comment?: string | null;
  model_provider?: string | null;
  model_name?: string | null;
  artifact_type?: string | null;
  artifact_id?: string | null;
}): Promise<{ feedback_id: string; rating: string }> {
  return apiFetch("/api/v1/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function batchAnalyzeIncidents(payload: {
  incident_ids: string[];
  analysis_depth?: string;
  debug?: boolean;
}): Promise<BatchResult> {
  return apiFetch<BatchResult>("/api/v1/incidents/analyze/batch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function batchAnalyzeFraud(payload: {
  case_ids: string[];
  debug?: boolean;
}): Promise<BatchResult> {
  return apiFetch<BatchResult>("/api/v1/fraud/analyze/batch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
