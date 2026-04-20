# BitsIO AgenticOps — Implementation Guide

**Date Updated**: 2026-04-11
**Status**: Phase 8 Live Integration Complete

This document describes the actual implementation of the system and how all components interact.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Web Browser (User)                             │
│                         http://localhost:3000                           │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            ↓ (React + Next.js)
┌─────────────────────────────────────────────────────────────────────────┐
│                    Next.js Web Application                              │
│              apps/web/{app,lib,components,types}                        │
│                                                                          │
│  Key Files:                                                              │
│  • lib/api.ts                — API client with fallback logic           │
│  • app/incidents/page.tsx    — Incident list view                       │
│  • app/incidents/[id]/page.tsx — Incident detail view                  │
│  • components/Timeline.tsx   — Reasoning timeline visualization         │
│  • components/ApprovalPanel.tsx — Approval/rejection UI                │
│                                                                          │
│  Env Flags:                                                              │
│  • NEXT_PUBLIC_USE_MOCK=false → Use live API                           │
│  • NEXT_PUBLIC_REQUIRE_LIVE_API=true → Fail if API unreachable        │
│  • NEXT_PUBLIC_API_BASE_URL=http://localhost:8001 (default)           │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                 (HTTP/REST API calls with x-api-key)
                            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         FastAPI REST API                                │
│                       http://localhost:8001                             │
│                     apps/api/app/main.py                               │
│                                                                          │
│  Middleware Stack (in order):                                           │
│  1. CORSMiddleware → allow localhost:3000, 127.0.0.1:3000              │
│  2. OTelMiddleware → instrument all requests                           │
│  3. TenantRateLimitMiddleware → enforce per-tenant rate limits         │
│                                                                          │
│  Key Routes:                                                             │
│  • GET  /health                              — heartbeat               │
│  • GET  /api/v1/incidents                    — list all incidents      │
│  • GET  /api/v1/decision-traces/{id}         — fetch trace detail      │
│  • POST /api/v1/decision-traces/{id}/approvals — submit approval      │
│  • GET  /api/v1/decision-traces/{id}/approvals — list approvals      │
│  • GET  /api/v1/dashboard/summary             — KPI dashboard          │
│  • GET  /api/v1/approvals/pending             — pending approvals     │
│  • GET  /api/v1/monitoring/overview            — service health        │
│  • GET  /api/v1/settings                       — runtime config        │
│                                                                          │
│  Auth Dependency (require_analyst, require_approver):                  │
│  • Dev mode: x-api-key header (dev-analyst, dev-approver, dev-secret) │
│  • Prod mode: Bearer JWT from OIDC_ISSUER                              │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
        (SPLUNK_LIVE_MODE=true switches between mock/live)
                            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    Live Mode Switch                                     │
│                  if SPLUNK_LIVE_MODE == "true"                         │
│                                                                          │
│  apps/api/app/main.py:                                                  │
│  • _load_incidents(splunk_service) → calls splunk_service.list_incidents()
│  • _live_mode_enabled() → checks env flag                              │
│                                                                          │
│  For decision trace detail (GET /decision-traces/{id}):                │
│  • First checks in-memory store (from POST create_decision_trace)      │
│  • If not found AND live mode: queries Splunk via splunk_service      │
│  • If not found AND NOT live mode: returns 404                         │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                 (When SPLUNK_LIVE_MODE=true)
                            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                 SplunkIncidentService                                   │
│            apps/api/app/services/splunk_live.py                        │
│                                                                          │
│  Methods:                                                                │
│  • list_incidents(limit=50) → queries index=tutorial                   │
│  • get_decision_trace(incident_ref) → detail + node runs              │
│  • _build_evidence_refs() → generates Splunk search links              │
│  • _node_runs_from_results() → simulates agent node execution         │
│                                                                          │
│  Dependencies:                                                           │
│  • adapter: SplunkAdapter (either MCP or Native)                       │
│  • splunk_web_base_url: http://144.202.48.85:8000 (for search links) │
│                                                                          │
│  Query Strategy:                                                         │
│  For list_incidents():                                                   │
│    - Searches index=tutorial                                            │
│    - Extracts: incident_id, severity, status, title, event_count      │
│    - Returns normalized IncidentSummary list                            │
│                                                                          │
│  For get_decision_trace():                                              │
│    - Searches for incident_id in tutorial index                       │
│    - Extracts host counts for probable_cause                           │
│    - Calculates confidence (55% + events/500)                          │
│    - Marks approval_required if severity in {high, medium}            │
│    - Synthesizes node_runs timeline for display                        │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                 (Adapter abstraction layer)
                            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│              SplunkAdapter (Abstract Interface)                         │
│         packages/connectors/splunk-mcp/src/splunk_mcp/                 │
│                                                                          │
│  get_splunk_adapter() — dependency factory (apps/api/app/dependencies.py)
│                                                                          │
│  Resolution Logic:                                                       │
│  • Reads SPLUNK_ADAPTER_MODE env (default: "auto")                   │
│  • If "auto": infers from SPLUNK_MCP_BASE_URL                         │
│    - Contains "/services/mcp" → use SplunkMCPAdapter                   │
│    - Otherwise → use NativeSplunkAdapter                               │
│  • If "mcp": use SplunkMCPAdapter                                     │
│  • If "native": use NativeSplunkAdapter                               │
│                                                                          │
│  Common Interface:                                                       │
│  • run_search(query, earliest, latest) → SearchResultDTO              │
│  • get_server_info() → ServerInfoDTO                                   │
│  • list_indexes() → list[IndexDTO]                                     │
│                                                                          │
│  Configuration:                                                          │
│  • SPLUNK_MCP_BASE_URL=https://localhost:8089/services/mcp            │
│  • SPLUNK_MCP_TOKEN=<JWT token>                                        │
│  • SPLUNK_MCP_ROLE=read_only                                           │
│  • SPLUNK_MCP_SSL_VERIFY=false (local dev, set true in prod)          │
│  • SPLUNK_AUTH_SCHEME=Bearer                                           │
│  • SPLUNK_WEB_BASE_URL=http://144.202.48.85:8000                      │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                 (SSH Tunnel for local dev)
                            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       SSH Tunnel (Optional)                             │
│                    make tunnel-start                                    │
│                                                                          │
│  Command:                                                                │
│  ssh -N -L 8089:localhost:8089 root@144.202.48.85                      │
│                                                                          │
│  Purpose:                                                                │
│  • Forwards localhost:8089 → 144.202.48.85:8089                       │
│  • Secures connection to private Splunk MCP server                     │
│  • Required when SPLUNK_MCP_BASE_URL=https://localhost:8089           │
│                                                                          │
│  Status:                                                                 │
│  make tunnel-status                                                     │
│  (Check /tmp/splunk-tunnel.pid)                                        │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────────────┐
│               Live Splunk MCP Server (Remote)                           │
│                    144.202.48.85:8089                                   │
│                                                                          │
│  MCP Interface:                                                          │
│  • GET /services/mcp/list_indexes                                      │
│  • POST /services/mcp/run_search                                       │
│  • GET /services/mcp/server/info                                       │
│                                                                          │
│  Requires:                                                               │
│  • Valid JWT token in Authorization: Bearer header                     │
│  • SSH tunnel for local access (or public 8089 if firewall allows)    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Request Flow Examples

### Example 1: List Incidents (Live Mode)

```
Browser: GET /incidents
         ↓
Web (api.ts): 
  - Calls listIncidents()
  - Checks NEXT_PUBLIC_USE_MOCK (false)
  - Tries: fetch("http://localhost:8001/api/v1/incidents", 
                  headers={x-api-key: dev-analyst})
  - No fallback if fails (REQUIRE_LIVE_API=true)
         ↓
API (main.py):
  - Route: GET /api/v1/incidents
  - Dependency: require_analyst (checks x-api-key header)
  - Calls: _load_incidents(splunk_service)
  - _live_mode_enabled() returns true
  - Calls: splunk_service.list_incidents(limit=50)
         ↓
SplunkIncidentService (splunk_live.py):
  - Builds query: 
    "search index=tutorial | rex ... | stats ... | head 50"
  - Calls: adapter.run_search(query, earliest="-24h", latest="now")
         ↓
SplunkMCPAdapter:
  - Makes HTTPS POST to localhost:8089/services/mcp/run_search
  - Sends JWT token in Authorization header
  - Returns SearchResultDTO (results=[...], done=true)
         ↓
SplunkIncidentService:
  - Parses results, normalizes fields
  - Returns list[IncidentSummary]
         ↓
API (main.py):
  - Returns: {"items": [IncidentSummary, ...]}
         ↓
Web (api.ts):
  - Receives JSON, renders incident list at /incidents
```

### Example 2: Get Decision Trace Detail (Live Mode)

```
Browser: GET /incidents/inc_20260408_42
         ↓
Web (api.ts):
  - Calls getDecisionTrace("inc_20260408_42")
  - fetch("http://localhost:8001/api/v1/decision-traces/wf_inc_20260408_42")
         ↓
API (main.py):
  - Route: GET /api/v1/decision-traces/{workflow_id}
  - store.get("wf_inc_20260408_42") → None (not in in-memory store)
  - _live_mode_enabled() returns true
  - Calls: splunk_service.get_decision_trace("wf_inc_20260408_42")
         ↓
SplunkIncidentService:
  - Normalizes incident_id: "inc_20260408_42"
  - Builds query for tutorial index
  - Calls: adapter.run_search(...)
  - Parses rows, extracts host counts, calculates confidence
  - Builds _node_runs_from_results() timeline
  - Returns DecisionTrace dict
         ↓
API (main.py):
  - Returns: {"workflow_id": "wf_...", "incident_id": "...", ...}
         ↓
Web (api.ts):
  - Receives DecisionTrace JSON
  - Renders Timeline, EvidencePanel, ApprovalPanel
```

### Example 3: Submit Approval

```
Browser: User clicks "Approve" button in ApprovalPanel
         ↓
Web (components/ApprovalPanel.tsx):
  - Calls submitApproval(workflow_id, decision)
  - POST /api/v1/decision-traces/{workflow_id}/approvals
  - Body: {decision: "approve", comment: "..."}
  - Headers: {x-api-key: dev-approver}
         ↓
API (main.py):
  - Route: POST /api/v1/decision-traces/{workflow_id}/approvals
  - Dependency: require_approver (checks x-api-key == dev-approver)
  - Calls: service.add_approval(workflow_id, payload, actor=ctx.user_id)
         ↓
TraceService (trace_service.py):
  - Looks up trace in store
  - Creates ApprovalEvent(decision, actor, timestamp)
  - Appends to trace.approval_events
  - Returns event JSON
         ↓
API (main.py):
  - Returns: {"decision": "approve", "actor": "dev:dev-approver", ...}
         ↓
Web (api.ts):
  - Shows success toast
  - Optionally reloads decision trace
```

---

## Environment Configuration

### Required Variables (Live Mode)

```bash
# Splunk MCP Endpoint
SPLUNK_MCP_BASE_URL=https://localhost:8089/services/mcp
SPLUNK_MCP_TOKEN=<JWT token>
SPLUNK_MCP_ROLE=read_only
SPLUNK_MCP_SSL_VERIFY=false                    # for local dev

# Splunk Web (for evidence links)
SPLUNK_WEB_BASE_URL=http://144.202.48.85:8000

# Live Mode Flags
SPLUNK_LIVE_MODE=true                          # enables live queries
NEXT_PUBLIC_USE_MOCK=false                     # disable mock in web
NEXT_PUBLIC_REQUIRE_LIVE_API=true              # fail if API unreachable

# Model Config
MODEL_PROVIDER=ollama                           # not anthropic
MODEL_NAME=qwen2.5:14b                          # local Ollama model
ANTHROPIC_API_KEY=...                           # unused in local mode
```

### Optional Variables

```bash
# Adapter Mode (auto-detection)
SPLUNK_ADAPTER_MODE=auto                       # or "mcp" or "native"

# Auth (dev mode defaults)
OIDC_ISSUER=                                   # empty for dev, set for prod
OIDC_AUDIENCE=bitsio-api

# Rate Limiting
RATE_LIMIT_PER_MINUTE=100
REDIS_URL=redis://redis:6379/0

# Logging
LOG_LEVEL=INFO
APP_ENV=local
APP_TIMEZONE=UTC

# Tenancy
TENANT_SAFE_ID=tenant_demo

# OTel
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_SERVICE_NAME=agent-runtime
```

---

## Authentication & Authorization

### Dev Mode (Local)

**Default**: No configuration needed.

- Any request without `x-api-key` → automatically `viewer` role
- Routes guarded by `require_analyst` → check for `x-api-key: dev-analyst` (or higher)
- Routes guarded by `require_approver` → check for `x-api-key: dev-approver` or `dev-secret`

**Dev Keys** (apps/shared/auth/middleware.py):
- `dev-viewer` → Role.VIEWER
- `dev-analyst` → Role.ANALYST
- `dev-approver` → Role.APPROVER
- `dev-secret` → Role.ADMIN

**Web Default** (apps/web/lib/api.ts):
- Automatically adds `x-api-key: dev-analyst` to all API requests in dev mode

### Production Mode

**OIDC JWT Validation** (when `OIDC_ISSUER` is set):

1. Client sends: `Authorization: Bearer <JWT token>`
2. API validates JWT:
   - Fetches JWKS from `{OIDC_ISSUER}/.well-known/jwks.json`
   - Caches JWKS for 1 hour
   - Decodes token (currently no signature verification; TODO in prod)
   - Extracts: `sub` (user_id), `role` (user's role)
3. Returns `AuthContext(user_id, role, claims)`

**Roles** (ordered by privilege):
- `viewer` (0) — read-only access
- `analyst` (1) — list incidents, view traces
- `approver` (2) — approve/reject incidents
- `admin` (3) — access all endpoints

---

## Routes & Permissions

| Route | Method | Auth Guard | Logic |
|-------|--------|-----------|-------|
| `/health` | GET | None | Always allowed; bypasses rate limit |
| `/api/v1/incidents` | GET | require_analyst | Lists from live Splunk or seed data |
| `/api/v1/decision-traces` | POST | require_analyst | Creates or merges trace in store |
| `/api/v1/decision-traces/{id}` | GET | require_analyst | Checks store first, then live Splunk |
| `/api/v1/decision-traces/{id}/approvals` | POST | require_approver | Records approval decision |
| `/api/v1/decision-traces/{id}/approvals` | GET | require_analyst | Lists approvals for trace |
| `/api/v1/dashboard/summary` | GET | require_analyst | KPIs + incident list |
| `/api/v1/approvals/pending` | GET | require_analyst | Incidents awaiting approval |
| `/api/v1/monitoring/overview` | GET | require_analyst | Service health + indexes |
| `/api/v1/settings` | GET | require_analyst | Runtime configuration snapshot |

---

## Data Flow: Mock vs. Live

### Mock Mode (for CI/local testing without Splunk)

```
SPLUNK_LIVE_MODE=false
  ↓
API._load_incidents(splunk_service)
  → returns SEED_INCIDENTS (hardcoded in main.py)
  
API.get_decision_trace(id)
  → checks in-memory store only
  → returns 404 if not found
  
No Splunk queries executed
Fast, deterministic tests
```

### Live Mode (for production validation)

```
SPLUNK_LIVE_MODE=true
  ↓
API._load_incidents(splunk_service)
  → calls splunk_service.list_incidents()
  → queries Splunk MCP "search index=tutorial..."
  → normalizes fields, returns list
  
API.get_decision_trace(id)
  → checks in-memory store first
  → if not found, calls splunk_service.get_decision_trace(id)
  → queries Splunk for events, synthesizes trace
  
Real Splunk data
Slower but validates against live data
```

---

## Rate Limiting

**Middleware**: `apps/api/app/middleware/rate_limit.py`

**Configuration**:
- `RATE_LIMIT_PER_MINUTE=100` — default
- `REDIS_URL=redis://redis:6379/0` — for distributed rate limiting
- `TENANT_SAFE_ID=tenant_demo` — default tenant ID

**Per-Tenant Buckets**:
- Fixed-window algorithm: 60-second windows
- Request header `x-tenant-id` → tenant key
- Falls back to `TENANT_SAFE_ID` if not provided
- In-memory fallback if Redis unavailable

**Responses**:
- Within limit: 200 OK
- Exceeded: 429 Too Many Requests + `Retry-After: 60` header
- Exemption: `/health` always allowed

---

## Observability

### OpenTelemetry Instrumentation

**What's instrumented**:
- FastAPI request/response spans (all routes)
- SQLAlchemy database calls (not used in MVP)
- LLM calls to language models

**Tag Matrix** (all spans must include):
```
service.name         = "api" | "web" | "connector" | "agent-runtime"
graph.name           = "telemetry_value_agent"
graph.version        = "v1.0.0"
node.name            = "incident_ingest" (node-level only)
workflow_id          = "wf_20260408_001"
tenant.safe_id       = "tenant_demo"
env                  = "dev" | "staging" | "prod"
model.provider       = "ollama" | "anthropic" (LLM calls only)
```

**Export**: OTLP gRPC to `http://otel-collector:4317`

---

## Testing

### Unit Tests (42 passing)

```bash
make test
```

Tests cover:
- Individual agent nodes
- Decision trace hashing
- Policy evaluation
- Approval flows
- Rate limiting
- API endpoints

### E2E Tests (8 passing)

```bash
pnpm --filter web test:e2e
```

Tests cover:
- Homepage navigation
- Incident list + detail pages
- Timeline rendering
- Approval panel interactions

### Live Verification

```bash
make live-verify
```

Runs:
- API smoke tests
- E2E tests with live API
- Full evaluation harness (if configured)

---

## Deployment

### Docker Compose (Local Dev)

```bash
make dev
```

Services:
- `api` (port 8001) — FastAPI
- `web` (port 3000) — Next.js
- `postgres` (port 5432) — PostgreSQL + pgvector
- `redis` (port 6379) — Redis
- `mock-mcp` (port 8081) — Mock Splunk (fallback)
- `otel-collector` (ports 4317/4318) — OpenTelemetry
- `worker` — Background job scaffold

### SSH Tunnel (For Live Splunk)

```bash
make tunnel-start
# Forwards localhost:8089 → 144.202.48.85:8089
```

---

## Troubleshooting

### "Connection refused" on localhost:8089

**Cause**: SSH tunnel not running.

**Fix**:
```bash
make tunnel-start
make tunnel-status
```

### API returns 502 "Splunk list_incidents failed"

**Cause**: Live Splunk MCP unreachable.

**Options**:
1. Check tunnel: `make tunnel-status`
2. Verify token: `echo $SPLUNK_MCP_TOKEN`
3. Fall back to mock: Set `SPLUNK_LIVE_MODE=false`

### Web shows "API request timeout"

**Cause**: API taking too long or unreachable.

**Fix**:
1. Check Docker: `docker compose ps`
2. Check logs: `docker compose logs api`
3. Increase timeout: `NEXT_PUBLIC_ACTION_TIMEOUT_MS=5000`

### Tests fail with "No module named 'decision_tracing'"

**Cause**: Docker not rebuilt with new PYTHONPATH.

**Fix**:
```bash
docker compose down
docker compose build --no-cache api
docker compose up
```

---

## Next Steps (Phase 8)

After live connectivity is verified:

1. **RBAC Integration** — Wire middleware.py into all routes
2. **Threat Model** — Deep dive into security gaps
3. **Load Testing** — Run against live Splunk
4. **Release Gate** — Add GitHub Actions validation
5. **Runbooks** — Document operational procedures

---

## References

- **API Code**: `apps/api/app/main.py`
- **Web Code**: `apps/web/lib/api.ts`
- **Live Service**: `apps/api/app/services/splunk_live.py`
- **Auth**: `packages/shared/auth/middleware.py`
- **Rate Limit**: `apps/api/app/middleware/rate_limit.py`
- **Adapter**: `packages/connectors/splunk-mcp/src/splunk_mcp/adapter.py`
- **Env Example**: `.env.example`
