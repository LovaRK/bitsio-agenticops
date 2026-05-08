# Mock Contract (Canonical v1)

This document is the source of truth for local mock behavior consumed by the UI and smoke tests.

## API Contract (Local)
- `GET /api/v1/incidents`
  - Response shape: `{ "items": IncidentSummary[] }`
- `POST /api/v1/decision-traces`
  - Requires `x-api-key=dev-analyst`
  - Accepts decision trace payload
  - Returns `{ "workflow_id": string, "id": string }`
- `POST /api/v1/decision-traces/{workflow_id}/approvals`
  - Requires `x-api-key=dev-approver`
  - Returns approval event object
- `GET /api/v1/decision-traces/{workflow_id}/approvals`
  - Requires `x-api-key=dev-analyst`
  - Response shape: `{ "items": ApprovalEvent[] }`

## UI Mock Fixture Contract
- Pending approval incident fixture:
  - `apps/web/lib/mocks/incident_detail_pending.json`
  - `approval_required=true`
- Completed incident fixture:
  - `apps/web/lib/mocks/incident_detail_completed.json`
  - `approval_required=false`

The UI selects fixture by incident id/workflow id in `apps/web/lib/api.ts`.

## Stable E2E Selectors
- Dashboard page: `data-testid="dashboard-page"`
- Incident stream table: `data-testid="incident-stream"`
- Incident page root: `data-testid="incident-detail-page"`
- Confidence panel: `data-testid="confidence-panel"`
- Decision gate panel: `data-testid="decision-gate"`

## Deterministic Verification Flow
- Full local flow command:
  - `make verify-local`
- Includes:
  - `docker compose up -d --build`
  - API smoke checks
  - web e2e
  - unit/contract tests
  - eval gate
- `make api-smoke` runs in auto mode:
  - uses network checks when `http://localhost:8001` is available
  - falls back to in-process `TestClient` checks when the API endpoint is unavailable
