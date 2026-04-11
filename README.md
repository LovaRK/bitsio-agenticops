# BitsIO AgenticOps

AI-powered observability platform for Splunk with explainable reasoning timelines, decision traces, and human approval gates.

## Quickstart

```bash
cp .env.example .env
make bootstrap
make dev
```

## Live Splunk MCP Mode

To run against real Splunk MCP (no mock fallback), set these env vars in `.env`:

```bash
SPLUNK_LIVE_MODE=true
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_REQUIRE_LIVE_API=true
SPLUNK_MCP_BASE_URL=<your_splunk_mcp_base_url>
SPLUNK_MCP_TOKEN=<your_splunk_mcp_token>
SPLUNK_WEB_BASE_URL=<your_splunk_web_base_url>
```

If Splunk management/MCP is not publicly reachable, expose it via firewall rule or SSH tunnel before starting the app.

API: `http://localhost:8001`
Web: `http://localhost:3000`

## Make Commands

- `make bootstrap`: install Python and JS dependencies
- `make dev`: start all local services via Docker Compose
- `make test`: run Python tests
- `make lint`: run Python and web lint checks
- `make seed`: seed sample incidents into PostgreSQL
- `make api-smoke`: run API smoke checks (RBAC, approvals, rate-limit, tenant isolation)
- `make verify-local`: deterministic local verification flow (stack + smoke + e2e + tests + eval)

`make api-smoke` uses auto mode:
- tries network checks against `http://localhost:8001`
- falls back to in-process `TestClient` checks if the API endpoint is unavailable

## Architecture (ASCII)

```text
[Next.js Web]
     |
     v
[FastAPI API] ---> [LangGraph Agent Core] ---> [Splunk MCP Adapter] ---> [Splunk MCP Server]
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
