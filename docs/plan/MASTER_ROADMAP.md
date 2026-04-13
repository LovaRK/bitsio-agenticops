# MASTER_ROADMAP

## Active Target
Pro Core+UI + Phase 8 hardening complete, with dual Splunk adapter modes (`native` and `mcp`) and strict phase gates.

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

## Gate Checklist
- [x] bootstrap passes (`uv sync --all-groups` + `pnpm install`)
- [x] lint passes (`make lint`)
- [x] unit + contract tests pass (`make test`)
- [x] schema validation passes (`uv run python infra/scripts/validate_schemas.py`)
- [x] web e2e pass on updated UI contract (`pnpm --filter web test:e2e`)
- [x] eval gate passes (`make eval`)
- [x] API smoke checks pass (`make api-smoke`)
