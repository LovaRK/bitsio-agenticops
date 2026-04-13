# HANDOFF_LOG

## 2026-04-08
- Initialized `bitsio-agenticops` monorepo and phase scaffolding.
- Added ADRs, roadmap, execution board, and decision log.
- Implemented mock MCP service, Splunk adapter, and contract fixtures/tests.
- Implemented Telemetry Value Agent core state/nodes/model adapter/policies.
- Implemented decision trace schema, hashing, in-memory trace store, API routes, and approval routes.
- Added OpenTelemetry tag matrix, collector config, and smoke test.
- Added Next.js incident details page + timeline/evidence/approval components and e2e spec.

### Verification Executed
- `uv sync --all-groups`
- `pnpm install`
- `make test` (19 passed)
- `make lint` (ruff/black/isort + web lint passed)
- `pnpm --filter web test:e2e` (2 passed)
- `uv run python infra/scripts/validate_schemas.py`

### Next Actions
1. Connect remote GitHub repository and push baseline branch.
2. Start feature wave for live Splunk MCP validation and remote environment integration.

## 2026-04-10
- Wired RBAC into API routes:
  - decision trace write requires analyst role
  - approvals create requires approver role
  - approvals read requires analyst role
- Added tenant fixed-window rate limiting middleware (`100 req/min`) with Redis-first + in-memory fallback.
- Added eval harness script and fixtures (including adversarial cases) with `make eval`.
- Added release gate workflow to enforce tests + eval pass threshold.
- Added Locust load test implementation and load-test runbook under `tests/load/`.
- Replaced threat-model placeholder with implementation-specific threat analysis and controls.

### Verification Executed
- `make test` (39 passed)
- `make eval` (100% pass rate, threshold >=90%)

## 2026-04-13
- Added dual Splunk adapter support:
  - `native` mode for `/services/search/jobs/export`
  - `mcp` mode for `/services/mcp/*`
  - `auto` mode resolution from base URL
- Wired live adapter factory into API dependencies.
- Added native adapter contract tests.
- Fixed live browser approve/reject issue by enabling CORS middleware in API (OPTIONS preflight now `200`).
- Added live run helper scripts:
  - `scripts/run_live_api.py`
  - `scripts/seed_live_splunk_demo.py`
  - `scripts/verify_live_flow.py`
- Added Make targets:
  - `live-api`, `live-web`, `live-seed`, `live-verify`
- Updated runbooks for:
  - live production run
  - SSH/Vultr tunnel setup
  - showcase flow
  - system design flow
  - live persona scenario matrix
  - AI/dev onboarding

### Verification Executed
- `make lint`
- `uv run pytest -q` (55 passed)
- `pnpm --filter web test:e2e` (8 passed)
- Live adapter checks against `https://localhost:8089`:
  - `get_server_info()` OK
  - `list_indexes()` OK
  - `run_search()` OK
- Live API checks:
  - `GET /api/v1/incidents` returns real incidents from `tutorial`
  - `GET /api/v1/decision-traces/{id}` returns live trace
  - approve + reject endpoints return `200`
