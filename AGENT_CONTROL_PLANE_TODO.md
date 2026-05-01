# Agentic Control Plane TODO

## In Progress
- [ ] None

## Pending
- [ ] None

## Completed
- [x] Create implementation branch `feature/agentic-control-plane-production-v1`
- [x] Install TanStack dependencies (`react-query`, `react-table`, `react-virtual`)
- [x] Foundation scaffolding (types, helpers, hooks, provider, route shell)
- [x] Add `/app/agent-control-plane/page.tsx` canonical route
- [x] Redirect `/app/telemetry-value/page.tsx` to `/agent-control-plane`
- [x] Build `/components/agent/*` component set
- [x] Implement deterministic telemetry/agent derivation helpers
- [x] Implement guardrail/approval/replay/memory/drift local-state flows (v1 local-state baseline)
- [x] Wire global `ExplainabilityDrawer` triggers from required high-traffic surfaces
- [x] Implement virtualized optimization table and debounced filtering scaffolding
- [x] Implement loading/error/fallback/empty states baseline
- [x] Validate TypeScript strict and lint (lint with only 2 pre-existing warnings)
- [x] Harden human-in-the-loop reason-required UX (reject/override/modify with required reason dialog + audit capture)
- [x] Enforce workspace-switch state reset across local control-plane filters/selection contexts
- [x] Add modal accessibility baseline (Escape close, initial focus, tab loop) for reason dialog
- [x] Add lightweight tests for pure derivation helpers and guardrail decisions (vitest, 9 passing tests)
- [x] Add browser-flow validation pass (Playwright smoke for redirect, drawer, approve/reject/override reason flows)
- [x] Keep telemetry mode live-only (no frontend fallback data path)
- [x] Improve global explainability drawer accessibility (dialog semantics, Escape close, focus control)
- [x] Add targeted keyboard-interaction e2e checks for drawer and reason dialog interactions
- [x] Make control-plane e2e deterministic with API route interception in test layer (live-only app runtime preserved)
- [x] Add CI profile/script for serialized control-plane e2e run (`test:e2e:control-plane:ci`)
- [x] Capture and persist e2e screenshots/video/trace artifacts for control-plane flows
