"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DebugDrawer } from "@/components/DebugDrawer";
import { FeedbackButtons } from "@/components/FeedbackButtons";
import { TokenCostBadge } from "@/components/TokenCostBadge";
import { apiFetch } from "@/lib/http";

// ── Types ─────────────────────────────────────────────────────────────────────

type ThreadType = "telemetry" | "fraud" | "incident" | "approval" | "general";

type TokenMeta = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number | null;
  latency_ms?: number | null;
  provider?: string | null;
  model?: string | null;
};

type DebugMeta = {
  model_provider?: string | null;
  model_name?: string | null;
  runtime_mode?: string | null;
  adapter_mode?: string | null;
  prompt_template?: string | null;
  context_source?: string | null;
  input_token_estimate?: number | null;
  output_token_estimate?: number | null;
  latency_ms?: number | null;
  fallback_used?: boolean;
  tools_selected?: string[];
};

type Message = {
  message_id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  token_meta?: TokenMeta | null;
  debug_meta?: DebugMeta | null;
  created_at: string;
};

type Thread = {
  thread_id: string;
  thread_type: ThreadType;
  artifact_type?: string | null;
  artifact_id?: string | null;
  title?: string | null;
  message_count: number;
  messages?: Message[];
  token_totals?: TokenMeta | null;
};

type Props = {
  artifactType: ThreadType;
  artifactId: string;
  title?: string;
  showDebug?: boolean;
};

// ── API helpers ───────────────────────────────────────────────────────────────

async function createThread(
  artifactType: ThreadType,
  artifactId: string,
  title: string,
): Promise<Thread> {
  return apiFetch<Thread>("/api/v1/conversations", {
    method: "POST",
    body: JSON.stringify({
      thread_type: artifactType,
      artifact_type: artifactType,
      artifact_id: artifactId,
      title,
    }),
    suppressAlerts: true,
  } as Parameters<typeof apiFetch>[1]);
}

async function listThreads(artifactType: string, artifactId: string): Promise<Thread[]> {
  const params = new URLSearchParams({ artifact_type: artifactType, artifact_id: artifactId });
  const data = await apiFetch<{ threads: Thread[] }>(
    `/api/v1/conversations?${params}`,
    { suppressAlerts: true } as Parameters<typeof apiFetch>[1],
  );
  return data.threads ?? [];
}

async function getThread(threadId: string): Promise<Thread> {
  return apiFetch<Thread>(
    `/api/v1/conversations/${threadId}`,
    { suppressAlerts: true } as Parameters<typeof apiFetch>[1],
  );
}

async function sendMessage(
  threadId: string,
  content: string,
  debug: boolean,
): Promise<Message> {
  return apiFetch<Message>(`/api/v1/conversations/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ role: "user", content, debug }),
    suppressAlerts: true,
  } as Parameters<typeof apiFetch>[1]);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConversationPanel({ artifactType, artifactId, title, showDebug = false }: Props) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenTotals, setTokenTotals] = useState<TokenMeta | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load existing threads when panel opens
  useEffect(() => {
    if (!open) return;
    listThreads(artifactType, artifactId)
      .then(setThreads)
      .catch(() => setError("Could not load existing conversations."));
  }, [open, artifactType, artifactId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const openThread = useCallback(async (thread: Thread) => {
    setLoading(true);
    setError(null);
    try {
      const full = await getThread(thread.thread_id);
      setActiveThread(full);
      setMessages(full.messages ?? []);
      setTokenTotals(full.token_totals ?? null);
    } catch {
      setError("Failed to load conversation.");
    } finally {
      setLoading(false);
    }
  }, []);

  const startNewThread = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const threadTitle = title ?? `${artifactType}:${artifactId}`;
      const thread = await createThread(artifactType, artifactId, threadTitle);
      setActiveThread(thread);
      setMessages([]);
      setTokenTotals(null);
      setThreads((prev) => [thread, ...prev]);
    } catch {
      setError("Failed to start conversation.");
    } finally {
      setLoading(false);
    }
  }, [artifactType, artifactId, title]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || !activeThread || thinking) return;

    const optimisticMsg: Message = {
      message_id: `tmp-${Date.now()}`,
      thread_id: activeThread.thread_id,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput("");
    setThinking(true);
    setError(null);

    try {
      const assistantMsg = await sendMessage(activeThread.thread_id, content, showDebug);
      setMessages((prev) => [...prev, assistantMsg]);
      if (assistantMsg.token_meta) {
        setTokenTotals((prev) => ({
          input_tokens: (prev?.input_tokens ?? 0) + (assistantMsg.token_meta?.input_tokens ?? 0),
          output_tokens: (prev?.output_tokens ?? 0) + (assistantMsg.token_meta?.output_tokens ?? 0),
          total_tokens: (prev?.total_tokens ?? 0) + (assistantMsg.token_meta?.total_tokens ?? 0),
          estimated_cost_usd:
            ((prev?.estimated_cost_usd ?? 0) + (assistantMsg.token_meta?.estimated_cost_usd ?? 0)) || null,
          cost_source: "derived",
        }));
      }
    } catch {
      setError("Failed to get a response. Please try again.");
      // Remove optimistic message
      setMessages((prev) => prev.filter((m) => m.message_id !== optimisticMsg.message_id));
    } finally {
      setThinking(false);
    }
  }, [input, activeThread, showDebug, thinking]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-primary/25 bg-primary-container/30 px-3 py-2 text-xs font-semibold text-on-primary-container hover:bg-primary-container/50 transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">forum</span>
        Ask follow-up
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-outline-variant/10 px-4 py-3 bg-surface-container">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]">forum</span>
          <span className="text-sm font-semibold text-on-surface">
            {activeThread ? (activeThread.title ?? "Conversation") : "Follow-up Questions"}
          </span>
          {activeThread && (
            <span className="rounded-full bg-primary-container px-1.5 py-0.5 text-[10px] font-bold text-on-primary-container">
              {messages.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeThread && (
            <button
              type="button"
              onClick={() => { setActiveThread(null); setMessages([]); setTokenTotals(null); }}
              className="text-[11px] text-on-surface-variant hover:text-primary"
            >
              ← All threads
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      {/* Thread list */}
      {!activeThread && (
        <div className="p-4 space-y-2">
          <button
            type="button"
            onClick={startNewThread}
            disabled={loading}
            className="w-full rounded-lg border border-primary/25 bg-primary-container/30 px-3 py-2 text-xs font-semibold text-on-primary-container hover:bg-primary-container/50 transition-colors flex items-center gap-2 justify-center disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">add_comment</span>
            {loading ? "Starting…" : "Start new conversation"}
          </button>

          {threads.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-wider text-on-surface-variant mt-3">Recent threads</p>
              {threads.map((t) => (
                <button
                  key={t.thread_id}
                  type="button"
                  onClick={() => openThread(t)}
                  className="w-full text-left rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 hover:border-outline-variant/40 transition-colors"
                >
                  <p className="text-xs font-semibold text-on-surface truncate">
                    {t.title ?? `Thread ${t.thread_id.slice(0, 8)}`}
                  </p>
                  <p className="text-[10px] text-on-surface-variant">{t.message_count} messages</p>
                </button>
              ))}
            </>
          )}

          {threads.length === 0 && !loading && (
            <p className="text-center text-xs text-on-surface-variant py-4">
              No conversations yet. Start one above.
            </p>
          )}

          {error && <p className="text-xs text-error">{error}</p>}
        </div>
      )}

      {/* Active thread */}
      {activeThread && (
        <>
          {/* Messages */}
          <div
            ref={scrollRef}
            className="h-80 overflow-y-auto p-4 space-y-4 bg-surface"
          >
            {messages.length === 0 && (
              <p className="text-center text-xs text-on-surface-variant py-8">
                Ask anything about this {artifactType} record.
              </p>
            )}

            {messages.map((msg) => (
              <div key={msg.message_id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-low border border-outline-variant/20 text-on-surface"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>

                {msg.role === "assistant" && (
                  <div className="mt-1 ml-1 flex flex-col gap-1">
                    {msg.token_meta && (
                      <TokenCostBadge tokenMeta={msg.token_meta} compact />
                    )}
                    {showDebug && msg.debug_meta && (
                      <DebugDrawer debugMeta={msg.debug_meta} />
                    )}
                    <FeedbackButtons
                      targetType="message"
                      targetId={msg.message_id}
                      threadId={msg.thread_id}
                      modelProvider={msg.token_meta?.provider ?? undefined}
                      modelName={msg.token_meta?.model ?? undefined}
                      artifactType={artifactType}
                      artifactId={artifactId}
                    />
                  </div>
                )}
              </div>
            ))}

            {thinking && (
              <div className="flex items-start">
                <div className="bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3">
                  <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                    Thinking…
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Token totals strip */}
          {tokenTotals && tokenTotals.total_tokens > 0 && (
            <div className="border-t border-outline-variant/10 px-4 py-1.5 bg-surface-container-lowest">
              <TokenCostBadge tokenMeta={tokenTotals} compact />
            </div>
          )}

          {error && (
            <div className="px-4 py-1.5 border-t border-error/20 bg-error-container/10">
              <p className="text-xs text-error">{error}</p>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-outline-variant/10 p-3 bg-surface-container">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up question… (Enter to send, Shift+Enter for newline)"
                rows={2}
                maxLength={8000}
                disabled={thinking}
                className="flex-1 resize-none rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || thinking}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
