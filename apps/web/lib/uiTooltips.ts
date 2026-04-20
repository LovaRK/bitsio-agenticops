export const TOOLTIP = {
  dashboard: {
    activeIncidents: "Number of active incidents detected from live telemetry.",
    pendingApprovals: "Decisions waiting for human review before action is taken.",
    modelConfidence: "Average confidence score across current AI-generated recommendations.",
    runtimeStatus: "Current agent runtime mode and last health check.",
    annualSpend: "Estimated annual cost based on current ingest and retention.",
    potentialSavings: "Savings opportunity if recommended optimizations are applied.",
    utilization: "How efficiently your current telemetry and compute are being used.",
    securityGaps: "Detected coverage gaps and misconfigurations impacting security posture.",
  },
  incidents: {
    row: "Click to view full incident reasoning, evidence, and actions.",
    filters: "Show or hide filter controls for incidents.",
    severity: "Impact level based on telemetry, blast radius, and business rules.",
    status: "Current lifecycle state of this incident.",
    evidence: "Raw events and signals retrieved from Splunk and other sources.",
    correlation: "How related events were grouped into a single incident.",
    reasoning: "AI reasoning steps used to reach this conclusion.",
    confidence: "Model confidence in this recommendation, from 0 to 100%.",
    policy: "Validation against governance and approval policies.",
  },
  approvals: {
    approve: "Approve to finalize this recommendation and write an immutable audit entry.",
    reject: "Reject this recommendation and provide feedback for future tuning.",
    note: "Optional comment explaining your decision for audit and learning.",
  },
  monitoring: {
    uptime: "Percentage of time the AgenticOps runtime has been healthy.",
    latency: "Average response time for agent workflows.",
    activeNodes: "Number of active runtime nodes participating in workflows.",
    runtimeHealth: "Aggregated health status across runtime components.",
    howCalculated: "Formula and data sources used to produce this metric.",
  },
  fraud: {
    riskScore: "Composite risk score from payment, identity, and approval anomalies.",
    activeCases: "Number of fraud investigations currently in progress.",
    policy: "How this case aligns with fraud and compliance policies.",
    explainability: "Why this case was flagged and which signals contributed most.",
  },
  settings: {
    mode: "Switch between local and cloud runtime modes.",
    testConnections: "Run a quick health check against configured backends.",
    apply: "Apply configuration changes for this environment.",
  },
} as const;

