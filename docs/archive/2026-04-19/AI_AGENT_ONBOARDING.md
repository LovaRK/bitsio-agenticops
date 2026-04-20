# New Dev / AI Agent Onboarding

This document is the fast handoff for any new developer or coding agent.

## Start Here (Reading Order)

1. [MASTER_ROADMAP.md](/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops/docs/plan/MASTER_ROADMAP.md)
2. [EXECUTION_BOARD.md](/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops/docs/plan/EXECUTION_BOARD.md)
3. [DECISION_LOG.md](/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops/docs/plan/DECISION_LOG.md)
4. [LIVE_SPLUNK_MODE.md](/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops/docs/LIVE_SPLUNK_MODE.md)
5. [SYSTEM_DESIGN_FLOW.md](/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops/docs/runbooks/SYSTEM_DESIGN_FLOW.md)

## Architecture Ownership Map

- Web UI: `/apps/web`
- API service: `/apps/api`
- Agent logic: `/packages/agent-core`
- Splunk adapters: `/packages/connectors/splunk-mcp`
- Decision tracing: `/packages/decision-tracing`
- Plans and handoff: `/docs/plan`

## Live Data Rules

- Do not force mock mode in production demonstrations.
- Keep adapter contract stable; switch behavior using `SPLUNK_ADAPTER_MODE`.
- Never commit secrets (`.env` is gitignored).
- `Environment=local` with `Model Provider=anthropic` is valid:
  - environment = where app runs
  - provider = where model inference runs
- Runtime mode can be changed from `/settings` without code edits:
  - scenario presets (local-mock/local-live/cloud-live)
  - runtime profile selector (local vs cloud presets)
  - local/cloud model
  - mcp/native Splunk adapter
  - live Splunk data vs local seeded mock data
  - theme (dark/light) for demo preference
  - connection probe button for model + Splunk readiness

## Build and Verify Commands

```bash
make bootstrap
make lint
make test
pnpm --filter web test:e2e
```

Live run:

```bash
make tunnel-start
make live-api
make live-web
make live-verify
```

## Definition of Done for Any Task

- Code updated
- Tests updated and passing
- Docs updated in `/docs` for behavior changes
- Handoff notes updated in `docs/plan/HANDOFF_LOG.md`

## Current Live Integration State

- Native Splunk adapter is implemented and active in live mode.
- MCP mode remains supported when custom MCP app is available.
- Approval flow works in browser with CORS enabled.
