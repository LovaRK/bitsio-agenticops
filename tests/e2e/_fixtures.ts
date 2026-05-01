export const telemetryMock = {
  summary: {
    roi_score: 62,
    gainscope: 57,
    total_annual_spend_usd: 1250000,
    total_potential_savings_usd: 220000,
    low_value_spend_usd: 310000,
    total_daily_volume_gb: 178.4,
    total_sourcetypes_assessed: 42,
    avg_utilization_score: 54,
    avg_detection_score: 48,
    avg_quality_score: 81,
    security_gap_count: 4,
    resolution_confidence: 0.87,
  },
  sources: [
    { sourcetype: 'app:payments', tier: 'Important', utilization_score: 68, detection_score: 42, quality_score: 89, annual_cost_usd: 210000, potential_savings_usd: 36000, detection_gap: true, confidence: 0.91 },
    { sourcetype: 'infra:cpu', tier: 'Wasteful', utilization_score: 17, detection_score: 21, quality_score: 74, annual_cost_usd: 96000, potential_savings_usd: 40000, confidence: 0.82 },
  ],
  security_findings: [{ id: 'sf-1', finding_type: 'mitre_gap', severity: 'medium', sourcetype: 'app:payments' }],
  savings_projection: [{ stage: 'Current', annual_cost_usd: 1250000 }, { stage: 'Optimized', annual_cost_usd: 1030000, savings_usd: 220000 }],
  query_context: { used_live_data: true, adapter_mode: 'auto', fetched_at: new Date().toISOString(), latency_ms: 120, confidence: 0.9, query_method: 'live' },
};

export const agentStateMock = {
  id: 'agent-telemetry-v1',
  name: 'Telemetry Optimization Agent',
  version: 'v1.3',
  status: 'active',
  mode: 'approval_required',
  autonomyLevel: 'approval_gated',
  currentGoal: 'Optimize telemetry cost without degrading detection coverage',
  lastDecisionAt: new Date().toISOString(),
  confidence: 0.92,
  workspace: {
    id: 'demo',
    name: 'Demo Customer',
    customerName: 'Demo Customer',
    environment: 'demo',
    splunkInstanceLabel: 'splunk-demo-main',
    complianceTags: ['SOC2'],
  },
};
