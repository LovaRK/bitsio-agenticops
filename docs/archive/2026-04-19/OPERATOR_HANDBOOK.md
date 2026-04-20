# BitsIO AgenticOps — Operator Handbook

**Version**: 1.0  
**Date**: 2026-04-13  
**Status**: Phase 8 Live Integration — Production Ready

---

## Quick Start (3 Terminals)

### Terminal A: SSH Tunnel (Keep Open)

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops

# Start the tunnel
make tunnel-start

# Expected output: ✅ Tunnel active (PID: XXXXX)
# Keep this terminal open for the entire session
```

### Terminal B: Docker Stack

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops

# Start all 7 services
make dev

# Wait ~30 seconds for all services to stabilize
# Expected: api, web, postgres, redis, mock-mcp, otel-collector, worker all "Up"
```

### Terminal C: Verify & Launch

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops

# Wait 5 seconds for startup
sleep 5

# Check API health
curl -s http://localhost:8001/health | jq .
# Expected: {"status":"ok","time":"2026-04-13T..."}

# Check live incidents (NOT mock data)
curl -s http://localhost:8001/api/v1/incidents \
  -H "x-api-key: dev-analyst" | jq '.items | length'
# Expected: number > 0

# Open web UI
open http://localhost:3000/incidents
```

---

## Configuration Mode Matrix

Use this table to understand how different environment variable combinations affect system behavior:

| `SPLUNK_LIVE_MODE` | `SPLUNK_ADAPTER_MODE` | `NEXT_PUBLIC_USE_MOCK` | Result | When to Use |
|---|---|---|---|---|
| `true` | `auto` | `false` | Live Splunk via MCP or Native (auto-detected) | **Production** — Real data, SSH tunnel required |
| `true` | `mcp` | `false` | Live Splunk via MCP adapter only | Production with MCP endpoint enforced |
| `true` | `native` | `false` | Live Splunk via Native adapter only | Production with Native endpoint enforced |
| `false` | `auto` | `false` | Mock seed data only | **Local dev** — No Splunk, no tunnel needed |
| `false` | `auto` | `true` | Mock seed data with web fallback | CI/automated testing — No external deps |
| `true` | `auto` | `true` | Live Splunk, but web can fall back to mock | Not recommended — creates inconsistency |

**Default (Production Ready)**:
```bash
SPLUNK_LIVE_MODE=true
SPLUNK_ADAPTER_MODE=auto
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_REQUIRE_LIVE_API=true
```

**Local Dev (No Splunk)**:
```bash
SPLUNK_LIVE_MODE=false
SPLUNK_ADAPTER_MODE=auto
NEXT_PUBLIC_USE_MOCK=true
NEXT_PUBLIC_REQUIRE_LIVE_API=false
```

---

## 5-Minute Demo Script

**Audience**: Executives, stakeholders, security team  
**Goal**: Show incident triage workflow, AI reasoning, and approval gate

### Setup (Before Demo)

- Tunnel running and verified (`make tunnel-status`)
- All services running (`docker compose ps` shows 7 "Up")
- Web UI open at `http://localhost:3000/incidents`

### Talk Track

**[0:00] Title Slide**
> "BitsIO AgenticOps: AI-Driven Observability with Human Oversight"

**[0:30] The Problem**
> "Security teams are drowning in alerts. Splunk generates thousands per day. Most are false positives. Our platform connects to Splunk, uses AI to reason about incidents, and surfaces only the ones that need immediate human attention—with full transparency."

**[1:00] Live Demo: Incident List**
> (Click on Incident List page; show 5-10 incidents)
>
> "Each of these incidents came directly from our Splunk instance in real time. Notice the severity color coding (high/medium/low), event counts, and timestamps. No mock data—this is real."
>
> (Click on one incident row)

**[1:30] Live Demo: Decision Trace**
> (Show incident detail page)
>
> "Here's where it gets interesting. When the AI agent analyzed this incident, it went through 7 reasoning steps:
> 1. **Incident Ingest** — parsed raw data
> 2. **Evidence Retrieval** — queried Splunk for related events
> 3. **Correlation** — found patterns across systems
> 4. **Reasoning Draft** — generated AI explanation
> 5. **Confidence Scoring** — calculated trustworthiness (78%)
> 6. **Approval Check** — flagged for human review
> 7. **Final Response** — structured summary"
>
> (Point to the "Final Assessment" panel)
>
> "The AI says: 'Payment service experiencing latency due to database connection pool exhaustion on host prod-db-03. Recommend scaling or investigating query performance.'"
>
> (Point to the "Reasoning Timeline")
>
> "Every step is timestamped and traceable. No black box."

**[3:00] Evidence Links**
> (Click on "Evidence" panel; show Splunk search link)
>
> "Want to verify the AI's conclusion? Click 'View in Splunk' and you jump directly to the exact events the AI analyzed. Full traceability."

**[3:30] Approval Gate**
> (Scroll to "Approval Gate" section)
>
> "This is the critical control. The agent recommends. But a human must decide. An analyst can:
> - Add context or notes
> - Approve the recommendation
> - Reject and escalate to a security expert
> - Flag for manual investigation"
>
> (Type a comment: "Verified in ops runbook. Scaling initiated.")
> (Click "Approve")

**[4:15] Approval Recorded**
> (Show success message; optionally show audit log via API call)
>
> "Every approval is recorded with timestamp, actor ID, and comment. Immutable audit trail. This becomes your compliance evidence."

**[4:45] Behind the Scenes**
> "This entire flow runs in <2 seconds:
> - Splunk query: 200ms
> - AI reasoning: 800ms
> - Trace storage: 50ms
> - Web rendering: <1000ms
> 
> And it scales. Our rate limiter ensures no single tenant can starve others. With Redis backing, we handle 100+ requests per minute per tenant."

**[5:00] Close**
> "BitsIO AgenticOps turns observability chaos into clarity. AI handles the heavy lifting. Humans stay in control. Questions?"

---

## Troubleshooting Checklist

### Startup Issues

**Problem**: `make tunnel-start` fails with "Permission denied"  
**Cause**: SSH key not configured or passphrase needed  
**Fix**:
```bash
# One-time setup
ssh-copy-id -i ~/.ssh/id_rsa root@144.202.48.85

# Then try again
make tunnel-start
```

**Problem**: `docker compose ps` shows services "Exited" or "Restarting"  
**Cause**: Docker daemon not running or image build failed  
**Fix**:
```bash
# Start Docker (if using Colima)
colima start

# Rebuild images
docker compose down
docker compose build --no-cache

# Start fresh
make dev
```

**Problem**: API returns 502 "Bad Gateway" on `/api/v1/incidents`  
**Cause**: Splunk unreachable (tunnel down or token invalid)  
**Fix**:
```bash
# Check tunnel
make tunnel-status
# Expected: ✅ Tunnel active

# If down:
make tunnel-start

# Check token validity
echo $SPLUNK_MCP_TOKEN | cut -d. -f2 | base64 -d | jq '.exp'
# Compare to current Unix time: date +%s
# If exp < current time, token is expired — regenerate in Splunk UI
```

### Data Issues

**Problem**: Incident list page shows "Loading..." forever or empty  
**Cause**: Live Splunk unreachable OR tutorial index has no data  
**Fix**:
```bash
# Verify API directly
curl -s http://localhost:8001/api/v1/incidents \
  -H "x-api-key: dev-analyst" | jq '.items | length'

# If 0:
# 1. Check Splunk has data
#    - Log in to Splunk (144.202.48.85:8000)
#    - Search: index=tutorial | stats count
#    - Should return count > 0

# 2. If no data, seed sample incidents via Splunk CLI
#    (Contact Splunk admin)
```

**Problem**: Clicking an incident shows "Cannot find trace"  
**Cause**: Incident ID format mismatch OR no events in Splunk with that ID  
**Fix**:
```bash
# Verify incident has events in Splunk
# In Splunk Web: search index=tutorial incident_id=<the_incident_id>
# Should return at least 1 event

# If empty, the extraction query may be wrong
# Check: apps/api/app/services/splunk_live.py (list_incidents method)
```

### Authentication Issues

**Problem**: API returns 401 "Unauthorized"  
**Cause**: Invalid or expired token / missing x-api-key header  
**Fix**:
```bash
# For dev mode (no OIDC required):
# Make sure .env has OIDC_ISSUER empty (or unset)
# OIDC_ISSUER=

# Then cURL with dev key:
curl -s http://localhost:8001/api/v1/incidents \
  -H "x-api-key: dev-analyst"

# For production OIDC:
# Ensure token is valid JWT
# Check "aud" claim matches OIDC_AUDIENCE
# Check "exp" claim is in future
```

**Problem**: Web UI shows 401 when clicking incident  
**Cause**: Web client not sending x-api-key header (dev mode misconfigured)  
**Fix**:
```bash
# Check .env has OIDC_ISSUER empty (triggers dev mode)
cat .env | grep OIDC_ISSUER
# Should be empty or not present

# Restart web service
docker compose restart web

# Check browser console for errors
# (Cmd+Option+I → Console tab)
```

### Rate Limiting

**Problem**: API returns 429 "Too Many Requests"  
**Cause**: Exceeded 100 requests/minute limit (default)  
**Fix**:
```bash
# Increase limit in .env
RATE_LIMIT_PER_MINUTE=500

# Restart API
docker compose restart api

# Or use Redis explicitly
REDIS_URL=redis://redis:6379/0
docker compose restart api
```

### Mode Switching

**Problem**: Still seeing mock data when `SPLUNK_LIVE_MODE=true`  
**Cause**: Env variable not applied or old container running  
**Fix**:
```bash
# Edit .env
nano .env
# Confirm: SPLUNK_LIVE_MODE=true
#          NEXT_PUBLIC_USE_MOCK=false

# Restart containers
docker compose down
docker compose up api web

# Verify:
curl -s http://localhost:8001/api/v1/incidents \
  -H "x-api-key: dev-analyst" | jq '.items[0].source'
# Should say "tutorial" (Splunk source), not "seed"
```

**Problem**: Switching to mock mode (`SPLUNK_LIVE_MODE=false`) still queries Splunk  
**Cause**: Container cache or old .env value  
**Fix**:
```bash
# Full reset
docker compose down
make seed  # Populate PostgreSQL with mock data
docker compose up api web

# Verify:
curl -s http://localhost:8001/api/v1/incidents \
  -H "x-api-key: dev-analyst" | jq '.items[0].source'
# Should say "seed" (mock source)
```

### Performance & Monitoring

**Problem**: Web UI feels slow (>2s page loads)  
**Cause**: API latency, Splunk query slow, or Redis not connected  
**Fix**:
```bash
# Check Redis is running
docker compose ps redis
# Expected: "Up"

# Check API logs for slow queries
docker compose logs -f api | grep "duration_ms"
# Look for values >1000ms

# If Splunk query is slow:
# - Check Splunk index size: Index > Settings > Indexes > tutorial
# - Consider limiting date range in query (change "-24h" to "-1h")
# - Contact Splunk admin for index optimization

# Monitor OTel spans
# Check http://localhost:16686 (Jaeger) if exposed
```

### Shutdown

**Problem**: Services won't stop cleanly  
**Cause**: Lingering containers or tunnel still active  
**Fix**:
```bash
# Terminal B: Stop Docker stack
docker compose down -v  # -v removes volumes

# Terminal A: Stop tunnel
make tunnel-stop
# OR: Ctrl+C

# Verify all cleaned up
docker compose ps  # Should be empty
make tunnel-status  # Should be inactive
```

---

## Advanced: Runtime Configuration

**Check current settings via API:**
```bash
curl -s http://localhost:8001/api/v1/settings \
  -H "x-api-key: dev-analyst" | jq '.splunk'
```

**Expected output (live mode):**
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

## Testing & Validation

**Run full test suite:**
```bash
# Unit tests (Python)
make test
# Expected: 42 passed

# Web E2E tests
pnpm --filter web test:e2e
# Expected: 9 passed

# Full live verification
make live-verify
# Runs health check + API tests + E2E
```

---

## Key Contacts & Resources

- **Live Splunk Runbook**: `docs/LIVE_SPLUNK_MODE_UPDATED.md`
- **Implementation Guide**: `docs/IMPLEMENTATION_GUIDE.md`
- **Architecture Decision**: `docs/adr/ADR-008-live-splunk-mcp-integration.md`
- **Phase 8 Status**: `docs/plan/PHASE_8_STATUS.md`
- **Splunk Admin**: `root@144.202.48.85` (SSH access required)

---

**End of Operator Handbook**
