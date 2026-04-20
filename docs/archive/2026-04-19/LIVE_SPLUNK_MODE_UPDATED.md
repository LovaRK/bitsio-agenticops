# Live Splunk Production Runbook

This runbook is the canonical guide to run BitsIO AgenticOps with real Splunk data via the MCP adapter.

---

## What This Validates

✅ **Incident List** — Queries `index=tutorial` via Splunk MCP
✅ **Incident Detail** — Searches Splunk for events, builds decision trace
✅ **Approval/Rejection** — Records decisions in in-memory trace store  
✅ **Evidence Links** — Generates Splunk search URLs for event context
✅ **No Mock Fallback** — `SPLUNK_LIVE_MODE=true` enforces real Splunk data

---

## Prerequisites

### Network Access
- SSH access to `root@144.202.48.85` (Splunk MCP server)
- SSH key configured or password-based auth available

### Local Dependencies
```bash
make bootstrap  # Install uv, pnpm, Python packages
```

### Valid Splunk Token
The JWT token in `.env` must:
- Be issued by Splunk's `internal-openclaw` auth service
- Have `aud: "mcp"` audience claim
- Have `idp: "Splunk"` identity provider
- Not be expired (check `exp` claim in token)

---

## Environment Setup

### Required Variables (in `.env`)

```bash
# Splunk MCP Endpoint (via SSH tunnel)
SPLUNK_MCP_BASE_URL=https://localhost:8089/services/mcp
SPLUNK_MCP_TOKEN=<copy valid JWT from Splunk>
SPLUNK_MCP_ROLE=read_only
SPLUNK_MCP_SSL_VERIFY=false                    # OK for localhost tunnel

# Splunk Web UI (for evidence search links)
SPLUNK_WEB_BASE_URL=http://144.202.48.85:8000

# Live Mode Activation
SPLUNK_LIVE_MODE=true                          # Enable Splunk queries
SPLUNK_ADAPTER_MODE=auto                       # Auto-detect MCP vs Native
NEXT_PUBLIC_USE_MOCK=false                     # No mock fallback in web
NEXT_PUBLIC_REQUIRE_LIVE_API=true              # Fail if API unreachable

# LLM (local Ollama, not Anthropic)
MODEL_PROVIDER=ollama
MODEL_NAME=qwen2.5:14b
ANTHROPIC_API_KEY=...                          # Ignored in local mode
OLLAMA_BASE_URL=http://127.0.0.1:11434        # If using Ollama

# Tenancy & Observability
TENANT_SAFE_ID=tenant_demo
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
```

### Optional Variables

```bash
# Auth (dev mode — no OIDC required)
OIDC_ISSUER=                                   # Leave empty for dev
OIDC_AUDIENCE=bitsio-api

# Rate Limiting
RATE_LIMIT_PER_MINUTE=100
REDIS_URL=redis://redis:6379/0

# Logging
LOG_LEVEL=INFO
APP_ENV=local
APP_TIMEZONE=UTC

# API Access
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
INTERNAL_API_BASE_URL=http://localhost:8001
```

---

## Startup Procedure (3 Terminals)

### Terminal A: SSH Tunnel (Keep Open)

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops

# Method 1: Using make
make tunnel-start

# OR Method 2: Direct SSH
ssh -N -L 8089:localhost:8089 root@144.202.48.85
# (Will ask for password or key passphrase)

# Verify tunnel is active
make tunnel-status
# Expected: "✅ Tunnel active (PID: XXXXX)"
```

### Terminal B: Start Docker Stack

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops

# Start all services (postgres, redis, api, web, mock-mcp, otel-collector, worker)
make dev

# Wait for all services to be "Up"
docker compose ps

# Tail API logs (in another pane)
docker compose logs -f api
```

### Terminal C: Verify Connectivity

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops

# Wait 5 seconds for services to stabilize
sleep 5

# Check API health
curl -s http://localhost:8001/health | jq .
# Expected: {"status":"ok","time":"2026-04-11T..."}

# Check live incident list
curl -s http://localhost:8001/api/v1/incidents \
  -H "x-api-key: dev-analyst" | jq '.items[0]'
# Expected: incident from Splunk tutorial index (not mock data)

# Check web is running
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200

# Open browser
open http://localhost:3000/incidents
```

---

## Data Flow Verification

### 1. API Health Check

```bash
curl -s http://localhost:8001/health
```

**Expected Response**:
```json
{"status":"ok","time":"2026-04-11T02:45:00.123456+00:00"}
```

### 2. Live Incident List

```bash
curl -s http://localhost:8001/api/v1/incidents \
  -H "x-api-key: dev-analyst" | jq '.items'
```

**Expected Response** (example):
```json
[
  {
    "id": "inc_20260408_42",
    "title": "Payments latency spike",
    "severity": "high",
    "status": "triaging",
    "timestamp": "2026-04-08T10:00:00Z",
    "source": "tutorial",
    "event_count": 127
  },
  ...
]
```

**Verification Checklist**:
- [ ] At least 1 incident returned
- [ ] All incidents from `tutorial` index (not mock data)
- [ ] `event_count > 0` (proves real Splunk data)
- [ ] No 502 errors (Splunk reachable)

### 3. Decision Trace Detail (Live Mode)

```bash
# Get an incident ID from step 2, e.g., "inc_20260408_42"
curl -s http://localhost:8001/api/v1/decision-traces/wf_inc_20260408_42 \
  -H "x-api-key: dev-analyst" | jq '{incident_id, confidence, node_runs}'
```

**Expected Response**:
```json
{
  "incident_id": "inc_20260408_42",
  "confidence": 0.78,
  "node_runs": [
    {"node_name": "incident_ingest", "status": "success", "duration_ms": 48},
    {"node_name": "evidence_retrieval", "status": "success", "duration_ms": 220},
    {"node_name": "correlation", "status": "success", "duration_ms": 105},
    ...
  ]
}
```

**Verification Checklist**:
- [ ] `incident_id` matches request
- [ ] `confidence` between 0.55 and 0.97
- [ ] All `node_runs` have `status: "success"`
- [ ] No 404 errors (trace found in Splunk)

### 4. Web UI Verification

Open http://localhost:3000

**Verification Checklist**:
- [ ] Incident list page loads (no JS errors)
- [ ] Shows at least 1 incident row
- [ ] Incident data is from Splunk, not mock
- [ ] Click incident row → detail page loads
- [ ] Detail page shows:
  - [ ] Incident title and severity
  - [ ] "Final Assessment" section
  - [ ] "Reasoning Timeline" with node execution trace
  - [ ] "Evidence" panel with Splunk search link
  - [ ] "Approval Gate" panel with Comment + Approve/Reject buttons

### 5. Approval Flow Test

```bash
# 1. Get a decision trace
WORKFLOW_ID="wf_inc_20260408_42"

# 2. Submit approval
curl -s -X POST http://localhost:8001/api/v1/decision-traces/$WORKFLOW_ID/approvals \
  -H "x-api-key: dev-approver" \
  -H "Content-Type: application/json" \
  -d '{"decision": "approve", "comment": "Verified host logs"}' | jq .

# 3. List approvals
curl -s http://localhost:8001/api/v1/decision-traces/$WORKFLOW_ID/approvals \
  -H "x-api-key: dev-analyst" | jq '.items'
```

**Expected Response**:
- [ ] Approval POST returns 200 with `{"decision": "approve", ...}`
- [ ] GET approvals returns list with your approval event
- [ ] Actor is `dev:dev-approver`

---

## Troubleshooting

### "Connection refused" on localhost:8089

**Symptom**: API logs show "Connection refused" or "timeout" when querying Splunk.

**Root Cause**: SSH tunnel not running.

**Fix**:
```bash
# Terminal A: Check tunnel
make tunnel-status

# If not running:
make tunnel-start

# Verify connectivity to Splunk
telnet localhost 8089
# Or: nc -zv localhost 8089
```

### "Invalid token" / "401 Unauthorized" from Splunk

**Symptom**: API logs show Splunk returning 401.

**Root Cause**: Token expired or invalid audience.

**Fix**:
1. Check token in `.env`:
   ```bash
   echo $SPLUNK_MCP_TOKEN | cut -d. -f2 | base64 -d | jq .
   # Look at "exp" field (Unix timestamp)
   ```

2. If expired, regenerate token in Splunk admin UI:
   - Settings → Tokens → Generate new MCP token
   - Copy to `.env`
   - Restart API: `docker compose restart api`

### No incidents showing in web UI

**Symptom**: Incident list page shows empty or "Loading...".

**Root Cause**: Either Splunk unreachable, or `tutorial` index is empty.

**Fix**:
1. Check API directly:
   ```bash
   curl -s http://localhost:8001/api/v1/incidents \
     -H "x-api-key: dev-analyst" | jq '.items | length'
   ```

2. If 0, check Splunk has data:
   ```bash
   # In Splunk Web UI (144.202.48.85:8000)
   # Search: index=tutorial | stats count
   # Should return count > 0
   ```

3. If no data, seed sample incidents via Splunk CLI or API.

### "No Splunk events found for incident"

**Symptom**: Detail page shows "Cannot find trace" when clicking incident.

**Root Cause**: Incident ID format mismatch or no events in Splunk with that ID.

**Fix**:
1. Verify incident ID in search:
   ```bash
   # In Splunk: search index=tutorial incident_id=inc_20260408_42
   # Should return events
   ```

2. If empty, the incident_id extraction query may be wrong; verify in `apps/api/app/services/splunk_live.py`.

### Rate limit (429) errors

**Symptom**: API returns 429 "rate_limit_exceeded".

**Root Cause**: Exceeded 100 requests/minute (default limit).

**Fix**:
```bash
# Increase limit in .env
RATE_LIMIT_PER_MINUTE=500

# Restart API
docker compose restart api
```

### OTel collector not receiving spans

**Symptom**: Monitoring UI shows no trace data.

**Root Cause**: Collector not running or endpoint unreachable.

**Fix**:
```bash
# Check collector is running
docker compose logs otel-collector

# Verify endpoint in .env
echo $OTEL_EXPORTER_OTLP_ENDPOINT
# Should be: http://otel-collector:4317
```

---

## Switching Between Mock and Live

**Quick test without Splunk** (for CI/local dev):
```bash
# In .env
SPLUNK_LIVE_MODE=false
NEXT_PUBLIC_USE_MOCK=true

# Restart
docker compose restart api web
```

**Back to live mode**:
```bash
# In .env
SPLUNK_LIVE_MODE=true
NEXT_PUBLIC_USE_MOCK=false

# Restart
docker compose restart api web
```

**No restart needed** if you only change environment variables in `.env.local` or Docker secrets.

---

## Runtime Configuration via API

Check current settings:
```bash
curl -s http://localhost:8001/api/v1/settings \
  -H "x-api-key: dev-analyst" | jq '.splunk'
```

**Expected Output**:
```json
{
  "adapter_mode": "auto",
  "live_mode": true,
  "base_url": "https://localhost:8089/services/mcp",
  "web_base_url": "http://144.202.48.85:8000",
  "connected": true,
  "index_count": 12
}
```

---

## Dashboard & Monitoring

### Dashboard Summary

```bash
curl -s http://localhost:8001/api/v1/dashboard/summary \
  -H "x-api-key: dev-analyst" | jq '.stats'
```

### Monitoring Overview

```bash
curl -s http://localhost:8001/api/v1/monitoring/overview \
  -H "x-api-key: dev-analyst" | jq '.services'
```

---

## Full Test Harness

```bash
# Run all tests
make test                    # Unit tests
pnpm --filter web test:e2e  # Web E2E
make live-verify            # Full live verification
```

---

## Shutdown

```bash
# Terminal B (API/Web)
Ctrl+C

# Terminal A (SSH Tunnel)
make tunnel-stop
# OR: Ctrl+C

# Clean up
docker compose down
```

---

## Next Steps

Once live mode is verified:

1. **Load Testing**: `make load-test` (requires `SPLUNK_LIVE_MODE=true`)
2. **RBAC Integration**: Wire `packages/shared/auth/middleware.py` into routes
3. **Threat Model**: Deep dive into security mitigations
4. **Runbooks**: Document incident response procedures
5. **Deployment**: Staging → Production

---

## References

- **API Implementation**: `apps/api/app/main.py`
- **Live Service**: `apps/api/app/services/splunk_live.py`
- **Web Client**: `apps/web/lib/api.ts`
- **Auth Middleware**: `packages/shared/auth/middleware.py`
- **Splunk Adapter**: `packages/connectors/splunk-mcp/src/splunk_mcp/`
- **Environment Example**: `.env.example` → `.env`
- **SSH Tunnel**: `docs/SSH_TUNNEL_SETUP.md`
- **Architecture Decision**: `docs/adr/ADR-008-*`
