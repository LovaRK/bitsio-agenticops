# BitsIO AgenticOps — Documentation Index

Last updated: 2026-04-13

## Start Here

1. [README](../README.md) — Quickstart, make commands, live Splunk mode
2. [Developer Onboarding](ONBOARDING.md) — Setup, project layout, common tasks
3. [Architecture](ARCHITECTURE.md) — System design, agent graph, data flow, packages
4. [API Reference](API_REFERENCE.md) — All endpoints, auth, error codes, examples

## Current Project State

Phases 0–8 complete. Latest additions (2026-04-13):

- `packages/shared` fully implemented: config (Pydantic Settings), auth (RBAC + OIDC + JWKS), shared DTOs
- `packages/prompts`: all 7 node prompt templates added (was 2/7)
- `packages/decision-tracing`: `PostgresDecisionTraceStore` added — async asyncpg drop-in for production
- `packages/agent-core`: all 7 LangGraph nodes now emit OTel spans with full 8-tag matrix
- `apps/web/lib/api.ts`: real API client replacing hardcoded mock; dev fallback preserved
- `apps/workers/worker.py`: full Redis job queue worker (`run_agent`, `rerun_trace` handlers)
- `tests/unit/test_telemetry_nodes_negative.py`: 15 negative test cases added
- Dual Splunk adapters: `SplunkMCPAdapter` (mock/MCP) + `NativeSplunkAdapter` (REST) with `auto` routing
- Runtime switching available from `/settings` UI: scenario preset, model provider, adapter mode

## Verified Quality Snapshot

- Python tests: 58 passed (happy path) + 15 negative cases
- Web e2e tests: 9 passed
- Web lint: pass
- API smoke: pass (RBAC, approvals, rate-limit, tenant isolation)

## Important Clarification

`Environment=local` and `Model Provider=anthropic` are independent settings.

- `Environment` = where the app is running (your machine, staging, prod)
- `Model Provider` = which LLM backend (`ollama` / `anthropic` / `stub`)
- Local app + cloud model is valid and expected for cloud-runtime testing

## Core Documentation

| Document | Audience | Contents |
|----------|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Engineers | Agent graph, packages, data flow, OTel, auth, ADR summary |
| [API_REFERENCE.md](API_REFERENCE.md) | API consumers | All endpoints, auth, schemas, error codes, rate limiting |
| [ONBOARDING.md](ONBOARDING.md) | New developers | Setup, project layout, common tasks, commit format |

## Planning Docs

- [Master Roadmap](plan/MASTER_ROADMAP.md)
- [Execution Board](plan/EXECUTION_BOARD.md)
- [Handoff Log](plan/HANDOFF_LOG.md)
- [Decision Log](plan/DECISION_LOG.md)
- [Phase 8 Status](plan/PHASE_8_STATUS.md)
- [Phase 8 Hardening Plan](plan/PHASE_8_HARDENING_PLAN.md)
- [V2 Galileo Roadmap](plan/V2_GALILEO_ROADMAP.md)

## Architecture Decision Records

- [ADR-001](adr/ADR-001-orchestration-runtime.md) — LangGraph as orchestration runtime
- [ADR-002](adr/ADR-002-connector-protocol.md) — MCP adapter protocol
- [ADR-003](adr/ADR-003-decision-trace-schema.md) — Decision trace schema + immutability
- [ADR-004](adr/ADR-004-persistence.md) — PostgreSQL + pgvector for persistence
- [ADR-005](adr/ADR-005-auth-approach.md) — OIDC JWT + dev API keys
- [ADR-006](adr/ADR-006-deployment-target.md) — Deployment target
- [ADR-007](adr/ADR-007-splunk-adapter-boundary.md) — Splunk adapter boundary
- [ADR-008](adr/ADR-008-live-splunk-mcp-integration.md) — Live Splunk MCP integration

## Operator & Runbook Guides

- [Operator Handbook](OPERATOR_HANDBOOK.md) — 3-terminal startup, mode matrix, 5-min demo script, troubleshooting
- [Live Splunk Mode](LIVE_SPLUNK_MODE_UPDATED.md) — Full live-data walkthrough
- [SSH Tunnel Setup](SSH_TUNNEL_SETUP.md) — Tunnel to remote Splunk instance
- [Load Testing Guide](LOAD_TESTING_GUIDE.md) — Locust scenarios, performance gates
- [Showcase Flow](runbooks/SHOWCASE_FLOW.md)
- [Live Scenario Matrix](runbooks/LIVE_SCENARIO_MATRIX.md)
- [System Design Flow](runbooks/SYSTEM_DESIGN_FLOW.md)
- [Telemetry Value Local Demo](runbooks/TELEMETRY_VALUE_LOCAL_DEMO.md)
- [Splunk Real Data Seeding](runbooks/SPLUNK_REAL_DATA_SEED.md)

## Security & Hardening

- [RBAC Audit Report](RBAC_AUDIT.md) — Route-by-route RBAC coverage, threat alignment
- [Security](security/) — Threat model and hardening notes
