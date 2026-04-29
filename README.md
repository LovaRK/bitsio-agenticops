# BitsIO AgenticOps

AI-powered observability platform for Splunk with explainable reasoning timelines, decision traces, and human approval gates.

## Quickstart

### Local Development (Port 3000)
```bash
bash scripts/run-local.sh
# Opens http://localhost:3000
```

### Production Deployment (Safe)
```bash
# Edit scripts/vultr.deploy.env and add SSH_PASSWORD
nano scripts/vultr.deploy.env

# Deploy with validation + health checks
bash scripts/deploy-safe.sh main
# Opens http://144.202.48.85:3000
```

### Classic Makefile Commands
```bash
cp .env.example .env
make bootstrap
make dev
```

## Canonical Docs (Read First)

- `docs/SOURCE_OF_TRUTH.md`
- `docs/runbooks/AGENT_GUARDRAILS_HARDENING_PLAN.md`

## Agent Workflow (Graphify-First)

For all non-trivial implementation/debugging tasks:

1. Read `graphify-out/GRAPH_REPORT.md`
2. Use graph traversal before broad grep:
   - `graphify query "<question>"`
   - `graphify path "<A>" "<B>"`
   - `graphify explain "<concept>"`
3. After code changes: `graphify update .`
4. If behavior/architecture changed: update `docs/SOURCE_OF_TRUTH.md`

## Documentation Policy (From Now)

- Single source of truth: `docs/SOURCE_OF_TRUTH.md`
- Legacy documents are archived at: `docs/archive/2026-04-19/`
- New architecture/process/runbook updates must be appended to `docs/SOURCE_OF_TRUTH.md`

## Live Splunk Mode

Use this for real-data browser testing (no mock fallback).

### 1. Required `.env` values

```bash
SPLUNK_LIVE_MODE=true
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_REQUIRE_LIVE_API=true
SPLUNK_ADAPTER_MODE=native
SPLUNK_MCP_BASE_URL=https://localhost:8089
SPLUNK_MCP_TOKEN=<your_splunk_mcp_token>
SPLUNK_AUTH_SCHEME=Bearer
SPLUNK_WEB_BASE_URL=http://144.202.48.85:8000
SPLUNK_MCP_SSL_VERIFY=false
```

Adapter modes:
- `SPLUNK_ADAPTER_MODE=mcp` for custom MCP app endpoints (`/services/mcp/*`)
- `SPLUNK_ADAPTER_MODE=native` for native Splunk REST (`/services/search/jobs/export`)
- `SPLUNK_ADAPTER_MODE=auto` to infer from base URL (default)

Strict live expectation for `LOCAL_INTEGRATION` and `CLOUD_LIVE`:
- no mock business payload on core tabs
- telemetry must show live provenance:
  - `trust.data_source = live`
  - `trust.fallback_used = false`
  - `query_context.used_live_data = true`

### 2. Start tunnel (Terminal A)

```bash
make tunnel-start
make tunnel-status
```

### 3. Start live API (Terminal B)

```bash
make live-api
```

### 4. Start web app (Terminal C)

```bash
make live-web
```

### 5. Optional: seed demo incidents to `tutorial`

```bash
make live-seed
```

### 6. Optional: API end-to-end verification

```bash
make live-verify
curl -sS -H 'x-api-key: dev-analyst' 'http://127.0.0.1:8001/api/v1/waste/telemetry/metrics' | jq '{data_source:.trust.data_source,fallback_used:.trust.fallback_used,backend:.trust.backend,adapter_mode:.trust.adapter_mode,used_live_data:.query_context.used_live_data}'
```

API: `http://localhost:8001`
Web: `http://127.0.0.1:3000`

## Runtime Switching (UI)

You can now switch runtime behavior directly from the app:

1. Open `http://127.0.0.1:3000/settings`
2. Go to `Runtime Control`
3. Change and apply:
   - `Scenario Preset`:
     - `Local Mock` (best for UI/build speed)
     - `Local Model + Live Splunk` (best for integration checks)
     - `Cloud Model + Live Splunk` (best for production-like demos)
   - `Runtime Profile`:
     - default = `Local Integration` (ollama + live Splunk)
     - `Local Dev` = ollama + model mock on + live Splunk off
     - `Cloud Live` = anthropic + model mock off + live Splunk on
   - `Model Provider`: `ollama` (local) / `anthropic` (cloud) / `stub`
   - `Model Name` (editable with suggestion list)
   - `Splunk Adapter Mode`: `mcp` / `native` / `auto`
   - `Model Mock Mode` (switch)
   - `Live Splunk Data` (switch):
     - `on` = use live Splunk incident data
     - `off` = use local seeded mock incidents
4. Click `Test Connections` to verify model runtime and Splunk connectivity.

Notes:
- Changes apply immediately to the running API process.
- If you restart API, persist desired values in `.env`.

## Current API Contracts (2026-04-16)

- Telemetry metrics endpoint:
  - `GET /api/v1/waste/telemetry/metrics`
  - (Older docs may mention `/api/v1/telemetry/metrics`; treat that as deprecated.)
- Runtime connectivity check:
  - `GET /api/v1/settings/runtime/check`
- Most control-plane routes require analyst role in dev:
  - send header `x-api-key: dev-analyst`
- Live waste analysis endpoint:
  - `POST /api/v1/waste/analyze/live`
- Incident context enrichment endpoint:
  - `POST /api/v1/incidents/{incident_id}/enrich`
  - request body: `{ "force_refresh": false }`
  - returns enriched incident context (metadata + similar incidents + anomaly)

## Incident Context Agent (ICA)

ICA is now fully wired in local/dev flow:
- graph: `incident_context_agent` (`v1.0.0`)
- nodes: `context_ingest -> context_enrichment -> historical_correlation -> anomaly_detection -> context_response`
- web UI: Incident Context panel on incident detail page (`/incidents/{id}`)
- mock baseline endpoint: `GET /api/v1/baselines/{service_name}`

Quick API check:

```bash
curl -X POST http://localhost:8001/api/v1/incidents/inc_20260408_42/enrich \
  -H 'content-type: application/json' \
  -H 'x-api-key: dev-analyst' \
  -d '{"force_refresh":true}'
```

## Telemetry Value Dashboard (NEW)

AI-Powered Telemetry Cost Optimization Platform with live Splunk data.

**Features:**
- ✅ [🔄 Refresh Data] button for user-triggered data refresh
- ✅ Live Splunk data only (no mock fallback)
- ✅ Composite scoring (Utilization 35%, Detection 40%, Quality 25%)
- ✅ Cost optimization with 5-stage staircase
- ✅ Security gaps and quick wins analysis

**Access:**
- Local: `http://localhost:3000/telemetry-value`
- Production: `http://144.202.48.85:3000/telemetry-value`

**Data Sources:**
- Volume by sourcetype (Splunk index metadata)
- Alert references (alert search count)
- Detection coverage (MITRE + Lantern)
- Data quality (parsing errors, timestamp errors)

**Configuration (Filter Bar):**
- Customer name
- Cost/GB/Year (default: $10)
- Utilization weight (default: 35%)
- Detection weight (default: 40%)
- Quality weight (default: 25%)

---

## Make Commands

- `make bootstrap`: install Python and JS dependencies
- `make dev`: start all local services via Docker Compose
- `make test`: run Python tests
- `make lint`: run Python and web lint checks
- `make seed`: seed sample incidents into PostgreSQL
- `make api-smoke`: run API smoke checks (RBAC, approvals, rate-limit, tenant isolation)
- `make verify-local`: deterministic local verification flow (stack + smoke + e2e + tests + eval)
- `make live-api`: start FastAPI in real Splunk mode using `.env`
- `make live-web`: start Next.js against local live API
- `make live-seed`: inject demo events into Splunk `tutorial` index
- `make live-verify`: verify incidents + trace + approve/reject via API
- `make tunnel-start|stop|status`: manage SSH tunnel to Vultr Splunk

## Deployment Scripts (NEW)

Safe, validated deployment with health checks.

### Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `run-local.sh` | Start locally on port 3000 | `bash scripts/run-local.sh` |
| `validate-deployment.sh` | Pre-deployment SSH check | `bash scripts/validate-deployment.sh` |
| `deploy-safe.sh` | Deploy to production with validation | `bash scripts/deploy-safe.sh main` |
| `check-status.sh` | Verify server health | `bash scripts/check-status.sh` |

### Workflow

```bash
# 1. Make changes locally
git commit -m "feat: description"

# 2. Setup SSH password (one-time)
nano scripts/vultr.deploy.env
# Set: SSH_PASSWORD="your-password"

# 3. Validate SSH connection
bash scripts/validate-deployment.sh

# 4. Deploy (with automatic health check)
bash scripts/deploy-safe.sh main

# 5. Verify production is running
bash scripts/check-status.sh
```

### Production URLs (After Deployment)

| Component | URL |
|-----------|-----|
| Web UI | http://144.202.48.85:3000 |
| API | http://144.202.48.85:8001 |
| Telemetry | http://144.202.48.85:3000/telemetry-value |
| Health | http://144.202.48.85:8001/health |

---

`make api-smoke` uses auto mode:
- tries network checks against `http://localhost:8001`
- falls back to in-process `TestClient` checks if the API endpoint is unavailable

## Architecture (ASCII)

```text
[Next.js Web]
     |
     v
[FastAPI API] ---> [LangGraph Agent Core] ---> [Splunk Adapter: native|mcp] ---> [Splunk]
     |                     |                          |
     |                     v                          v
     |              [Decision Tracing]          [OTel spans]
     v
[PostgreSQL + pgvector] <--> [Redis]
```

## Build Contract

- No hardcoded credentials
- Mock-first tests (no live network in unit/contract tests)
- Pydantic DTOs at all boundaries
- Prompt files stored under `packages/prompts/`
