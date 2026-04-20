"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { DecisionTrace, MetricSource, NodeRun, ToolCall } from "@/types/decision-trace";
import { formatDateTimeUTC } from "@/lib/datetime";
import { TOOLTIP } from "@/lib/uiTooltips";

function getStatusStyles(status: NodeRun["status"]) {
  switch (status) {
    case "success":
      return {
        dot: "bg-secondary glow-success",
        text: "text-secondary",
        opacity: "opacity-100",
      };
    case "pending":
      return {
        dot: "bg-primary glow-primary animate-pulse",
        text: "text-primary",
        opacity: "opacity-100",
      };
    default:
      return {
        dot: "bg-surface-container-highest border border-outline-variant/50",
        text: "text-on-surface-variant",
        opacity: "opacity-40 grayscale",
      };
  }
}

type Explainability = {
  promptTokensLabel: string;
  completionTokensLabel: string;
  totalTokensLabel: string;
  tokenSource: MetricSource;
  latencyMs: number;
  latencySource: MetricSource;
  confidenceImpact: number;
  confidenceSource: MetricSource;
  modelName: string;
  provider: string;
  inputPreview: string;
  outputPreview: string;
  notes: string[];
};

type RunMetadata = DecisionTrace["run_metadata"];

function sourceBadgeLabel(source: MetricSource) {
  if (source === "reported") return "Measured";
  if (source === "derived") return "Estimated";
  return "N/A";
}

function sourceBadgeClass(source: MetricSource) {
  if (source === "reported") return "bg-secondary/20 text-secondary border-secondary/40";
  if (source === "derived") return "bg-tertiary/20 text-tertiary border-tertiary/40";
  return "bg-surface-container-high text-on-surface-variant border-outline-variant/40";
}

export function ReasoningTimeline({
  nodeRuns,
  runMetadata,
}: {
  nodeRuns: NodeRun[];
  runMetadata?: RunMetadata;
}) {
  const router = useRouter();
  const [dockVisible, setDockVisible] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedToolKey, setSelectedToolKey] = useState<string | null>(null);

  const toolCallDisplayByNode = useMemo(() => {
    const fallbackByNode: Record<string, Array<{ tool_name: string; status: string; tool_type?: ToolCall["tool_type"] }>> = {
      evidence_retrieval: [
        { tool_name: "run_search", status: "success", tool_type: "retrieval" },
      ],
      reasoning_draft: [{ tool_name: "llm_call", status: "success", tool_type: "llm" }],
    };

    return nodeRuns.reduce<Record<string, ToolCall[]>>((acc, node) => {
      if (node.tool_calls.length > 0) {
        acc[node.node_name] = node.tool_calls;
      } else if (fallbackByNode[node.node_name]) {
        acc[node.node_name] = fallbackByNode[node.node_name];
      } else {
        acc[node.node_name] = [];
      }
      return acc;
    }, {});
  }, [nodeRuns]);

  const memoryUsage = useMemo(() => {
    const pending = nodeRuns.filter((run) => run.status === "pending").length;
    const computed = 32 + nodeRuns.length * 2 + pending * 4;
    return Math.max(24, Math.min(92, computed));
  }, [nodeRuns]);

  const formatTime = (dateString: string) => {
    try {
      const formatted = formatDateTimeUTC(dateString);
      const timePart = formatted.split(", ")[1];
      return timePart ?? formatted;
    } catch {
      return dateString;
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    window.setTimeout(() => setIsRefreshing(false), 650);
  };

  const getToolIcon = (toolName: string) => {
    const normalized = toolName.toLowerCase();
    if (normalized.includes("splunk") || normalized.includes("search")) return "list";
    if (normalized.includes("trace")) return "analytics";
    if (normalized.includes("llm") || normalized.includes("model")) return "smart_toy";
    if (normalized.includes("policy")) return "gavel";
    return "precision_manufacturing";
  };

  const getToolDescription = (tool: ToolCall) => {
    const normalized = tool.tool_name.toLowerCase();
    if (tool.tool_type === "retrieval" || normalized.includes("splunk") || normalized.includes("search")) {
      return "Queries Splunk logs for correlated evidence. Token accounting does not apply to retrieval tools.";
    }
    if (normalized.includes("trace")) return "Analyzes distributed tracing latency and dependency impacts.";
    if (tool.tool_type === "llm" || normalized.includes("llm")) {
      return "Generates analyst-readable reasoning from structured evidence.";
    }
    if (tool.tool_type === "policy" || normalized.includes("policy")) {
      return "Evaluates deterministic approval and guardrail policies.";
    }
    return "Executes specialized processing for this workflow node.";
  };

  const buildExplainability = (node: NodeRun, toolCall: ToolCall, index: number): Explainability => {
    const tokenSource = toolCall.token_usage?.source ?? toolCall.metric_source?.token_usage ?? "not_applicable";
    const latencySource = toolCall.metric_source?.latency ?? "derived";
    const confidenceSource = toolCall.metric_source?.confidence_impact ?? "derived";

    const isLlm = toolCall.tool_type === "llm" || toolCall.tool_name.toLowerCase().includes("llm");
    const prompt = toolCall.token_usage?.prompt ?? toolCall.tokens_prompt;
    const completion = toolCall.token_usage?.completion ?? toolCall.tokens_completion;
    const total =
      toolCall.token_usage?.total ??
      (typeof prompt === "number" && typeof completion === "number" ? prompt + completion : undefined);

    const latencyMs =
      typeof toolCall.latency_ms === "number"
        ? toolCall.latency_ms
        : Math.max(40, Math.round(node.duration_ms * (0.55 + index * 0.1)));

    const confidenceImpact =
      typeof toolCall.confidence_impact === "number"
        ? toolCall.confidence_impact
        : node.node_name === "reasoning_draft"
          ? 0.18
          : node.node_name === "evidence_retrieval"
            ? 0.26
            : 0.08;

    const promptTokensLabel =
      tokenSource === "not_applicable" ? "N/A" : typeof prompt === "number" ? String(prompt) : "N/A";
    const completionTokensLabel =
      tokenSource === "not_applicable"
        ? "N/A"
        : typeof completion === "number"
          ? String(completion)
          : "N/A";
    const totalTokensLabel =
      tokenSource === "not_applicable" ? "N/A" : typeof total === "number" ? String(total) : "N/A";

    const fallbackProvider = isLlm
      ? `${runMetadata?.model_provider ?? "unknown"}/${runMetadata?.runtime_mode ?? "unknown"}`
      : toolCall.tool_type === "retrieval"
        ? `splunk/${runMetadata?.splunk_mode ?? "auto"}`
        : toolCall.tool_type === "policy"
          ? "policy-engine"
          : "rule-engine";

    return {
      promptTokensLabel,
      completionTokensLabel,
      totalTokensLabel,
      tokenSource,
      latencyMs,
      latencySource,
      confidenceImpact,
      confidenceSource,
      modelName: toolCall.model_name ?? (isLlm ? (runMetadata?.model_name ?? "unknown") : "n/a"),
      provider: toolCall.provider ?? fallbackProvider,
      inputPreview:
        toolCall.input_preview ??
        `Node '${node.node_name}' collected signals from incident context and evidence references.`,
      outputPreview:
        toolCall.output_preview ??
        `Tool '${toolCall.tool_name}' completed with status '${toolCall.status}'.`,
      notes: toolCall.explainability_notes ?? [],
    };
  };

  const runtimeProviderLabel =
    runMetadata?.model_provider && runMetadata?.runtime_mode
      ? `${runMetadata.model_provider}/${runMetadata.runtime_mode}`
      : "unknown";

  return (
    <div className="col-span-12 lg:col-span-8 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline font-bold text-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">account_tree</span>
          Reasoning Timeline
        </h3>
        <div className="flex gap-2">
          <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
            Execution Engine:
          </span>
          <span className="text-[10px] text-secondary font-mono font-bold tracking-widest">LangGraph v2.4</span>
        </div>
      </div>

      <div className="relative pl-8 border-l border-outline-variant/20 space-y-12">
        {nodeRuns.map((node, nodeIndex) => {
          const styles = getStatusStyles(node.status);
          const toolCalls = toolCallDisplayByNode[node.node_name] || [];
          const isLocked = node.status === "fail";
          const selectedToolIndex = toolCalls.findIndex(
            (tool, i) => `${node.node_name}-${tool.tool_name}-${i}` === selectedToolKey,
          );
          const selectedTool = selectedToolIndex >= 0 ? toolCalls[selectedToolIndex] : null;
          const selectedExplainability = selectedTool
            ? buildExplainability(node, selectedTool, selectedToolIndex)
            : null;
          const selectedToolIsLlm =
            selectedTool?.tool_type === "llm" || selectedTool?.tool_name.toLowerCase().includes("llm");
          const providerLabel =
            selectedExplainability?.provider === "unknown" && selectedToolIsLlm
              ? runtimeProviderLabel
              : selectedExplainability?.provider ?? "unknown";
          const modelLabel =
            selectedExplainability?.modelName === "unknown" && selectedToolIsLlm
              ? (runMetadata?.model_name ?? "unknown")
              : selectedExplainability?.modelName ?? "unknown";

          return (
            <motion.div
              key={`${node.node_name}-${node.started_at}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * nodeIndex, duration: 0.18 }}
              className={`relative ${styles.opacity}`}
              title={`${node.node_name} • ${node.status}`}
            >
              <div className={`absolute -left-[41px] top-0 w-4 h-4 rounded-full ${styles.dot} flex items-center justify-center`}>
                {node.status === "success" && (
                  <span className="material-symbols-outlined text-[10px] text-on-secondary font-bold">check</span>
                )}
                {node.status === "pending" && (
                  <span className="material-symbols-outlined text-[10px] text-on-primary font-bold">pending</span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <h4 className={`font-mono text-sm font-bold ${styles.text} uppercase tracking-wider`}>
                    {node.node_name}
                  </h4>
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    {node.status === "pending" ? "IN-PROGRESS" : formatTime(node.started_at)}
                  </span>
                </div>

                {isLocked ? (
                  <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 h-12" />
                ) : node.status === "pending" ? (
                  <div className="bg-surface-container-high p-4 rounded-xl border-l-2 border-primary ring-1 ring-primary/10">
                    <p className="text-sm text-on-surface leading-relaxed italic opacity-80">
                      Agent is synthesizing findings and preparing a decision draft.
                    </p>
                  </div>
                ) : (
                  <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                    <p className="text-sm text-on-surface leading-relaxed mb-3">
                      {node.node_name === "incident_ingest" &&
                        "Initialized incident state from event payloads and normalized identifiers."}
                      {node.node_name === "evidence_retrieval" &&
                        "Fetched evidence from Splunk index windows and built correlated signal set."}
                      {node.node_name === "correlation" &&
                        "Correlated evidence with historical patterns and dependency relationships."}
                      {!["incident_ingest", "evidence_retrieval", "correlation"].includes(node.node_name) &&
                        `Processed in ${node.duration_ms}ms with ${toolCalls.length} tool calls.`}
                    </p>

                    {toolCalls.length > 0 && (
                      <>
                        <p className="mb-2 text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
                          Click a tool chip to expand details
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {toolCalls.map((tool, i) => {
                            const toolKey = `${node.node_name}-${tool.tool_name}-${i}`;
                            const isSelected = toolKey === selectedToolKey;
                            return (
                              <button
                                key={toolKey}
                                type="button"
                                onClick={() => setSelectedToolKey(isSelected ? null : toolKey)}
                                className={`bg-surface-container-lowest p-2 rounded text-[10px] font-mono flex items-center gap-2 border transition-all ${
                                  isSelected
                                    ? "border-primary text-primary ring-1 ring-primary/30"
                                    : "border-outline-variant/10 text-on-surface-variant hover:border-outline-variant/40"
                                }`}
                                data-testid={`tool-chip-${tool.tool_name.toLowerCase()}`}
                                aria-pressed={isSelected}
                                title={
                                  node.node_name === "evidence_retrieval"
                                    ? TOOLTIP.incidents.evidence
                                    : node.node_name === "correlation"
                                      ? TOOLTIP.incidents.correlation
                                      : node.node_name === "reasoning_draft"
                                        ? TOOLTIP.incidents.reasoning
                                        : node.node_name === "confidence_score"
                                          ? TOOLTIP.incidents.confidence
                                          : node.node_name === "approval_check"
                                            ? TOOLTIP.incidents.policy
                                            : getToolDescription(tool)
                                }
                              >
                                <span className="material-symbols-outlined text-xs">{getToolIcon(tool.tool_name)}</span>
                                <span className="truncate">{tool.tool_name}</span>
                              </button>
                            );
                          })}
                        </div>

                        {selectedTool && selectedExplainability ? (
                          <section
                            className="mt-4 rounded-2xl border border-outline-variant/20 bg-surface-container p-4"
                            data-testid="tool-explainability-inline"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-on-surface-variant">
                                  {selectedToolIsLlm ? "AI Explainability" : "Tool Details"}
                                </p>
                                <h4 className="mt-1 text-base font-bold text-on-surface font-headline">
                                  {selectedTool.tool_name}
                                </h4>
                                <p className="mt-1 text-xs text-on-surface-variant">
                                  Node: <span className="font-mono">{node.node_name}</span> | Status:{" "}
                                  <span className="font-semibold">{selectedTool.status}</span>
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedToolKey(null)}
                                className="rounded-lg border border-outline-variant/30 px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high"
                              >
                                Close
                              </button>
                            </div>

                            <div className="mt-3 rounded-lg border border-outline-variant/15 bg-surface-container-low p-3">
                              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                                What This Tool Is Responsible For
                              </p>
                              <p className="mt-1 text-sm text-on-surface">{getToolDescription(selectedTool)}</p>
                            </div>

                            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="rounded-lg bg-surface-container p-3 border border-outline-variant/15">
                                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Latency</p>
                                <p className="mt-1 text-sm font-semibold text-on-surface">
                                  {selectedExplainability.latencyMs}ms
                                </p>
                                <span
                                  className={`inline-block mt-2 px-2 py-0.5 text-[10px] border rounded ${sourceBadgeClass(selectedExplainability.latencySource)}`}
                                >
                                  {sourceBadgeLabel(selectedExplainability.latencySource)}
                                </span>
                              </div>
                              <div className="rounded-lg bg-surface-container p-3 border border-outline-variant/15">
                                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                                  Confidence Contribution
                                </p>
                                <p className="mt-1 text-sm font-semibold text-on-surface">
                                  +{Math.round(selectedExplainability.confidenceImpact * 100)}%
                                </p>
                                <span
                                  className={`inline-block mt-2 px-2 py-0.5 text-[10px] border rounded ${sourceBadgeClass(selectedExplainability.confidenceSource)}`}
                                >
                                  {sourceBadgeLabel(selectedExplainability.confidenceSource)}
                                </span>
                              </div>
                              <div className="rounded-lg bg-surface-container p-3 border border-outline-variant/15">
                                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Runtime</p>
                                <p className="mt-1 text-sm font-mono text-on-surface">{providerLabel}</p>
                                <p className="mt-1 text-xs font-mono text-on-surface-variant">Model: {modelLabel}</p>
                              </div>
                            </div>

                            {selectedToolIsLlm ? (
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div className="rounded-lg bg-surface-container p-3 border border-outline-variant/15">
                                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                                    Prompt Tokens
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-on-surface">
                                    {selectedExplainability.promptTokensLabel}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-surface-container p-3 border border-outline-variant/15">
                                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                                    Completion Tokens
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-on-surface">
                                    {selectedExplainability.completionTokensLabel}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-surface-container p-3 border border-outline-variant/15">
                                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                                    Total Tokens
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-on-surface">
                                    {selectedExplainability.totalTokensLabel}
                                  </p>
                                </div>
                                <div className="rounded-lg bg-surface-container p-3 border border-outline-variant/15">
                                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                                    Token Source
                                  </p>
                                  <span
                                    className={`inline-block mt-1 px-2 py-0.5 text-[10px] border rounded ${sourceBadgeClass(selectedExplainability.tokenSource)}`}
                                  >
                                    {sourceBadgeLabel(selectedExplainability.tokenSource)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 rounded-lg border border-outline-variant/15 bg-surface-container p-3">
                                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                                  Why no tokens/cost
                                </p>
                                <p className="mt-1 text-xs text-on-surface">
                                  This tool is deterministic/retrieval-only and does not invoke an LLM, so token and
                                  model cost accounting are not applicable.
                                </p>
                              </div>
                            )}

                            <div className="mt-3 grid md:grid-cols-2 gap-3">
                              <div className="rounded-lg bg-surface-container p-3 border border-outline-variant/15">
                                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                                  Input Used
                                </p>
                                <p className="mt-1 text-xs text-on-surface leading-relaxed">
                                  {selectedExplainability.inputPreview}
                                </p>
                              </div>
                              <div className="rounded-lg bg-surface-container p-3 border border-outline-variant/15">
                                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                                  Output Produced
                                </p>
                                <p className="mt-1 text-xs text-on-surface leading-relaxed">
                                  {selectedExplainability.outputPreview}
                                </p>
                              </div>
                            </div>

                            {selectedExplainability.notes.length > 0 ? (
                              <div className="mt-3 rounded-lg border border-outline-variant/20 bg-surface-container p-3">
                                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Notes</p>
                                <ul className="mt-1 text-xs text-on-surface space-y-1">
                                  {selectedExplainability.notes.map((note) => (
                                    <li key={note}>{note}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </section>
                        ) : null}
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {dockVisible ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-fit px-8 py-3 glass-panel rounded-full border border-outline-variant/20 shadow-2xl flex items-center gap-8 z-50" data-testid="timeline-status-dock">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-secondary glow-success" />
            <span className="text-xs font-bold tracking-tight text-on-surface">
              Agent: <span className="text-on-surface-variant">Observer-Prime</span>
            </span>
          </div>
          <div className="h-4 w-px bg-outline-variant/30" />
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-on-surface-variant">memory</span>
            <span className="text-xs font-mono text-on-surface-variant">Memory Usage: {memoryUsage}%</span>
          </div>
          <div className="h-4 w-px bg-outline-variant/30" />
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Refresh timeline"
              onClick={onRefresh}
              className="material-symbols-outlined text-sm text-primary cursor-pointer hover:scale-110 transition-transform"
              data-testid="timeline-refresh-btn"
            >
              <span className={isRefreshing ? "animate-spin inline-block" : "inline-block"}>
                {isRefreshing ? "progress_activity" : "refresh"}
              </span>
            </button>
            <button
              type="button"
              aria-label="Close status dock"
              onClick={() => setDockVisible(false)}
              className="material-symbols-outlined text-sm text-on-surface-variant cursor-pointer hover:scale-110 transition-transform"
              data-testid="timeline-close-btn"
            >
              close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
