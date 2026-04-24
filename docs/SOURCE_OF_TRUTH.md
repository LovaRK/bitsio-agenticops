# BitsIO AgenticOps — Single Source of Truth

Last updated: 2026-04-24 (morning)
Owner: Core Engineering (Codex-led)
Status: Canonical

## 1. Product Definition

BitsIO AgenticOps is an AI-powered observability platform on top of Splunk.

Core outcomes:
- convert raw telemetry into explainable incident and risk narratives
- enforce human approval gates before high-risk actions
- keep immutable decision traces for audit and compliance
- support model/runtime and Splunk adapter switching without app rewrites

Current primary feature surfaces:
- Dashboard (`/`)
- Incidents (`/incidents`, `/incidents/{id}`)
- Approvals (`/approvals`)
- Monitoring (`/monitoring`)
- Telemetry Value Impact (`/telemetry-value`)
- Fraud Risk Analysis (`/fraud-risk`)
- Agent Portfolio (`/agent-portfolio`) — Customer Health, Recovery Orchestrator, Migration Assurance
- Settings (`/settings`)

## 2. Architecture

Stack:
- Web: Next.js App Router + TypeScript
- API: FastAPI + Pydantic
- Agent core: LangGraph-style node workflows
- Connectors: Splunk MCP adapter + Native Splunk adapter
- Persistence: PostgreSQL + pgvector, Redis
- Observability: OpenTelemetry

Runtime model:
- Local model: `ollama`
- Cloud model: `anthropic`
- Stub mode for deterministic testing

Splunk modes:
- `mcp` for `/services/mcp/*`
- `native` for `/services/search/jobs/export`
- `auto` inference

Adapter policy (implemented):
- deterministic API surfaces (Dashboard, Incidents, Fraud, Telemetry Value) use **native-first** resolution when `SPLUNK_ADAPTER_MODE=auto`
- agentic workload surfaces use **MCP-preferred** resolution when `SPLUNK_ADAPTER_MODE=auto` and MCP endpoint is available
- explicit mode selection (`mcp` or `native`) always overrides auto behavior

## 3. Live vs Mock Data Rules

Core tabs are now configured live-first:
- Dashboard (`/`)
- Incidents (`/incidents`)
- Approvals (`/approvals`)
- Monitoring (`/monitoring`)
- Telemetry Value Impact (`/telemetry-value`)

By default these routes do **not** silently fallback to mock payloads.
If live data is unavailable, the UI shows an explicit live-data error panel and recovery actions.

Current live behavior (verified 2026-04-22):
- live connectivity can be healthy while specific feature datasets are empty (query/time-window mismatch)
- dashboard/incidents return empty-state payloads with explicit `degraded_reason` when no matching live incidents exist
- fraud live route returns explicit `"degraded_reason":"No matching live fraud telemetry found in current search window."` when no matching fraud signals exist

Optional development override:
- `NEXT_PUBLIC_MAIN_TABS_ALLOW_FALLBACK=true`
- only use this for local sandbox debugging, never for production-like demos

Expected indicators:
- `mode: live` and `degraded_reason: null` => true live data
- `mode: seed` or non-null degraded_reason => fallback data

## 4. Local Runbook (Authoritative)

From repo root:

```bash
cp .env.example .env
make bootstrap
```

For live Splunk scenario:

```bash
make tunnel-start
make live-api
make live-web
```

Preferred one-shot local command:

```bash
make local
```

Current Splunk target profile:
- host: `45.76.167.6`
- API mode used by runtime: `native`
- `SPLUNK_MCP_BASE_URL` still required for adapter base config

Health checks:

```bash
curl http://127.0.0.1:8001/health
curl http://127.0.0.1:8001/api/v1/settings -H 'x-api-key: dev-analyst'
curl http://127.0.0.1:8001/api/v1/settings/runtime/check -H 'x-api-key: dev-analyst'
curl http://127.0.0.1:8001/api/v1/dashboard/summary -H 'x-api-key: dev-analyst'
curl http://127.0.0.1:8001/api/v1/incidents -H 'x-api-key: dev-analyst'
curl 'http://127.0.0.1:8001/api/v1/fraud/overview?mode=auto' -H 'x-api-key: dev-analyst'
```

If web chunk/cache errors appear:

```bash
cd apps/web
rm -rf .next node_modules/.cache
cd ../..
pnpm --filter web dev --hostname 127.0.0.1 --port 3000
```

## 5. Runtime Control Contract

Single runtime mode control (settings UI + API):
- `LOCAL_DEV`
- `LOCAL_INTEGRATION`
- `CLOUD_MODEL_TEST`
- `CLOUD_LIVE`

Endpoint:
- `PUT /api/v1/settings/runtime`

Connectivity check:
- `GET /api/v1/settings/runtime/check`

## 6. Core API Surface (Current)

- `GET /api/v1/incidents`
- `GET /api/v1/decision-traces/{workflow_id}`
- `POST /api/v1/decision-traces/{workflow_id}/approvals`
- `GET /api/v1/decision-traces/{workflow_id}/approvals`
- `GET /api/v1/monitoring/overview`
- `GET /api/v1/waste/telemetry/metrics`
- `POST /api/v1/waste/analyze/live`
- `GET /api/v1/fraud/overview?mode=auto|seed|live`
- `GET /api/v1/fraud/demo`
- `POST /api/v1/fraud/analyze/live`
- `GET /api/v1/settings`
- `PUT /api/v1/settings/runtime`
- `GET /api/v1/settings/runtime/check`

Telemetry waste response contract (applies to `GET /api/v1/waste/demo`, `POST /api/v1/waste/analyze/live`, and provisional `POST /api/v1/waste/analyze`):
- `governance`: `policy_id`, `policy_version`, `rule_triggered`, `approval_reason`, `source`
- `security`: `data_classification`, `compliance_frameworks`, `encryption_required`, `risk_level`, `source`

Telemetry metrics contract (`GET /api/v1/waste/telemetry/metrics`) also includes:
- `governance`: `policy_id`, `policy_version`, `rule_triggered`, `approval_reason`, `approval_status`, `data_owner`, `last_reviewed`, `source`
- `security`: `data_classification`, `compliance_frameworks`, `encryption_required`, `risk_level`, `security_confidence`, `source`
- `conflicts[]`: policy-vs-optimization conflicts (`source`, `recommendation`, `conflict_reason`, `suggested_action`, `severity`)
- `trust`: runtime provenance (`data_source`, `fallback_used`, `adapter_mode`, `backend`, `latency_ms`, `confidence`, `freshness`, `coverage_pct`, `source`)
- `actions[]`: recommended governance/security follow-up actions (`label`, `description`, `cta`, `severity`, `source`)

## 7. Fraud Risk Feature Contract

Fraud Risk is implemented as production feature, not standalone demo.

Must always include:
- KPI summary (open cases, avg risk, exposure, data quality)
- active fraud cases table
- policy evaluation block
- compliance metadata
- agent telemetry metadata
- direct link to incident context

Propose-only safety:
- recommendations require human approval before action

## 8. Quality Gates

Mandatory before merge:

```bash
make test
pnpm --filter web lint
```

Current baseline: tests must stay green and no runtime regression in core routes.

Browser/runtime checks (required before release):
- root + core tabs return HTTP 200 while local web/api are running
- runtime settings actions emit success/error user alerts
- route transition animation and hover help remain functional
- incident context enrichment failures must not spam global toast errors
- quick resolve must return informative empty-state when no high-priority approvals exist
- incident tool detail cards are expanded by default and user-collapsible

## 9. Branching Strategy

Until remote permissions are finalized, local-first workflow:
- `main`: protected/stable baseline
- `develop`: integration branch
- `feature/*`: isolated implementation slices

Merge order:
1. feature -> develop
2. full validation
3. develop -> main

No force pushes, no hard resets, no rewriting user-authored history.

## 10. Documentation Governance

This file is the only active canonical engineering spec.

Policy from now:
- new operational/architecture/process updates go into this file
- legacy docs remain under `docs/archive/` for reference only
- avoid creating parallel docs unless explicitly requested

## 11. Refactor Principles (Enforced)

- SOLID-oriented modular boundaries
- DI-first service wiring in API and agent layers
- remove duplicate logic before adding new features
- typed contracts at boundaries (Pydantic/TS types)
- no hidden behavior; runtime mode and data source must be visible in UI

## 12. Production Folder Structure (Current)

```
apps/
  api/
    app/
      routers/                  # HTTP contracts only
      services/                 # business/service logic (DI-friendly)
        runtime_profiles.py     # runtime-mode matrix + resolver
        runtime_connectivity.py # model/splunk health checks
        splunk_tunnel.py        # local tunnel orchestration
        splunk_live.py          # live incident/trace assembly from Splunk
      middleware/
  web/
    app/                        # route handlers/pages
    components/                 # UI composition
    lib/
      services/                 # route-independent data services
        serviceFetch.ts         # shared fallback + timeout fetch helper
```

Module boundary rules:
- `routers/*` should be thin (validation + orchestration only).
- shared runtime logic must live in `services/*` and be reused by routers.
- web services should use `serviceFetch.ts` for fallback/timeout behavior instead of duplicating try/catch blocks.
- feature pages (`/incidents`, `/fraud-risk`, `/telemetry-value`) should depend on service modules, not raw fetch.

## 13. Current Known Priorities

1. Keep live Splunk connectivity stable for demo scenarios (tunnel + mode sync)
2. Expand live-query coverage for incidents/fraud so empty datasets are less likely on valid Splunk environments
3. Maintain this document as the source all coding agents read first

## 14. Latest Implemented Behavior (2026-04-20)

- Settings runtime apply action uses theme-aligned container styling for light/dark consistency.
- Enrichment API calls (`/api/v1/incidents/{id}/enrich`) are handled as local context failures and no longer emit noisy global alert spam.
- Action dock quick resolve:
  - shows info state when no high-priority pending approvals are present
  - avoids false failure after successful resolves if background refresh fails
- Reasoning timeline tool details:
  - open by default for visible tool chips
  - user can collapse each panel via `Close`
  - chip interaction is open-first (non-destructive to default-open behavior)
- E2E contract updated to support multi-expanded tool details while preserving non-LLM token-visibility rules.

## 15. Validation Snapshot (2026-04-22)

Repository checkpoint:
- baseline commit reference: `410328e` (plus current local unpushed changes)

Automated checks:
- `make test` -> 143 passed
- `make eval` -> 6/6 passed (100.00%)
- `make api-smoke` -> passed
- `pnpm --filter web test:e2e` -> 11 passed
- `pnpm --filter web lint` -> pass with 2 non-blocking warnings (`no-page-custom-font`, `no-img-element`)

Route smoke checks (local web at `127.0.0.1:3000`):
- `/` -> 200
- `/incidents` -> 200
- `/approvals` -> 200
- `/monitoring` -> 200
- `/telemetry-value` -> 200
- `/fraud-risk` -> 200
- `/agent-portfolio` -> 200
- `/settings` -> 200

API health:
- `GET /health` on `127.0.0.1:8001` -> `{"status":"ok", ...}`

Runtime/live connectivity checks:
- `GET /api/v1/settings/runtime/check` -> model connected + splunk connected
- `GET /api/v1/settings` -> `splunk.connected=true`, `index_count=18`
- `GET /api/v1/incidents` -> empty list (no matching live incidents in current query)
- `GET /api/v1/dashboard/summary` -> `data_source=reported` with explicit live empty-state reason
- `GET /api/v1/waste/telemetry/metrics` -> live metrics populated from Splunk
- `GET /api/v1/fraud/overview?mode=live` -> live mode reached, empty-state reason when no matching fraud signals

## 16. Imported Dashboard Integration (2026-04-20)

User-provided file integrated:
- source file: `/Users/ramakrishna/Downloads/agenticops_dashboard.html`
- packaged data source: `/Users/ramakrishna/Downloads/files.zip`

Implementation in app:
- new route: `/agent-portfolio`
- page file: `apps/web/app/agent-portfolio/page.tsx`
- data loader: `apps/web/lib/services/agentPortfolio.ts`
- imported datasets:
  - `apps/web/lib/mocks/agent_portfolio/customer_health.json`
  - `apps/web/lib/mocks/agent_portfolio/recovery_orchestrator.json`
  - `apps/web/lib/mocks/agent_portfolio/migration_assurance.json`
- navigation integrated in:
  - `apps/web/components/SideNav.tsx`
  - `apps/web/components/TopBar.tsx`

Scope note:
- This integration preserves existing app architecture and theme.
- It is currently a curated packaged-data portfolio view; it does not replace live incident/fraud/telemetry runtime flows.

## 17. Deployment Snapshot (2026-04-22)

Production server:
- web: `http://144.202.48.85:3000`
- api: `http://144.202.48.85:8001`
- runtime mode applied: `CLOUD_LIVE`
- model: `anthropic / claude-haiku-4-5-20251001` (connectivity check = OK)
- splunk adapter mode: `native` (connectivity check = OK, 18 indexes visible)

Current observed live-data behavior on production:
- `/api/v1/incidents` returns `[]` when no matching incident telemetry is found.
- `/api/v1/dashboard/summary` returns live-reported payload with explicit empty-state `degraded_reason`.
- `/api/v1/fraud/overview?mode=live` returns live payload with explicit empty-state reason when no matching fraud patterns are found.
- `/api/v1/waste/telemetry/metrics` and `/api/v1/monitoring/overview` return populated live Splunk-derived metrics.

Server note:
- host port `5432` was already occupied on the Vultr machine; deployment remapped container host ports (`postgres`, `redis`, `mock-mcp`, `otel`) to avoid collision while preserving external app ports (`3000`, `8001`).

## 18. DefenseClaw Lessons Applied to BitsIO (2026-04-23)

Operational lessons from Cisco DefenseClaw/OpenClaw are now treated as first-class hardening requirements in this codebase.

Direct mapping:
- Agents retried endlessly -> add circuit breakers + retry caps
- Overnight token/cost burn -> add cost guards + token limits
- Logging was critical -> add full LLM + Splunk query logging with run IDs
- Prompt security blocked bad inputs -> add prompt safety filters
- Cron jobs kept running after edits -> add runtime kill-switch + safe fallback behavior
- MCP loops increased cost -> route deterministic workloads to native adapter by default

Current status in this repo:
- adapter-routing policy is already implemented (deterministic -> native-first in auto mode)
- telemetry query context now exposes adapter mode + resolved backend + fallback reason
- remaining guardrail hardening is planned as a dedicated runbook:
  - `/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops/docs/runbooks/AGENT_GUARDRAILS_HARDENING_PLAN.md`

Non-negotiable acceptance criteria for guardrail rollout:
1. no workflow can execute unbounded retries
2. every workflow has explicit max tokens and max wall-time
3. kill-switch can stop new executions immediately without deploy
4. every model/tool step is audit-logged with workflow_id and cost metadata
5. deterministic API workloads use native adapter unless explicitly overridden
6. prompt safety checks run before model invocation on risky surfaces

## 19. Common Startup Failures + Prevention (2026-04-24)

Two recurrent local failures were traced to process lifecycle drift (services not running, stale PIDs).

### A. Browser error: `ERR_CONNECTION_REFUSED` on `localhost:3000`

Root cause:
- Web/API processes are not listening on `3000`/`8001` (often after terminal/session changes).

Prevention:
- use orchestrated startup instead of manual ad-hoc runs.
- authoritative sequence:

```bash
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops
make local
make local-status
```

Expected status:
- API up: `127.0.0.1:8001`
- Web up: `127.0.0.1:3000`
- Splunk tunnel up: `localhost:8089`

Recovery if drift occurs:

```bash
make local-stop
make local
make local-status
```

### B. Runtime check error: `Model: Not connected (ConnectError: [Errno 61] Connection refused)`

Root cause:
- local Ollama server is down on `127.0.0.1:11434`.
- Splunk connectivity can still be healthy, so model and Splunk status can diverge.

Prevention:
- `make local` now includes Ollama preflight startup.
- new Makefile targets:
  - `make ollama-start`
  - `make ollama-stop`
  - `make ollama-status`

Verification:

```bash
make ollama-status
curl -H 'x-api-key: dev-analyst' http://127.0.0.1:8001/api/v1/settings/runtime/check
```

Expected runtime check shape:
- `model.connected=true`
- `splunk.connected=true`

Operational policy:
- for local integration demos, startup must always be via `make local`.
- avoid relying on stale `.pid` files as process truth; use port and health checks.

---

If any other document conflicts with this file, this file wins.
