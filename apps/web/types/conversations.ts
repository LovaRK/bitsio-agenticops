// ── Token / Cost ──────────────────────────────────────────────────────────────

export interface TokenMeta {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number | null;
  cost_source: "reported" | "derived" | "not_applicable";
  latency_ms: number | null;
  provider: string | null;
  model: string | null;
}

// ── Debug ─────────────────────────────────────────────────────────────────────

export interface DebugMeta {
  model_provider: string | null;
  model_name: string | null;
  runtime_mode: string | null;
  adapter_mode: string | null;
  prompt_template: string | null;
  context_source: string | null;
  input_token_estimate: number | null;
  output_token_estimate: number | null;
  latency_ms: number | null;
  fallback_used: boolean;
  retrieval_mode: string | null;
  tools_selected: string[];
  redacted: boolean;
}

// ── Conversation ──────────────────────────────────────────────────────────────

export type ThreadType = "telemetry" | "fraud" | "incident" | "approval" | "general";

export interface ConversationThread {
  thread_id: string;
  thread_type: ThreadType;
  artifact_type: string | null;
  artifact_id: string | null;
  title: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationMessage {
  message_id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  token_meta: TokenMeta | null;
  debug_meta: DebugMeta | null;
  created_at: string;
}

export interface ConversationThreadWithMessages extends ConversationThread {
  messages: ConversationMessage[];
  token_totals: TokenMeta | null;
}

export interface ThreadListResponse {
  threads: ConversationThread[];
  total: number;
}

// ── Feedback ──────────────────────────────────────────────────────────────────

export type FeedbackRating = "thumbs_up" | "thumbs_down";
export type FeedbackCategory =
  | "wrong_reasoning"
  | "missing_context"
  | "poor_formatting"
  | "low_trust"
  | "other";
export type FeedbackTargetType =
  | "message"
  | "incident_analysis"
  | "fraud_analysis"
  | "telemetry_response"
  | "batch_result";

export interface AIFeedback {
  feedback_id: string;
  target_type: FeedbackTargetType;
  target_id: string;
  thread_id: string | null;
  user_id: string;
  rating: FeedbackRating;
  category: FeedbackCategory | null;
  comment: string | null;
  model_provider: string | null;
  model_name: string | null;
  artifact_type: string | null;
  artifact_id: string | null;
  created_at: string;
}

// ── Batch ─────────────────────────────────────────────────────────────────────

export interface BatchItem {
  item_id: string;
  success: boolean;
  result: unknown | null;
  error: string | null;
  token_meta: TokenMeta | null;
}

export interface BatchResult {
  batch_id: string;
  total: number;
  succeeded: number;
  failed: number;
  items: BatchItem[];
  aggregate_summary: string | null;
  token_summary: TokenMeta | null;
  debug_summary: DebugMeta | null;
  created_at: string;
}
