# BitsIO AgenticOps

AI-powered observability platform for Splunk with explainable reasoning timelines, decision traces, and human approval gates.

## Quickstart

```bash
cp .env.example .env
make bootstrap
make dev
```

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
