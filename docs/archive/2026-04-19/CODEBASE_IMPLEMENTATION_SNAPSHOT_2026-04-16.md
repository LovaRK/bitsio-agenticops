# CODEBASE_IMPLEMENTATION_SNAPSHOT_2026-04-16

## Purpose
This document is the current implementation snapshot for `bitsio-agenticops` as of **2026-04-16**.
It reflects what is actually in code today and what remains intentionally provisional.

## High-Level Status
- Core platform phases (0-8) are implemented and runnable locally.
- API and web are integrated end-to-end for incident flow, approvals, monitoring, and telemetry views.
- Splunk integration supports both `native` and `mcp` adapter modes.
- Runtime switching is supported from Settings UI and via `/api/v1/settings/runtime`.

## Backend Surface (FastAPI)
Base: `/api/v1`

### Implemented routes
- `GET /incidents`
- `GET /dashboard/summary`
- `GET /monitoring/overview`
- `GET /settings`
- `PUT /settings/runtime`
- `GET /settings/runtime/check`
- `GET /approvals/pending`
- `POST /decision-traces`
- `GET /decision-traces/{workflow_id}`
- `POST /decision-traces/{workflow_id}/approvals`
- `GET /decision-traces/{workflow_id}/approvals`
- `GET /support/resources`
- `POST /waste/analyze`
- `POST /waste/analyze/live`
- `GET /waste/telemetry/metrics`
- `GET /waste/demo`

## Runtime and Data Modes
### Splunk adapter resolution
- `SPLUNK_ADAPTER_MODE=native|mcp|auto`
- `auto` resolves based on `SPLUNK_MCP_BASE_URL`:
  - contains `/services/mcp` -> `mcp`
  - otherwise -> `native`

### Model providers
- `ollama` (local)
- `anthropic` (cloud)
- `stub` (deterministic mock)

### Live vs mock behavior
- `SPLUNK_LIVE_MODE=true`: enables live Splunk retrieval paths.
- `NEXT_PUBLIC_USE_MOCK` + `NEXT_PUBLIC_REQUIRE_LIVE_API` control frontend fallback behavior.
- Runtime connectivity probe endpoint: `GET /api/v1/settings/runtime/check`.

## Auth and RBAC (current behavior)
- Dev mode uses `x-api-key` tokens (`dev-viewer`, `dev-analyst`, `dev-approver`, `dev-secret`).
- If OIDC is not configured and no key is sent, user defaults to `viewer`.
- Most product routes require analyst role (`require_analyst`).
- Approval write routes require approver role (`require_approver`).

## Frontend Surface (Next.js)
### Main routes
- `/` dashboard
- `/incidents`
- `/incidents/[id]`
- `/approvals`
- `/monitoring`
- `/settings`
- `/support`
- `/telemetry-value` (re-export of waste page)
- `/waste`

### Telemetry route contract
- Frontend telemetry metrics fetches:
  - `GET /api/v1/waste/telemetry/metrics`
- Deprecated route reference for old docs only:
  - `/api/v1/telemetry/metrics`

## What is Dynamic vs Provisional
### Dynamic (live-capable)
- Incident list and detail can run from live Splunk when live mode and connectivity are enabled.
- Waste live analysis (`POST /waste/analyze/live`) executes graph against connected Splunk.
- Monitoring overview derives runtime/service/index telemetry at request time.

### Provisional/seeded today
- `GET /waste/telemetry/metrics` currently returns curated telemetry value payload
  (dashboard-grade structured data), not yet computed directly from live tenant-specific waste graph output.

## Verification Run (2026-04-16)
- `make test`: **78 passed**
- `pnpm --filter web lint`: pass with 2 existing warnings (`no-page-custom-font`, `no-img-element`)

## Known Gaps / Next Hardening Actions
1. Wire `/waste/telemetry/metrics` to tenant/runtime-aware live computation path (or cache from latest live waste run).
2. Persist runtime profile changes beyond process lifecycle using durable config store.
3. Consolidate top-level legacy docs into canonical set under `docs/plan` + runbooks.
4. Add CI check for stale route references in docs to prevent contract drift.

## Canonical Docs to Read First
- `README.md`
- `docs/plan/MASTER_ROADMAP.md`
- `docs/plan/EXECUTION_BOARD.md`
- `docs/plan/HANDOFF_LOG.md`
