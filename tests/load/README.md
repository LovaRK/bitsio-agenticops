# Load Test Plan (Locust)

This load suite validates the API under analyst traffic using local Docker services.

## Target
- Concurrency: `50` analysts
- Traffic profile: incidents read + decision trace writes + approval flow
- Target SLO: p95 response time `< 3s` for MVP baseline

## Run
```bash
make load-test
```

Override defaults:
```bash
HOST=http://localhost:8001 USERS=50 SPAWN_RATE=10 DURATION=2m make load-test
```

## Endpoints Exercised
- `GET /health`
- `GET /api/v1/incidents`
- `POST /api/v1/decision-traces`
- `POST /api/v1/decision-traces/{workflow_id}/approvals`
- `GET /api/v1/decision-traces/{workflow_id}/approvals`

## Authentication Used in Load Runs
- Analyst traffic: `x-api-key=dev-analyst`
- Approver actions: `x-api-key=dev-approver`
- Tenant isolation header: `x-tenant-id=tenant_demo`

