# Phase 8: Live Splunk Integration — Complete Documentation

**Last Updated**: 2026-04-11  
**Status**: Implementation Complete | Network Access Pending  
**Overall Progress**: 40-50% (Core code ready; hardening pending)

---

## Quick Links

📖 **Read These First**:
- [`IMPLEMENTATION_GUIDE.md`](./IMPLEMENTATION_GUIDE.md) — How the app actually works
- [`LIVE_SPLUNK_MODE_UPDATED.md`](./LIVE_SPLUNK_MODE_UPDATED.md) — Production runbook with verification steps
- [`SSH_TUNNEL_SETUP.md`](./SSH_TUNNEL_SETUP.md) — How to set up network access

🏗️ **Architecture**:
- [`adr/ADR-008-live-splunk-mcp-integration.md`](./adr/ADR-008-live-splunk-mcp-integration.md) — Why we chose this approach

📊 **Status & Planning**:
- [`plan/PHASE_8_STATUS.md`](./plan/PHASE_8_STATUS.md) — Current blockers and effort estimates

---

## What Was Built (Phase 8, Week 1)

### ✅ Live Splunk MCP Integration

**Code**:
- `SplunkIncidentService` (`apps/api/app/services/splunk_live.py`)
  - `list_incidents(limit=50)` — queries `index=tutorial` via MCP
  - `get_decision_trace(incident_id)` — builds trace from Splunk events
  - Calculates confidence, extracts host evidence, synthesizes node timeline

**API Wiring** (`apps/api/app/main.py`):
- `GET /api/v1/incidents` — uses `_load_incidents()` switch
  - If `SPLUNK_LIVE_MODE=true` → queries Splunk live
  - If false → returns `SEED_INCIDENTS` (mock data)
- `GET /api/v1/decision-traces/{id}` — checks store first, then Splunk
- Rate limiting middleware (100 req/min default)
- RBAC auth (`require_analyst`, `require_approver`)

**Web Integration** (`apps/web/lib/api.ts`):
- `listIncidents()` → fetches from API with `x-api-key: dev-analyst`
- `getDecisionTrace()` → fetches full trace detail
- No mock fallback when `NEXT_PUBLIC_REQUIRE_LIVE_API=true`

**Docker Fixes**:
- `api.Dockerfile` — added `PYTHONPATH` for local packages
- `web.Dockerfile` — fixed `--hostname` flag for Next.js 14+

**Testing**:
- ✅ 42/42 unit tests passing
- ✅ 8/8 web E2E tests passing
- ✅ All 7 Docker services running

---

## How It Works (Data Flow)

### Request: List Incidents

```
Browser: GET /incidents
  ↓
Web (api.ts): fetch("http://localhost:8001/api/v1/incidents", {x-api-key: dev-analyst})
  ↓
API (main.py): GET /api/v1/incidents
  ├─ Check auth: require_analyst
  ├─ Call _load_incidents(splunk_service)
  │   └─ if SPLUNK_LIVE_MODE: splunk_service.list_incidents()
  │   └─ else: return SEED_INCIDENTS
  │
  └─ SplunkIncidentService.list_incidents():
      ├─ Build query: "search index=tutorial | rex ... | stats ..."
      ├─ Call: adapter.run_search(query, earliest="-24h", latest="now")
      ├─ Parse results, normalize fields
      └─ Return: list[IncidentSummary]
  
API returns: {"items": [IncidentSummary, ...]}
  ↓
Web renders: Incident list view (/incidents)
```

### Request: Get Decision Trace Detail

```
Browser: GET /incidents/inc_20260408_42
  ↓
Web (api.ts): fetch("http://localhost:8001/api/v1/decision-traces/wf_inc_20260408_42")
  ↓
API (main.py): GET /api/v1/decision-traces/{workflow_id}
  ├─ Check auth: require_analyst
  ├─ Check in-memory store.get(workflow_id)
  │   └─ If found: return trace
  │   └─ If not found AND SPLUNK_LIVE_MODE=true:
  │
  └─ SplunkIncidentService.get_decision_trace():
      ├─ Normalize incident_id
      ├─ Build query: "search index=tutorial incident_id=... | head 200"
      ├─ Call: adapter.run_search(...)
      ├─ Extract: title, severity, status, hosts (for probable_cause)
      ├─ Calculate: confidence = 0.55 + (events / 500)
      ├─ Build: evidence_refs (Splunk search links)
      ├─ Generate: node_runs timeline (fake agent execution)
      └─ Return: DecisionTrace{workflow_id, incident_id, node_runs, ...}

API returns: DecisionTrace (JSON)
  ↓
Web renders: Timeline, Evidence panel, Approval gate
```

### Request: Submit Approval

```
Browser: User clicks "Approve" in ApprovalPanel
  ↓
Web (api.ts): POST /api/v1/decision-traces/{workflow_id}/approvals
  Body: {decision: "approve", comment: "..."}
  Headers: {x-api-key: dev-approver}
  ↓
API (main.py): POST /api/v1/decision-traces/{workflow_id}/approvals
  ├─ Check auth: require_approver (needs x-api-key: dev-approver)
  ├─ TraceService.add_approval(workflow_id, payload)
  │   └─ Look up trace in store (already created by POST create_decision_trace)
  │   └─ Append ApprovalEvent(decision, actor, timestamp)
  │
  └─ Return: {"decision": "approve", "actor": "dev:dev-approver", ...}

Web shows: Success toast, optionally reloads trace
```

---

## Configuration (Environment Variables)

### Must Set (Live Mode)

```bash
# Splunk MCP Server Access
SPLUNK_MCP_BASE_URL=https://localhost:8089/services/mcp
SPLUNK_MCP_TOKEN=<JWT from Splunk>
SPLUNK_MCP_ROLE=read_only
SPLUNK_MCP_SSL_VERIFY=false                    # OK for local tunnel

# Splunk Web (for evidence links)
SPLUNK_WEB_BASE_URL=http://144.202.48.85:8000

# Live Mode Flags
SPLUNK_LIVE_MODE=true                          # Enable Splunk queries
NEXT_PUBLIC_USE_MOCK=false                     # No mock fallback
NEXT_PUBLIC_REQUIRE_LIVE_API=true              # Fail if API unreachable
```

### Optional (Defaults Work)

```bash
# Adapter mode (auto-detect from URL)
SPLUNK_ADAPTER_MODE=auto                       # or "mcp" or "native"

# Auth (dev mode)
OIDC_ISSUER=                                   # Leave empty for dev

# Rate limiting
RATE_LIMIT_PER_MINUTE=100

# LLM (local Ollama)
MODEL_PROVIDER=ollama
MODEL_NAME=qwen2.5:14b

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
TENANT_SAFE_ID=tenant_demo
```

See `.env.example` for complete list.

---

## Start the App (3 Steps)

### Step 1: SSH Tunnel (Terminal A)

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops

# Option A: Using make
make tunnel-start

# Option B: Direct SSH
ssh -N -L 8089:localhost:8089 root@144.202.48.85
# (Keep this terminal open; it will ask for password or SSH key passphrase)

# Verify:
make tunnel-status
# Expected: "✅ Tunnel active (PID: XXXXX)"
```

### Step 2: Start Docker Stack (Terminal B)

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops

# Start all services
make dev

# Wait for all 7 services to be "Up"
docker compose ps

# Expected services:
# - api (port 8001)
# - web (port 3000)
# - postgres (port 5432)
# - redis (port 6379)
# - mock-mcp (port 8081)
# - otel-collector (ports 4317/4318)
# - worker
```

### Step 3: Verify & Open (Terminal C)

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops

# Check API health
curl -s http://localhost:8001/health | jq .
# Expected: {"status":"ok","time":"2026-04-11T..."}

# Check live incidents (should NOT be mock data)
curl -s http://localhost:8001/api/v1/incidents \
  -H "x-api-key: dev-analyst" | jq '.items[0]'
# Expected: incident from Splunk, not SEED_INCIDENTS

# Open web browser
open http://localhost:3000/incidents
```

---

## Authentication

### Dev Mode (Default)

No setup needed. The web app automatically adds `x-api-key: dev-analyst` to all requests.

**Dev Keys**:
- `dev-viewer` → Read-only
- `dev-analyst` → Can view incidents, traces, approvals
- `dev-approver` → Can approve/reject incidents
- `dev-secret` → Admin access

### Production Mode

When `OIDC_ISSUER` is set, API requires Bearer JWT tokens:

```bash
# Client sends:
curl -H "Authorization: Bearer <JWT token>" \
  http://api.example.com/api/v1/incidents

# API validates JWT, extracts role from "role" claim
# Supported roles: viewer, analyst, approver, admin
```

---

## Rate Limiting

**Active on all routes except `/health`**.

**Per-tenant buckets** (60-second windows):
- Default: 100 requests/minute
- Tenant ID from `x-tenant-id` header (defaults to `tenant_demo`)
- Uses Redis if available; falls back to in-memory

**Response**:
- 200 OK if within limit
- 429 Too Many Requests if exceeded + `Retry-After: 60` header

---

## Observability

**OpenTelemetry** instrumentation:
- All FastAPI routes → spans with 8-tag matrix
- SQLAlchemy (not used in MVP)
- LLM calls (when configured)

**Export**: OTLP gRPC to `http://otel-collector:4317`

**Tags on all spans**:
```
service.name, graph.name, graph.version, 
workflow_id, tenant.safe_id, env, model.provider
```

---

## Testing

```bash
# Unit tests (42 passing)
make test

# Web E2E tests (8 passing)
pnpm --filter web test:e2e

# Live verification suite
make live-verify
# (Runs API smoke + E2E + eval harness)

# Load testing
make load-test
# (Requires SPLUNK_LIVE_MODE=true)
```

---

## Common Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "Connection refused" on 8089 | SSH tunnel not running | `make tunnel-start` |
| API returns 502 "Splunk failed" | Splunk unreachable | Check tunnel; verify token |
| No incidents showing | Live Splunk empty or unreachable | Check Splunk has data in tutorial index |
| Web shows "Loading..." forever | API timeout | Check `docker compose ps`; verify tunnel |
| Tests fail "No module decision_tracing" | Docker image not rebuilt | `docker compose down; docker compose build --no-cache api` |

See [`IMPLEMENTATION_GUIDE.md`](./IMPLEMENTATION_GUIDE.md#troubleshooting) for detailed troubleshooting.

---

## Architecture Decisions

**Why SSH Tunnel instead of public port 8089?**

See [`adr/ADR-008-live-splunk-mcp-integration.md`](./adr/ADR-008-live-splunk-mcp-integration.md):
- Security: Keeps Splunk API private; encrypted tunnel
- Compliance: Zero-trust network boundary
- Cost: No additional infrastructure
- Trade-off: One extra terminal for local dev (acceptable)

**Why SplunkIncidentService instead of raw adapter calls?**

- Abstraction: Decouples Splunk query strategy from API routes
- Testability: Can mock service in unit tests
- Flexibility: Easy to swap Splunk query logic later
- Reusability: Service used by multiple API endpoints

---

## Phase 8 Remaining Work

After live connectivity is verified:

| Task | Effort | Dependencies |
|------|--------|--------------|
| RBAC middleware wiring | 8-10h | None (code exists) |
| Threat model implementation | 4-6h | RBAC first |
| Load testing | 6-8h | RBAC first |
| Release gate workflow | 3-4h | None |
| Runbooks (incident response, token rotation) | 4-6h | None |

**Total for full hardening**: 25-35 hours (3-4 days at 8h/day)

See [`plan/PHASE_8_STATUS.md`](./plan/PHASE_8_STATUS.md) for detailed breakdown.

---

## Success Criteria

✅ **Code** — All complete and tested (42 unit + 8 e2e tests passing)  
⏳ **Network** — SSH tunnel to 144.202.48.85:8089 established  
⏳ **Live Testing** — Real Splunk incidents appearing in UI  
⏳ **Phase 8A** — RBAC + threat model implemented  
⏳ **Phase 8B** — Load tests passing against live Splunk  
⏳ **Production Ready** — Security review + runbooks complete

---

## Implementation Files

**Core API**:
- `apps/api/app/main.py` — All routes
- `apps/api/app/services/splunk_live.py` — Live incident queries
- `apps/api/app/dependencies.py` — Dependency injection
- `apps/api/app/middleware/rate_limit.py` — Rate limiting
- `apps/api/app/middleware/otel.py` — OTel instrumentation

**Web**:
- `apps/web/lib/api.ts` — API client
- `apps/web/app/incidents/page.tsx` — Incident list
- `apps/web/app/incidents/[id]/page.tsx` — Incident detail

**Authentication & Shared**:
- `packages/shared/auth/middleware.py` — RBAC (dev/prod modes)

**Splunk Adapter**:
- `packages/connectors/splunk-mcp/src/splunk_mcp/adapter.py` — MCP + Native adapters

**Docker**:
- `infra/docker/compose/api.Dockerfile`
- `infra/docker/compose/web.Dockerfile`
- `docker-compose.yml`

---

## Next Session Checklist

- [ ] Read [`IMPLEMENTATION_GUIDE.md`](./IMPLEMENTATION_GUIDE.md)
- [ ] Read [`LIVE_SPLUNK_MODE_UPDATED.md`](./LIVE_SPLUNK_MODE_UPDATED.md)
- [ ] Set up SSH to 144.202.48.85 (run `make tunnel-start`)
- [ ] Start Docker stack (`make dev`)
- [ ] Verify live Splunk data appears (`curl` test from docs)
- [ ] Open web UI and confirm real incidents show
- [ ] Decide: Start Phase 8A hardening, or test load first?

---

## References

All documentation is in `docs/`:
- **Architecture**: `IMPLEMENTATION_GUIDE.md`, `adr/ADR-008-*`
- **Operations**: `LIVE_SPLUNK_MODE_UPDATED.md`, `SSH_TUNNEL_SETUP.md`
- **Planning**: `plan/PHASE_8_STATUS.md`

All code is annotated with references to these docs.

---

**End of Phase 8 Documentation Update**

*Last generated: 2026-04-11*
