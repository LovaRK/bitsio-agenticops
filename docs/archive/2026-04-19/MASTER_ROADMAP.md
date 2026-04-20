# MASTER_ROADMAP

## Active Target
Pro Core+UI + Phase 8 hardening complete, with dual Splunk adapter modes (`native` and `mcp`) and strict phase gates.

## Current Snapshot
- Latest implementation snapshot: `docs/plan/CODEBASE_IMPLEMENTATION_SNAPSHOT_2026-04-16.md`
- Telemetry metrics API contract in use: `GET /api/v1/waste/telemetry/metrics`
- Runtime connectivity check: `GET /api/v1/settings/runtime/check`
- ICA enrichment contract: `POST /api/v1/incidents/{incident_id}/enrich`

## Phase Status
- Phase 0: Done (ADRs + MVP contract)
- Phase 1: Done (repo scaffold + local stack + CI + seeding)
- Phase 2: Done (splunk-mcp adapter + contract tests)
- Phase 3: Done (Telemetry Value Agent nodes + model adapter + prompts)
- Phase 4: Done (decision trace schema + hashing + API)
- Phase 5: Done (OTel tag matrix + helpers + smoke test)
- Phase 6: Done (approval endpoints + policy evaluator)
- Phase 7: Done (incident detail UI + timeline/evidence/approval + e2e)
- Phase 8: Done (RBAC wiring + tenant rate limiting + eval harness/release gate + load tests + threat model)
- Live Integration: Done (native Splunk REST mode via SSH tunnel + browser approve/reject flow)
- Incident Context Agent (ICA): Done (state/services/nodes/graph/API/UI/e2e)

## Current Caveat (Known)
- `/api/v1/waste/telemetry/metrics` currently serves curated telemetry value payload (stable demo/data-contract shape).
- Live tenant-specific telemetry value rollup is available via `/api/v1/waste/analyze/live` and should be unified into metrics endpoint in next hardening pass.

## Gate Checklist
- [x] bootstrap passes (`uv sync --all-groups` + `pnpm install`)
- [x] lint passes (`make lint`)
- [x] unit + contract tests pass (`make test`)
- [x] schema validation passes (`uv run python infra/scripts/validate_schemas.py`)
- [x] web e2e pass on updated UI contract (`pnpm --filter web test:e2e`)
- [x] eval gate passes (`make eval`)
- [x] API smoke checks pass (`make api-smoke`)
- [x] re-verified 2026-04-16: tests green (`131 passed`) + web e2e (`11 passed`) + web lint pass (warnings only)
