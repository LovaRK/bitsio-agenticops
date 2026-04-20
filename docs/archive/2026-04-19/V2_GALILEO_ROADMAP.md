# V2 Roadmap (Galileo-Aligned)

Reference: Cisco announcement on intent to acquire Galileo (April 9, 2026), focused on AI trust, observability, guardrails, and full ADLC visibility.

## V2 Outcome Targets
- Add agent-quality observability beyond latency/error.
- Add full ADLC evaluation loops from prompt/model selection to production monitoring.
- Add real-time guardrails and failure detection signals.
- Add cost/usage/ROI telemetry at tenant/workflow/model granularity.
- Add multi-agent run lineage and cross-agent dependency visibility.

## Planned Capability Areas
1. Quality Metrics Pipeline
- Add per-run quality envelope:
  - factuality score
  - safety/policy score
  - hallucination risk score
  - output quality grade
- Persist quality envelope on each decision trace.

2. ADLC Evaluations
- Add benchmark suites for:
  - normal incidents
  - adversarial incidents
  - drift scenarios
- Gate CI and release using thresholds per metric, not pass/fail only.

3. Runtime Guardrails
- Add production runtime checks:
  - unsafe action patterns
  - policy violation patterns
  - anomalous agent behavior drift
- Expose guardrail breach events in UI timeline.

4. Cost and ROI Observability
- Capture model usage and cost telemetry:
  - token usage
  - cost per workflow
  - cost per tenant
- Join with incident outcomes to measure ROI.

5. Multi-Agent Observability
- Add run lineage model:
  - parent/child run links
  - inter-agent handoff markers
  - aggregated run health score

## Proposed V2 Contracts to Add
- Decision trace extension:
  - `quality_metrics`
  - `guardrail_breaches`
  - `usage_cost`
  - `agent_lineage`
- Evaluation API:
  - `POST /api/v2/evaluations/run`
  - `GET /api/v2/evaluations/{run_id}`

## Exit Criteria for V2
- Quality regression gates active in CI.
- Runtime guardrail events visible in UI.
- Cost/usage telemetry queryable by tenant/workflow.
- Multi-agent lineage rendered in incident detail view.

