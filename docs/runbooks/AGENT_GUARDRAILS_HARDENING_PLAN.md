# Agent Guardrails Hardening Plan (DefenseClaw Lessons -> BitsIO)

## Purpose
Define production guardrails to prevent runaway retries, uncontrolled token spend, weak prompt safety, and hidden adapter behavior.

## Mapping (Confirmed)
| DefenseClaw Lesson | BitsIO Feature |
|---|---|
| Agents retried endlessly | Circuit breakers + retry caps |
| $50 burned overnight | Cost guards + token limits |
| Logging saved the day | Full LLM + Splunk query logging |
| Prompt security blocked bad inputs | Prompt safety filters |
| Cron jobs kept running | Runtime kill-switch + safe fallback |
| MCP loops caused cost | Deterministic workloads route to native |

## Scope and Priority
Implementation priority:
1. Circuit breaker + retry caps
2. Token/cost guardrails
3. Runtime kill-switch
4. Prompt safety filters
5. Expanded telemetry logging
6. Adapter enforcement visibility

## Design Contract

### 1) Circuit Breaker and Retry Caps
- Add per-workflow max retries (`MAX_WORKFLOW_RETRIES`, default 3).
- Add per-step max retries (`MAX_STEP_RETRIES`, default 2).
- Breaker states:
  - `closed`: normal
  - `open`: fail-fast for cooldown period
  - `half_open`: allow one probe request
- Breaker key granularity:
  - `tenant + workflow_type + adapter_mode`

Expected behavior:
- On repeated failures, reject new executions immediately with explicit breaker-open error.

### 2) Token and Cost Guardrails
- Add per-workflow token budget (`MAX_WORKFLOW_TOKENS`).
- Add per-day tenant budget (`MAX_TENANT_DAILY_TOKENS`, `MAX_TENANT_DAILY_COST_USD`).
- On threshold breach:
  - switch workflow to safe fallback response
  - emit high-severity alert
  - require manual approval/reset

### 3) Runtime Kill-Switch
- Add config flag: `AGENT_EXECUTION_ENABLED`.
- Check at:
  - workflow entry
  - before each LLM/tool step
- If false:
  - no new step execution
  - return explicit maintenance/safe-mode message

### 4) Prompt Safety Filters
- Pre-model validation stage:
  - prompt injection indicators
  - data-exfiltration patterns
  - privilege-escalation requests
- For blocked prompts:
  - do not call model
  - return policy-block result
  - log normalized reason code

### 5) Full LLM + Splunk Query Logging
- For each step, log:
  - `workflow_id`, `node_name`, `step_name`
  - `adapter_mode`, `resolved_backend`
  - `prompt_hash` (not raw secret prompt content)
  - tokens prompt/completion/total
  - estimated/reported cost
  - retry_count
  - duration_ms
  - outcome
- Splunk query logs:
  - query id
  - query hash
  - query window
  - execution status
  - result cardinality

### 6) Deterministic Routing Enforcement
- For deterministic workloads:
  - force native on `auto`
  - allow MCP only with explicit override
- Expose in API/UI:
  - configured mode
  - resolved mode
  - backend
  - fallback reason (if any)

## Test Plan (QA)

### A. Retry and Breaker
1. Trigger repeated adapter failures.
2. Verify breaker opens after threshold.
3. Verify new requests fail-fast until cooldown.
4. Verify half-open probe then close/open transition.

### B. Budget Controls
1. Simulate token accumulation above limit.
2. Verify execution stops with budget-exceeded reason.
3. Verify alert emitted and status persisted.

### C. Kill-Switch
1. Set `AGENT_EXECUTION_ENABLED=false`.
2. Verify no new workflow starts.
3. Verify in-flight workflow halts at next check point.

### D. Prompt Safety
1. Send known injection/exfiltration patterns.
2. Verify model call is skipped.
3. Verify policy block event logged with reason code.

### E. Logging Completeness
1. Run one full workflow.
2. Verify every step writes log row with required fields.
3. Verify Splunk query logs include adapter metadata.

### F. Adapter Enforcement
1. Run deterministic endpoint with `SPLUNK_ADAPTER_MODE=auto`.
2. Verify resolved backend is `native`.
3. Force `mcp`, verify override takes effect and is visible.

## Rollout
Phase 1 (safe): logging + metadata + read-only guardrail metrics  
Phase 2 (enforce): retry caps + breaker + kill-switch  
Phase 3 (strict): budgets + prompt blocking + hard fail-safe

## Owner Notes
- Keep all operational updates in `docs/SOURCE_OF_TRUTH.md`.
- This runbook is implementation detail for engineering and QA.
