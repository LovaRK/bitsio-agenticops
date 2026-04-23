# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Bootstrap dependencies (Python via uv + Node.js via pnpm)
make bootstrap

# Start the full local dev stack (Docker Compose with build)
make dev

# Run all Python tests
make test

# Run lint (ruff, black, isort for Python; eslint for web)
make lint

# Seed sample incidents into PostgreSQL
make seed
```

**Running a single test file:**
```bash
uv run pytest tests/unit/test_telemetry_nodes.py -q
```

**Package managers:** Python uses `uv` (not pip/poetry); Node.js uses `pnpm` (not npm/yarn).

## Architecture Overview

BitsIO AgenticOps is an AI-powered observability platform that connects to Splunk, runs agentic workflows, and exposes reasoning timelines with human approval gates.

### Monorepo Layout

- **`apps/api`** — FastAPI REST server (port 8001); exposes incidents, decision traces, and approval endpoints
- **`apps/web`** — Next.js 14 frontend (port 3000); incident list + detail views with timeline, evidence, and approval UI
- **`apps/workers`** — Background job worker scaffold
- **`apps/mock_mcp`** — Mock Splunk MCP adapter (port 8081) used in local dev and tests
- **`packages/agent-core`** — LangGraph orchestration engine; the agentic heart of the system
- **`packages/connectors/splunk-mcp`** — Splunk adapter with stable DTO boundary and redaction rules
- **`packages/decision-tracing`** — Immutable, hashed decision trace records + approval events
- **`packages/observability`** — OpenTelemetry setup for FastAPI and SQLAlchemy
- **`packages/prompts`** — Versioned prompt files for graph nodes, evaluators, and system context
- **`packages/shared`** — Shared auth/config/schema utilities (still scaffolding)

### Agent Graph (packages/agent-core)

The `TelemetryValueAgent` is a LangGraph graph with 7 sequential nodes:

1. `incident_ingest` → parse raw incident
2. `evidence_retrieval` → query Splunk via MCP adapter
3. `correlation` → correlate findings
4. `reasoning_draft` → generate AI reasoning (calls LLM)
5. `confidence_score` → calculate confidence
6. `approval_check` → policy-based human approval gate
7. `final_response` → return structured response

State flows through `TelemetryAgentState` (Pydantic model). All node I/O uses typed DTOs — never raw dicts at package boundaries.

### Data Layer

- **PostgreSQL 16 + pgvector** — incidents and decision traces; Alembic migrations in `packages/decision-tracing/migrations/`
- **Redis 7.2** — caching
- **Alembic** — run migrations via `uv run alembic upgrade head` inside `packages/decision-tracing/`

### Splunk MCP Adapter Contract

`packages/connectors/splunk-mcp` is the only path to Splunk. It enforces:
- Redaction of tokens, passwords, queries, credentials in all outbound/inbound data
- Retry logic: 3 attempts, exponential backoff (1–2s) with jitter
- Stable DTO surface: `list_indexes()`, `run_search()`, `get_server_info()`, `explain_error()`

In unit and contract tests, always mock the MCP adapter — never hit a live network.

### Decision Tracing

Every agent run produces an immutable `DecisionTrace` record with a SHA-256 content hash. Approval events are appended (not mutated). This is the audit trail for all AI decisions.

### Observability

OTel observes **agent behavior only** — it does NOT convert customer Splunk data into OTel format. Think of it as a heart-rate monitor on the surgeon, not the patient.

Instrumented at 5 points: Next.js page loads → FastAPI requests → LangGraph node start/end → MCP adapter calls → decision trace DB writes.

**Every span must carry all 8 of these tags:**

```
service.name     = "agent-runtime" | "api" | "web" | "connector"
graph.name       = "telemetry_value_agent"
graph.version    = "v1.0.0"
node.name        = "evidence_retrieval"   # node-level spans only
workflow_id      = "wf_20260408_001"
tenant.safe_id   = "acme_corp_001"        # NEVER real names/emails — no PII
env              = "dev" | "staging" | "prod"
model.provider   = "anthropic"            # only when LLM is called
```

All services export to OTEL Collector on ports 4317/4318.

### Approval Gate Scope

**MVP is read-only.** The agent recommends. Humans decide whether to act. There is no autonomous remediation. Every production action requires a recorded approval event.

RBAC roles (Phase 8+): `viewer` | `analyst` | `approver` | `admin`

## Key Conventions

- **Line length**: 100 characters (Python)
- **Python version**: 3.12+
- **Prompt files** live at `prompts/graph-nodes/*.txt` (repo root), not inline in Python code
- **LLM calls** always go through the pluggable adapter at `packages/agent-core/models/adapter.py` — never import `anthropic` or `openai` directly in node code
- **Graph nodes** are pure functions: `(state: TelemetryAgentState) → TelemetryAgentState`. Every node must be testable with fixtures, without an LLM call.
- **No hardcoded credentials** anywhere in source
- **Pre-commit hooks** enforce black, isort, ruff, eslint, and gitleaks on commit
- **Schema validation** is a CI job — JSON schemas live under `infra/` and are validated by `infra/scripts/validate_schemas.py`
- **One slice at a time** — one node, one component, or one endpoint per agent session. Test after each slice. Commit after each passing test.

## Commit Format

All commits follow Conventional Commits with mandatory body fields:

```
<type>(<scope>): <summary under 72 chars>

Why: - Business or technical reason
What changed: - Concrete notes (not "updated file X")
Validation: - Tests added/updated
Risk: - What could go wrong + rollback plan
```

Types: `feat`, `fix`, `chore`, `test`, `refactor`, `docs`, `perf`

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `ANTHROPIC_API_KEY` — required for LLM calls in the agent graph
- `SPLUNK_MCP_TOKEN` — required when pointing at a real Splunk instance (mock_mcp is used locally)
- `OIDC_ISSUER` / `OIDC_AUDIENCE` — required for auth middleware in non-local environments

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
