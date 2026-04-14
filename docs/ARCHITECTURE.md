# BitsIO AgenticOps — Architecture

**Last updated:** 2026-04-13  
**Graph version:** v1.0.0  
**Status:** Phase 8 complete — production hardening

---

## 1. What This Is

BitsIO AgenticOps is an AI-powered observability platform that connects to Splunk, runs an agentic triage workflow, and exposes explainable reasoning timelines with human approval gates. It is **read-only by design** — the agent recommends, humans decide.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / User                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────────┐
│              Next.js 14 Web App  (port 3000)                    │
│  Incident List · Reasoning Timeline · Evidence · Approval UI    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST (JSON)
┌──────────────────────────▼──────────────────────────────────────┐
│              FastAPI REST Server  (port 8001)                   │
│  /incidents  /decision-traces  /approvals  /settings  /health   │
│  RBAC middleware · Rate limiting · OTel instrumentation         │
└────────┬───────────────────────────────────────┬────────────────┘
         │ run()                                  │ upsert/approve
┌────────▼───────────────────────┐    ┌──────────▼───────────────┐
│  LangGraph Agent Core          │    │  Decision Tracing Store   │
│  TelemetryValueAgentGraph      │    │  In-memory (dev)          │
│  7 sequential nodes + OTel     │    │  PostgreSQL+pgvector(prod)│
└────────┬───────────────────────┘    └──────────────────────────┘
         │ run_search()
┌────────▼───────────────────────┐    ┌──────────────────────────┐
│  Splunk Adapter                │    │  Redis 7.2               │
│  SplunkMCPAdapter (mock/mcp)   │    │  Job queue · Rate-limit  │
│  NativeSplunkAdapter (REST)    │    │  cache                   │
└────────┬───────────────────────┘    └──────────────────────────┘
         │
┌────────▼───────────────────────┐
│  Splunk  (mock_mcp or live)    │
│  port 8081 (mock)              │
│  port 8089 (native REST)       │
└────────────────────────────────┘

         ──────── OTel spans to collector (ports 4317/4318) ────────
```

---

## 3. Agent Graph — TelemetryValueAgent

The agent runs as a **7-node sequential LangGraph pipeline**. State flows through a single `TelemetryAgentState` Pydantic model. All nodes are pure functions — they take state, return state, and are testable without an LLM.

| # | Node | What it does | Key output |
|---|------|-------------|-----------|
| 1 | `incident_ingest` | Parse raw incident payload, flag missing required fields | `incident_id`, `missing_evidence` |
| 2 | `evidence_retrieval` | Query Splunk via adapter, convert rows to `EvidenceItem` list | `evidence[]` |
| 3 | `correlation` | Host frequency analysis via Counter, top-3 findings | `correlation_findings[]` |
| 4 | `reasoning_draft` | Load prompt template, call `ModelAdapter.generate()` | `reasoning_draft` |
| 5 | `confidence_score` | Weighted score from evidence volume, correlation, missing penalties | `confidence` (0.0–1.0) |
| 6 | `approval_check` | Evaluate policy rules (YAML), set `approval_required` | `approval_required`, `guardrail_notes[]` |
| 7 | `final_response` | Assemble `TelemetryFinalOutput` if no approval pending, else return `None` | `final_output` |

Every node is wrapped in `node_span()` which emits an OTel span with all 8 required tags.

### Confidence Scoring Formula

```
score = evidence_factor + correlation_factor - missing_penalty
where:
  evidence_factor   = min(len(evidence) / 5.0, 1.0)        → max 1.00
  correlation_factor = min(len(findings) * 0.12, 0.35)     → max 0.35
  missing_penalty   = min(len(missing) * 0.15, 0.60)       → max 0.60
  score             = clamp(score, 0.0, 1.0)
```

### Approval Policy Rules (default.yaml)

| Rule ID | Condition | Threshold | Action |
|---------|-----------|-----------|--------|
| `env-prod-approval` | `environment_is_prod` | — | `require_approval` |
| `low-confidence-approval` | `confidence_below` | 0.70 | `require_approval` |
| `write-action-approval` | `write_action` | — | `require_approval` |

---

## 4. Packages

### packages/agent-core
LangGraph orchestration engine. Contains the 7 nodes, state model, model adapters, and policy evaluator.

- All LLM calls go through `models/adapter.py` — never import `anthropic` or `openai` directly in node code.
- Supports three adapter modes: `AnthropicModelAdapter`, `OllamaModelAdapter`, `StubModelAdapter`.
- Graph version is `v1.0.0` — bump when node signatures change.

### packages/connectors/splunk-mcp
The only path to Splunk data. Exposes a `SplunkAdapter` Protocol:

```python
list_indexes() → list[IndexDTO]
run_search(query, earliest, latest) → SearchResultDTO
get_server_info() → ServerInfoDTO
explain_error(raw_error) → StandardizedErrorDTO
```

Two implementations: `SplunkMCPAdapter` (custom MCP server) and `NativeSplunkAdapter` (Splunk REST API). Selected at runtime via `SPLUNK_ADAPTER_MODE=mcp|native|auto`.

Enforces: redaction of tokens/passwords/queries/credentials, retry (3 attempts, exponential backoff 1–2s + jitter), stable DTO boundary.

### packages/decision-tracing
Every agent run produces an immutable `DecisionTrace` record with a SHA-256 content hash. Approval events are appended (never mutated). Two store backends:

- `InMemoryDecisionTraceStore` — default for local dev and tests.
- `PostgresDecisionTraceStore` — async asyncpg-based, drop-in replacement, activated by `DATABASE_URL` in env.

Schema: `decision_traces` + `node_runs` + `approval_events` tables in PostgreSQL 16 + pgvector.

### packages/shared
Shared infrastructure used by all services:

- `config/settings.py` — Pydantic Settings singleton (`get_settings()`), all env vars in one place.
- `auth/middleware.py` — FastAPI `get_auth_context()` dependency, RBAC roles (viewer/analyst/approver/admin), dev API-key mode, OIDC JWT with JWKS verification in production.
- `schemas/base.py` — `APIResponse`, `PaginatedResponse`, `HealthResponse`, `ErrorDetail` shared DTOs.

### packages/prompts
Versioned prompt templates (one per graph node). Never inline prompts in Python code.

```
graph-nodes/
  incident_ingest.txt
  evidence_retrieval.txt
  correlation.txt
  reasoning_draft.txt
  confidence_score.txt
  approval_check.txt
  final_response.txt
```

### packages/observability
OTel collector config + tag matrix. Every span must carry all 8 tags:

| Tag | Values |
|-----|--------|
| `service.name` | `agent-runtime` \| `api` \| `web` \| `connector` |
| `graph.name` | `telemetry_value_agent` |
| `graph.version` | `v1.0.0` |
| `node.name` | e.g. `evidence_retrieval` |
| `workflow_id` | e.g. `wf_20260413_001` |
| `tenant.safe_id` | e.g. `tenant_demo` — never real PII |
| `env` | `dev` \| `staging` \| `prod` |
| `model.provider` | `anthropic` \| `ollama` \| `stub` (LLM nodes only) |

---

## 5. Data Flow — Full Request Lifecycle

```
1. Incident arrives (API POST or worker job)
2. TelemetryValueAgentGraph.run() called
3. incident_ingest  → parses and validates raw payload
4. evidence_retrieval → queries Splunk index=tutorial
5. correlation      → top-3 hosts by event frequency
6. reasoning_draft  → LLM generates analysis from prompt template
7. confidence_score → 0.0–1.0 weighted score
8. approval_check   → evaluates policy YAML rules
   ├── approval_required=False → continue
   └── approval_required=True  → halt, await human review
9. final_response   → assembles TelemetryFinalOutput
10. DecisionTrace saved to store (in-memory or PostgreSQL)
11. Web UI displays reasoning timeline + approval panel
12. Human submits ApprovalEvent (approved/rejected)
13. Approval appended to immutable trace record
```

---

## 6. LLM Provider Configuration

| `MODEL_PROVIDER` | Adapter | Use case |
|-----------------|---------|----------|
| `ollama` (default) | `OllamaModelAdapter` | Local dev — no API key needed |
| `anthropic` | `AnthropicModelAdapter` | Cloud / production |
| `stub` | `StubModelAdapter` | Tests — deterministic, no network |

Recommended local models (Ollama): `qwen2.5:14b`, `llama3.1:8b`, `deepseek-coder-v2`, `mistral`.

The adapter is pluggable at `packages/agent-core/models/adapter.py`. Adding a new provider requires only implementing the `ModelAdapter` ABC — zero changes to node code.

---

## 7. Auth & Security

Auth resolution order (FastAPI `get_auth_context` dependency):

1. `x-api-key` header → dev static key lookup
2. `Authorization: Bearer <token>` → OIDC JWT with JWKS signature verification (prod)
3. Anonymous viewer fallback (dev, no OIDC configured)

RBAC roles are hierarchical: `viewer < analyst < approver < admin`. Only `approver` and above can submit approval decisions.

No PII in any OTel span. `tenant.safe_id` is always a sanitized identifier, never an email or real name.

---

## 8. Deployment (Local Dev)

Docker Compose spins up 8 services:

| Service | Port | Notes |
|---------|------|-------|
| `postgres` | 5432 | pgvector/pgvector:pg16 |
| `redis` | 6379 | redis:7.2-alpine |
| `mock-mcp` | 8081 | Fake Splunk for local dev |
| `api` | 8001 | FastAPI |
| `worker` | — | Redis job queue consumer |
| `web` | 3000 | Next.js 14 |
| `otel-collector` | 4317/4318 | OTLP gRPC + HTTP |

```bash
make dev          # Start all services
make test         # Run all Python tests
make api-smoke    # RBAC + approval + rate-limit smoke checks
make verify-local # Full local verification (smoke + e2e + tests + eval)
```

---

## 9. Key Design Decisions

See `docs/adr/` for full ADRs. Summary:

| ADR | Decision |
|-----|---------|
| ADR-001 | LangGraph over custom orchestration — built-in state management, testable nodes |
| ADR-002 | MCP adapter protocol — stable DTO boundary, swap between mock/MCP/native without graph changes |
| ADR-003 | Immutable decision traces with SHA-256 hashing — audit trail integrity |
| ADR-004 | In-memory store default, PostgreSQL for production — fast local dev, scalable prod |
| ADR-005 | OIDC JWT + dev API keys — production-grade auth without blocking local development |
| ADR-007 | Single `SplunkAdapter` Protocol with two implementations — decouple agent from Splunk transport |
| ADR-008 | Native Splunk REST as fallback adapter — direct access when MCP server unavailable |

---

## 10. What's MVP vs Future

**MVP (current):** Read-only agent, recommend-only, human approval gate, single tenant.

**Phase 9+ roadmap:**
- Multi-tenant isolation (RBAC per tenant)
- Autonomous remediation (with mandatory approval for write actions)
- Vector similarity search on decision traces (pgvector)
- Eval harness with Galileo observability
- Kubernetes deployment manifests
