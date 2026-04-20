# Live Splunk Production Runbook

This runbook is the canonical guide to run BitsIO AgenticOps with real Splunk data.

## What This Verifies

- Real incident list from Splunk (`index=tutorial`)
- Real incident detail generation from live logs
- Approval and rejection APIs from browser
- No mock fallback in UI

## Prerequisites

- Working SSH access to `root@144.202.48.85`
- Active Splunk JWT token in `.env`:
  - `SPLUNK_MCP_TOKEN=...`
- Local dependencies installed:
  - `make bootstrap`

## Required Environment

Set these values in `/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops/.env`:

```bash
SPLUNK_LIVE_MODE=true
SPLUNK_ADAPTER_MODE=native
SPLUNK_MCP_BASE_URL=https://localhost:8089
SPLUNK_MCP_SSL_VERIFY=false
SPLUNK_AUTH_SCHEME=Bearer
SPLUNK_WEB_BASE_URL=http://144.202.48.85:8000

NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_REQUIRE_LIVE_API=true
```

## Startup (3 Terminals)

### Terminal A (Tunnel)

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops
make tunnel-start
make tunnel-status
```

### Terminal B (API)

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops
make live-api
```

### Terminal C (Web)

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops
make live-web
```

Open browser:

- `http://127.0.0.1:3000/incidents`

## If Tutorial Data Is Missing

Seed realistic demo records into Splunk:

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops
make live-seed
```

Then refresh `/incidents`.

## API Verification

Run full live API checks:

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops
make live-verify
```

Expected:

- `/health` passes
- `/api/v1/incidents` returns items
- `/api/v1/decision-traces/{id}` returns live trace
- approve + reject calls return `200`
- approval list reflects latest decisions

## Browser Verification Checklist

1. `/incidents` page loads with no runtime error.
2. At least one incident row is visible.
3. Click `Details` for first row.
4. Detail page shows:
   - `Final Assessment`
   - `Reasoning Timeline`
   - `Decision Gate` (for high/medium severity)
5. Enter comment and click `Approve`:
   - success message appears.
6. Reload page, click `Reject`:
   - rejection message appears.
7. Navigate side menu links:
   - Dashboard, Incidents, Approvals, Monitoring, Settings, Support.

## Switching Between Mock and Live (No Restart)

From `Settings -> Runtime Control`:

- Select `Runtime Profile`:
  - `Local Dev` for safe demo defaults.
  - `Cloud Live` for production-like defaults.
- `Use Live Splunk Data = ON`:
  - API serves incidents and traces from Splunk.
- `Use Live Splunk Data = OFF`:
  - API serves local seeded incidents for deterministic demos.
- Use `Test Connections` to validate both:
  - model runtime path
  - Splunk adapter connectivity

Keep `Splunk Adapter Mode` aligned with your backend:
- `mcp` -> `/services/mcp/*`
- `native` -> `/services/search/jobs/export`
- `auto` -> infer by URL

## Troubleshooting

### 401 Unauthorized from Splunk

- Token expired or wrong audience/scope.
- Regenerate token and update `.env`.

### No incidents shown

- Verify tunnel is active (`make tunnel-status`).
- Run `make live-seed`.
- Confirm API log does not show 502 from Splunk.

### Approve/Reject fails in browser

- Ensure API started via `make live-api` (includes CORS middleware).
- Ensure web started via `make live-web` with `NEXT_PUBLIC_REQUIRE_LIVE_API=true`.

### Tunnel not working

- Stop and restart:
  - `make tunnel-stop`
  - `make tunnel-start`

## Shutdown

```bash
make tunnel-stop
```
