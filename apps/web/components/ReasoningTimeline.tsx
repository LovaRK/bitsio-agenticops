import type { NodeRun } from "@/types/decision-trace";

function getStatusStyles(status: NodeRun["status"]) {
  switch (status) {
    case "success":
      return {
        dot: "bg-secondary glow-success",
        text: "text-secondary",
        icon: "check",
        opacity: "opacity-100"
      };
    case "pending":
      return {
        dot: "bg-primary glow-primary animate-pulse",
        text: "text-primary",
        icon: "pending",
        opacity: "opacity-100"
      };
    default:
      return {
        dot: "bg-surface-container-highest border border-outline-variant/50",
        text: "text-on-surface-variant",
        icon: "",
        opacity: "opacity-40 grayscale"
      };
  }
}

export function ReasoningTimeline({ nodeRuns }: { nodeRuns: NodeRun[] }) {
  // Mock data for tool calls display (in evidence_retrieval node)
  const toolCallsData: Record<string, { tool: string; icon: string }[]> = {
    evidence_retrieval: [
      { tool: "SPLUNK_LOG_EXTRACTOR", icon: "list" },
      { tool: "TRACE_ANALYZER_V4", icon: "analytics" }
    ]
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return dateString;
    }
  };

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

      {/* Timeline Container */}
      <div className="relative pl-8 border-l border-outline-variant/20 space-y-12">
        {nodeRuns.map((node, index) => {
          const styles = getStatusStyles(node.status);
          const toolCalls = toolCallsData[node.node_name] || [];
          const isLocked = node.status === "fail";

          return (
            <div key={`${node.node_name}-${node.started_at}`} className={`relative ${styles.opacity}`}>
              {/* Status Dot */}
              <div className={`absolute -left-[41px] top-0 w-4 h-4 rounded-full ${styles.dot} flex items-center justify-center`}>
                {node.status === "success" && (
                  <span className="material-symbols-outlined text-[10px] text-on-secondary font-bold">check</span>
                )}
                {node.status === "pending" && (
                  <span className="material-symbols-outlined text-[10px] text-on-primary font-bold">pending</span>
                )}
              </div>

              {/* Content */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <h4 className={`font-mono text-sm font-bold ${styles.text} uppercase tracking-wider`}>
                    {node.node_name}
                  </h4>
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    {node.status === "pending" ? "IN-PROGRESS" : formatTime(node.started_at)}
                  </span>
                </div>

                {/* Card Content */}
                {isLocked ? (
                  <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 h-12"></div>
                ) : node.status === "pending" ? (
                  <div className="bg-surface-container-high p-4 rounded-xl border-l-2 border-primary ring-1 ring-primary/10">
                    <p className="text-sm text-on-surface leading-relaxed italic opacity-80">
                      Agent is synthesizing remediation plan based on correlation findings. Draft generated: Increase
                      MaxPoolSize to 1024...
                    </p>
                  </div>
                ) : (
                  <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                    <p className="text-sm text-on-surface leading-relaxed mb-3">
                      {node.node_name === "incident_ingest" &&
                        "Initialized state from PagerDuty webhook. Parsed 4 payload signals and mapped to internal entity IDs."}
                      {node.node_name === "evidence_retrieval" && (
                        <>
                          Found <span className="text-secondary font-bold">12 correlated logs</span> in Splunk and 4
                          trace spans with p99 &gt; 2.5s.
                        </>
                      )}
                      {node.node_name === "correlation" &&
                        "Vector search identifies similarity between current spike and INC-4410 (Redis connection pool exhaustion)."}
                      {!["incident_ingest", "evidence_retrieval", "correlation"].includes(node.node_name) &&
                        `Processed in ${node.duration_ms}ms with ${node.tool_calls.length} tool calls.`}
                    </p>

                    {/* Tool Calls Grid */}
                    {toolCalls.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {toolCalls.map((tool, i) => (
                          <div key={i} className="bg-surface-container-lowest p-2 rounded text-[10px] font-mono text-on-surface-variant flex items-center gap-2">
                            <span className="material-symbols-outlined text-xs">{tool.icon}</span>
                            {tool.tool}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Status Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-fit px-8 py-3 glass-panel rounded-full border border-outline-variant/20 shadow-2xl flex items-center gap-8 z-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-secondary glow-success"></div>
          <span className="text-xs font-bold tracking-tight text-on-surface">
            Agent: <span className="text-on-surface-variant">Observer-Prime</span>
          </span>
        </div>
        <div className="h-4 w-px bg-outline-variant/30"></div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-on-surface-variant">memory</span>
          <span className="text-xs font-mono text-on-surface-variant">Memory Usage: 42%</span>
        </div>
        <div className="h-4 w-px bg-outline-variant/30"></div>
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-sm text-primary cursor-pointer hover:scale-110 transition-transform">
            refresh
          </span>
          <span className="material-symbols-outlined text-sm text-on-surface-variant cursor-pointer hover:scale-110 transition-transform">
            close
          </span>
        </div>
      </div>
    </div>
  );
}
