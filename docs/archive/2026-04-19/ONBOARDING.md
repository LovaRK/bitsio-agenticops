# BitsIO AgenticOps — Developer Onboarding Guide

**Last updated:** 2026-04-13  
Welcome to the team. This guide gets you from zero to a running local stack with passing tests in under 30 minutes.

---

## Prerequisites

You need these installed before starting:

- **Python 3.12+** — check with `python3 --version`
- **uv** — Python package manager: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **Node.js 20+** and **pnpm** — `npm install -g pnpm`
- **Docker Desktop** (or Docker + Docker Compose v2)
- **Git**

Optional but useful:
- **Ollama** (for local LLM inference without an API key): https://ollama.ai
- **VS Code** with the Ruff and Pylance extensions

---

## Step 1 — Clone and Bootstrap

```bash
git clone <repo-url>
cd bitsio-agenticops

# Install all Python + Node dependencies
make bootstrap
```

This runs `uv sync --all-groups` (Python) and `pnpm install` (Node). Takes about 2 minutes on first run.

---

## Step 2 — Configure Environment

```bash
cp .env.example .env
```

For local development, **the defaults work out of the box** — no API keys needed. The stack uses:
- A mock Splunk MCP server (`apps/mock_mcp`) instead of a real Splunk instance
- `StubModelAdapter` or Ollama for LLM calls (no Anthropic key required)

If you want to test with real models, set `ANTHROPIC_API_KEY` in `.env`.

---

## Step 3 — Start the Stack

```bash
make dev
```

This runs `docker compose up --build` and starts 8 services:

| Service | URL | What it is |
|---------|-----|-----------|
| Web UI | http://localhost:3000 | Next.js 14 incident dashboard |
| API | http://localhost:8001 | FastAPI REST server |
| Mock Splunk | http://localhost:8081 | Fake Splunk for local dev |
| API docs | http://localhost:8001/docs | Auto-generated Swagger UI |
| PostgreSQL | localhost:5432 | Incident/trace database |
| Redis | localhost:6379 | Job queue + rate-limit cache |
| OTel Collector | localhost:4317/4318 | Observability pipeline |

First build takes 3–5 minutes. Subsequent starts are much faster.

---

## Step 4 — Seed Sample Data

```bash
make seed
```

Seeds 3 sample incidents into PostgreSQL so the UI has something to show.

---

## Step 5 — Run Tests

```bash
make test
```

All tests use mocked dependencies — no live network calls, no running services needed.

```bash
# Run a single test file
uv run pytest tests/unit/test_telemetry_nodes.py -v

# Run negative tests
uv run pytest tests/unit/test_telemetry_nodes_negative.py -v

# Run with coverage
uv run pytest --cov=packages --cov-report=term-missing
```

---

## Step 6 — Verify the Stack

```bash
make api-smoke
```

Runs RBAC checks, approval flow, rate-limit verification, and tenant isolation against the running API. Use this to confirm everything wired up correctly after any infrastructure change.

---

## Project Layout

```
bitsio-agenticops/
├── apps/
│   ├── api/          FastAPI REST server (port 8001)
│   ├── web/          Next.js 14 frontend (port 3000)
│   ├── workers/      Redis job queue worker
│   └── mock_mcp/     Fake Splunk server (port 8081)
├── packages/
│   ├── agent-core/         LangGraph 7-node agent graph
│   ├── connectors/
│   │   └── splunk-mcp/     Splunk adapter (MCP + Native REST)
│   ├── decision-tracing/   Immutable trace records + PostgreSQL store
│   ├── observability/      OTel config + tag matrix
│   ├── prompts/            Versioned prompt templates (one per node)
│   └── shared/             Config, auth, shared DTOs
├── tests/
│   ├── unit/          Node + API + policy + hashing tests
│   ├── contract/      Splunk adapter contract tests
│   └── e2e/           Playwright browser tests
├── infra/
│   ├── docker/        Dockerfiles per service
│   └── scripts/       Schema validation, smoke tests, eval harness
├── docs/              Architecture, API reference, ADRs, runbooks
├── .env.example       Copy to .env and fill in secrets
├── Makefile           All development commands
└── pyproject.toml     Python deps + pytest config
```

---

## Key Systems and How They Connect

### The Agent Graph

The core of the product lives in `packages/agent-core`. It's a 7-node LangGraph pipeline called `TelemetryValueAgentGraph`. When an incident comes in:

1. It ingests the raw payload
2. Queries Splunk for related events
3. Correlates findings (host frequency analysis)
4. Calls an LLM to draft reasoning
5. Scores confidence (0.0–1.0)
6. Evaluates approval policy rules
7. Assembles the final response (or halts if approval required)

**The only file you should never bypass:** `packages/agent-core/src/agent_core/models/adapter.py`. All LLM calls go through here. Never import `anthropic` or `openai` directly in node code.

### The Splunk Adapter

`packages/connectors/splunk-mcp` is the only path to Splunk. It enforces redaction of credentials in logs and retries on 429/503/504. There are two implementations:
- `SplunkMCPAdapter` — for the custom MCP server (local dev uses `mock_mcp`)
- `NativeSplunkAdapter` — for direct Splunk REST API (live mode)

Selected via `SPLUNK_ADAPTER_MODE=mcp|native|auto` in `.env`.

### Decision Tracing

Every agent run writes a `DecisionTrace` with a SHA-256 hash to `packages/decision-tracing`. This is the immutable audit trail. Approval events are appended to it. In local dev, it's in-memory. In production, use `PostgresDecisionTraceStore`.

### Shared Config

All environment variables are in one place: `packages/shared/config/settings.py`. Use `get_settings()` anywhere in the codebase — it's a cached singleton. Never read `os.getenv()` directly in application code; go through `Settings`.

### Auth

Auth is in `packages/shared/auth/middleware.py`. The `get_auth_context` FastAPI dependency handles both dev API keys and production OIDC JWT. Use the convenience factories `require_approver()`, `require_analyst()`, `require_admin()` as FastAPI dependencies on your endpoints.

---

## Common Tasks

### Add a new API endpoint

1. Add the route to the appropriate router in `apps/api/app/routers/`
2. Use `Depends(get_auth_context)` for auth
3. Add tests to `tests/unit/test_decision_trace_api.py` or a new file

### Modify an agent node

1. Edit the node in `packages/agent-core/src/agent_core/nodes/<node>.py`
2. Nodes must be pure functions: `(state: TelemetryAgentState) → TelemetryAgentState`
3. Update/add tests in `tests/unit/test_telemetry_nodes.py`
4. Update the matching prompt in `packages/prompts/graph-nodes/<node>.txt`
5. Run `make test` to confirm nothing broke

### Add a new policy rule

Edit `packages/agent-core/src/agent_core/policies/rules/default.yaml`:
```yaml
rules:
  - id: my-new-rule
    description: Describe what triggers this
    condition: my_condition_name
    action: require_approval
```

Then implement the condition in `packages/agent-core/src/agent_core/policies/evaluator.py`.

### Switch LLM provider

Update `.env`:
```bash
MODEL_PROVIDER=ollama          # local Ollama
MODEL_NAME=qwen2.5:14b
# or
MODEL_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
MODEL_NAME=claude-3-5-sonnet-20241022
# or
MODEL_PROVIDER=stub            # for tests, no network
```

The `TelemetryValueAgentGraph` picks up the adapter from `get_settings()` automatically.

### Run the background worker locally

```bash
cd apps/workers
uv run python worker.py
```

The worker pulls jobs from the `bitsio:jobs` Redis queue. Push a job:
```python
import redis, json
r = redis.Redis.from_url("redis://localhost:6379/0")
r.rpush("bitsio:jobs", json.dumps({
    "job_type": "run_agent",
    "workflow_id": "wf_test_001",
    "payload": {"incident": {"incident_id": "inc-1", "title": "Test", "severity": "P3", "timestamp": "2026-04-13T10:00:00Z"}}
}))
```

### Connect to Live Splunk

See `docs/LIVE_SPLUNK_MODE.md` and `docs/SSH_TUNNEL_SETUP.md`. Quick version:

```bash
# 1. Edit .env with live Splunk values
SPLUNK_LIVE_MODE=true
SPLUNK_ADAPTER_MODE=native
SPLUNK_MCP_BASE_URL=https://localhost:8089
SPLUNK_MCP_TOKEN=<your_token>

# 2. Start tunnel (if Splunk port is not local)
make tunnel-start

# 3. Start API in live mode
make live-api

# 4. Start web
make live-web
```

---

## Linting and Code Style

```bash
make lint
```

Runs ruff, black (check), isort, and eslint. All checks run in CI.

- **Line length:** 100 characters (Python)
- **Python version:** 3.12+
- **Package managers:** `uv` for Python, `pnpm` for Node — never use `pip` or `npm` directly
- **Pre-commit hooks:** enforce black, isort, ruff, eslint, and gitleaks on commit

---

## Commit Format

All commits use Conventional Commits with mandatory body fields:

```
feat(agent-core): add OllamaModelAdapter for local LLM inference

Why: - Enable offline dev without ANTHROPIC_API_KEY
What changed: - Added OllamaModelAdapter in adapter.py with qwen2.5:14b default
Validation: - test_telemetry_nodes.py passes with OllamaModelAdapter stub
Risk: - None for dev; in prod still gated by MODEL_PROVIDER env var
```

Types: `feat`, `fix`, `chore`, `test`, `refactor`, `docs`, `perf`

---

## Who to Ask

| Area | Ask about |
|------|----------|
| Agent graph / LangGraph | nodes, state, policies, confidence scoring |
| Splunk adapter | query format, DTO boundary, retry logic, live vs mock |
| Decision tracing | trace schema, approval flow, PostgreSQL migration |
| FastAPI / auth | endpoints, RBAC, rate limiting, CORS |
| Next.js / frontend | incident UI, approval panel, API client |
| Infrastructure | Docker, OTel, PostgreSQL, Redis |

---

## Useful Links

- API Swagger UI: http://localhost:8001/docs
- Architecture doc: `docs/ARCHITECTURE.md`
- API reference: `docs/API_REFERENCE.md`
- ADRs: `docs/adr/`
- Runbooks: `docs/runbooks/`
- Phase roadmap: `docs/plan/MASTER_ROADMAP.md`
