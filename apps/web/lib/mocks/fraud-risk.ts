export type FraudSignal = {
  id: string;
  ts: string;
  entity: string;
  signal: string;
  score: number;
  status: "open" | "triage" | "approved" | "blocked";
};

export type DecisionStep = {
  id: string;
  node: string;
  outcome: string;
  latencyMs: number;
  confidenceImpact: number;
  approvalRequired: boolean;
};

export const fraudInitialSignals: FraudSignal[] = [
  {
    id: "fr_20260418_1092",
    ts: "2026-04-18T21:42:11Z",
    entity: "vendor:omega-procurement",
    signal: "Payment anomaly + new vendor + privileged override",
    score: 92,
    status: "open",
  },
  {
    id: "fr_20260418_1088",
    ts: "2026-04-18T20:11:04Z",
    entity: "user:finance.ops.17",
    signal: "Disabled account re-activated + unusual approval chain",
    score: 88,
    status: "triage",
  },
  {
    id: "fr_20260418_1074",
    ts: "2026-04-18T18:09:53Z",
    entity: "payment_batch:Q2-AP-778",
    signal: "Amount deviation + identity mismatch",
    score: 79,
    status: "triage",
  },
];

export const fraudDecisionTrace: DecisionStep[] = [
  {
    id: "s1",
    node: "fraud_ingest",
    outcome: "Parsed 42 payment + identity + approval events",
    latencyMs: 42,
    confidenceImpact: 8,
    approvalRequired: false,
  },
  {
    id: "s2",
    node: "entity_correlation",
    outcome: "Linked vendor onboarding with non-standard approver sequence",
    latencyMs: 73,
    confidenceImpact: 26,
    approvalRequired: false,
  },
  {
    id: "s3",
    node: "risk_scoring",
    outcome: "Composite risk score 0.92 (high)",
    latencyMs: 37,
    confidenceImpact: 24,
    approvalRequired: false,
  },
  {
    id: "s4",
    node: "policy_gate",
    outcome: "CFO approval required before containment action",
    latencyMs: 20,
    confidenceImpact: 10,
    approvalRequired: true,
  },
  {
    id: "s5",
    node: "final_recommendation",
    outcome: "Recommend temporary payment hold + account quarantine",
    latencyMs: 29,
    confidenceImpact: 12,
    approvalRequired: true,
  },
];

export const fraudPrompts = [
  {
    title: "Prompt 1 — Graph + State",
    body: `Implement FraudRiskAgentGraph in packages/agent-core using node pattern from Telemetry Value Agent.\n\nRequirements:\n- Nodes: fraud_ingest -> evidence_retrieval -> entity_correlation -> reasoning_draft -> risk_score -> policy_gate -> final_response\n- All state typed via Pydantic\n- Propose-only actions (no autonomous execution)\n- Output decision trace-compatible payload\n\nDone when:\n- Unit tests cover each node with fixtures\n- Graph run emits deterministic workflow_id`,
  },
  {
    title: "Prompt 2 — API + DTO",
    body: `Add fraud endpoints in apps/api:\n- POST /api/v1/fraud/analyze\n- POST /api/v1/fraud/analyze/live\n- GET /api/v1/fraud/demo\n\nRequirements:\n- require_analyst auth\n- tenant-safe request handling\n- decision trace persistence hook\n\nDone when:\n- TestClient tests pass for all endpoints\n- No network calls in unit tests`,
  },
  {
    title: "Prompt 3 — UI + Explainability",
    body: `Create /fraud-risk route in apps/web.\n\nRequirements:\n- Tabs: Backstory, Live Dashboard, Decision Trace, MCP -> Splunk, Build Plan, Agent Prompts\n- Live simulation button adds one case to dashboard\n- Decision gate supports approve/reject visual transition\n- Show audit/metric provenance labels\n\nDone when:\n- Page renders in mock and live modes\n- Playwright smoke test passes`,
  },
  {
    title: "Prompt 4 — Security + Governance",
    body: `Add governance metadata panel:\n- data classification\n- compliance framework\n- encryption requirement\n- policy id/version/rule\n\nRequirements:\n- Align with docs/security threat model\n- Keep immutable approval events\n\nDone when:\n- docs updated\n- policy endpoint tests green`,
  },
];

export const mcpPayloadExample = {
  tenant_id: "tenant_demo",
  workflow_id: "wf_fraud_20260418_1092",
  mode: "mcp",
  index: "tutorial",
  search_query:
    'index="tutorial" (payment OR approval OR identity) earliest=-24h latest=now | stats count by user,vendor,approval_chain,amount_deviation',
  data_quality: {
    completeness_score: 0.97,
    freshness_seconds: 84,
    accuracy_confidence: 0.94,
    validation_passed: true,
  },
};

export const buildPlanSteps = [
  "git checkout main && git merge develop",
  "git checkout -b feature/fraud-risk-agent",
  "Implement graph + API + web tabs + fixtures",
  "Run: make test && pnpm --filter web lint",
  "Merge feature -> develop",
  "Release merge develop -> main",
];
