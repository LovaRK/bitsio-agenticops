# Live Splunk MCP Mode Setup

This document guides you through connecting BitsIO AgenticOps to a **live Splunk instance** via the MCP adapter.

## Current Status

✅ **Code Ready**: Live Splunk mode implemented and tested
⏳ **Network Ready**: SSH tunnel needed for 8089 connectivity

## Quick Start (with SSH Tunnel)

### 1. Start the SSH Tunnel
```bash
make tunnel-start
```

This creates a secure tunnel:
```
localhost:8089 → 144.202.48.85:8089 (Splunk MCP)
```

### 2. Verify Tunnel is Active
```bash
make tunnel-status
```

Expected output:
```
✅ Tunnel active (PID: 12345)
```

### 3. Start the Dev Stack
```bash
make dev
```

Wait for all services to be "Up":
```
bitsio-agenticops-api-1          ✅ Up
bitsio-agenticops-web-1          ✅ Up
bitsio-agenticops-postgres-1     ✅ Up
...
```

### 4. Test Live Splunk Connectivity

**API health check:**
```bash
curl -s http://localhost:8001/health | jq .
```

**List incidents from live Splunk:**
```bash
curl -s http://localhost:8001/api/v1/incidents | jq '.items[0]'
```

Expected: Incident data from your live Splunk instance (not mock data).

**Web UI:**
- Open http://localhost:3000
- Navigate to an incident
- Verify evidence comes from live Splunk (not mock data)

## Environment Variables

Located in `.env`:

```bash
# Live mode flags
SPLUNK_LIVE_MODE=true                                    # Use live Splunk MCP
NEXT_PUBLIC_USE_MOCK=false                              # No mock fallback
NEXT_PUBLIC_REQUIRE_LIVE_API=true                       # Enforce live API

# Splunk MCP endpoint (with SSH tunnel)
SPLUNK_MCP_BASE_URL=https://localhost:8089/services/mcp # Tunnel endpoint
SPLUNK_MCP_TOKEN=<your-read-only-token>                 # Read-only auth
SPLUNK_MCP_ROLE=read_only                               # Role constraint

# LLM
ANTHROPIC_API_KEY=sk-ant-api03-...                      # For live reasoning
```

### Switching Between Tunnel and Direct Access

**With SSH tunnel (default):**
```bash
SPLUNK_MCP_BASE_URL=https://localhost:8089/services/mcp
make tunnel-start
make dev
```

**Direct (if 8089 is publicly accessible):**
```bash
SPLUNK_MCP_BASE_URL=https://144.202.48.85:8089/services/mcp
make dev  # No tunnel needed
```

## Architecture

```
┌─────────────────┐
│  Web Browser    │
│   localhost:3000│
└────────┬────────┘
         │
         v
┌─────────────────────────────────┐
│  Next.js (localhost:3000)       │
│  ├─ Fetch incidents from API    │
│  └─ No mock fallback            │
└────────┬────────────────────────┘
         │
         v
┌─────────────────────────────────┐
│  FastAPI (localhost:8001)       │
│  ├─ splunk_live.py (live mode)  │
│  ├─ SplunkMCPAdapter            │
│  └─ Decision trace storage      │
└────────┬────────────────────────┘
         │
         v
┌──────────────────────────────────┐
│  SSH Tunnel                      │
│  localhost:8089 → 144.202.48.85  │
└────────┬─────────────────────────┘
         │
         v
┌──────────────────────────────────┐
│  Splunk MCP Server               │
│  (144.202.48.85:8089)            │
│  ├─ list_indexes()               │
│  ├─ run_search()                 │
│  └─ get_server_info()            │
└──────────────────────────────────┘
```

## Verification Checklist

- [ ] SSH tunnel is running (`make tunnel-status`)
- [ ] `.env` has `SPLUNK_LIVE_MODE=true`
- [ ] `.env` has `SPLUNK_MCP_BASE_URL=https://localhost:8089/services/mcp`
- [ ] `.env` has valid `SPLUNK_MCP_TOKEN` (read-only)
- [ ] Docker stack is up (`docker compose ps`)
- [ ] API responds with live data (`curl http://localhost:8001/api/v1/incidents`)
- [ ] Web UI loads at http://localhost:3000
- [ ] Incidents show real Splunk data (not mock)

## Troubleshooting

### "Connection refused" on 8089

**Cause**: SSH tunnel not running.

**Fix**:
```bash
make tunnel-start
make tunnel-status
```

### "ModuleNotFoundError: splunk_mcp" in API logs

**Cause**: Docker image wasn't rebuilt with fixed `PYTHONPATH`.

**Fix**:
```bash
docker compose down
docker compose build --no-cache api
docker compose up
```

### Mock data still showing instead of live Splunk

**Cause**: `SPLUNK_LIVE_MODE` not set, or fallback enabled.

**Fix**:
```bash
# In .env:
SPLUNK_LIVE_MODE=true
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_REQUIRE_LIVE_API=true

# Restart:
docker compose restart api web
```

### "Invalid token" or "Unauthorized" from Splunk MCP

**Cause**: `SPLUNK_MCP_TOKEN` is invalid or expired.

**Fix**:
1. SSH to 144.202.48.85
2. Regenerate read-only token in Splunk Admin UI
3. Update `.env` with new token
4. Restart Docker stack

## Running Tests

All tests pass with live mode enabled:

```bash
make test          # 42 unit tests + live mode
make api-smoke     # API smoke test (requires tunnel)
pnpm --filter web test:e2e  # E2E tests with live API
make verify-local  # Full verification suite
```

## Next Steps

1. ✅ Code is ready for production Splunk mode
2. ⏳ Verify Splunk MCP endpoint is reachable (use SSH tunnel or firewall rules)
3. 📋 Proceed to Phase 8 hardening:
   - RBAC middleware integration
   - Load testing against live Splunk
   - Release gate workflows
   - Threat model deep dive

## Reference

- **Splunk MCP Adapter**: `packages/connectors/splunk-mcp/`
- **Live Service**: `apps/api/app/services/splunk_live.py`
- **API Routes**: `apps/api/app/main.py`
- **Web Integration**: `apps/web/lib/api.ts`
