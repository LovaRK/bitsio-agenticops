# BitsIO AgenticOps — API Reference

**Base URL (local):** `http://localhost:8001`  
**Version:** v1  
**Last updated:** 2026-04-18

---

## Authentication

All requests are authenticated via one of two mechanisms:

**Dev mode (local)** — pass a static API key:
```
x-api-key: dev-viewer    → Role: viewer
x-api-key: dev-analyst   → Role: analyst
x-api-key: dev-approver  → Role: approver
x-api-key: dev-secret    → Role: admin
```

**Production** — pass a signed JWT:
```
Authorization: Bearer <oidc_token>
```
The JWT must contain a `role` claim (`viewer|analyst|approver|admin`) and be signed by the configured `OIDC_ISSUER`.

**Anonymous fallback:** When `OIDC_ISSUER` is not set and no key is provided, requests are treated as `viewer` role.

---

## RBAC Roles

| Role | Permissions |
|------|-------------|
| `viewer` | Read incidents, traces |
| `analyst` | `viewer` + create/update traces |
| `approver` | `analyst` + submit approval decisions |
| `admin` | All permissions |

---

## Endpoints

---

### Health

#### `GET /health`

Returns API status and current UTC timestamp.

**Response 200:**
```json
{
  "status": "ok",
  "time": "2026-04-13T10:00:00.000000+00:00"
}
```

---

### Incidents

#### `GET /api/v1/incidents`

List all incidents. Returns seeded/live incidents from the connected store.

**Required role:** `viewer`

**Response 200:**
```json
[
  {
    "id": "inc_20260413_001",
    "title": "High error rate on payments-api",
    "severity": "P2",
    "status": "open",
    "created_at": "2026-04-13T08:30:00Z"
  }
]
```

---

### Decision Traces

#### `POST /api/v1/decision-traces`

Create or merge a decision trace. Accepts a `DecisionTrace` payload. If a trace with the same `workflow_id` already exists, the request is treated as a merge (appends `node_runs`, updates assessment/confidence).

**Required role:** `analyst`

**Request body:**
```json
{
  "workflow_id": "wf_20260413_001",
  "incident_id": "inc_20260413_001",
  "graph_name": "telemetry_value_agent",
  "graph_version": "v1.0.0",
  "started_at": "2026-04-13T08:30:00Z",
  "completed_at": "2026-04-13T08:30:15Z",
  "actor_type": "agent",
  "model_provider": "anthropic",
  "model_name": "claude-3-5-sonnet-20241022",
  "prompt_version": "v1",
  "node_runs": [
    {
      "node_name": "incident_ingest",
      "started_at": "2026-04-13T08:30:01Z",
      "status": "success",
      "input_hash": "abc123...",
      "output_hash": "def456...",
      "tool_calls": [],
      "policy_checks": []
    }
  ],
  "final_assessment": "High error rate correlated with payments-api-1. Probable cause: DB connection pool exhaustion.",
  "confidence": 0.82,
  "approval_required": false
}
```

**Response 201 (created):**
```json
{
  "workflow_id": "wf_20260413_001",
  "created": true
}
```

**Response 200 (merged):**
```json
{
  "workflow_id": "wf_20260413_001",
  "created": false
}
```

**Response 422:** Validation error — schema mismatch.

---

#### `GET /api/v1/decision-traces/{workflow_id}`

Fetch a single decision trace by workflow ID.

**Required role:** `viewer`

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `workflow_id` | string | The workflow identifier, e.g. `wf_20260413_001` |

**Response 200:** Full `DecisionTrace` object (see schema above).

**Response 404:**
```json
{ "detail": "Trace not found: wf_20260413_001" }
```

---

### Approvals

#### `POST /api/v1/decision-traces/{workflow_id}/approvals`

Submit a human approval or rejection for a decision trace. Creates an immutable `ApprovalEvent` record.

**Required role:** `approver`

**Headers:**
```
x-user-id: alice@example.com   (optional, used as approver ID if no auth claim)
```

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `workflow_id` | string | The workflow to approve/reject |

**Request body:**
```json
{
  "approver": "alice@example.com",
  "decision": "approved",
  "reason": "Evidence is clear, confident in the root cause analysis."
}
```

| Field | Type | Values |
|-------|------|--------|
| `approver` | string | User ID or email of the approver |
| `decision` | string | `approved` or `rejected` |
| `reason` | string | Required justification text |

**Response 201:**
```json
{
  "workflow_id": "wf_20260413_001",
  "approver": "alice@example.com",
  "decision": "approved",
  "reason": "Evidence is clear...",
  "created_at": "2026-04-13T10:05:30Z"
}
```

**Response 403:** Caller does not have `approver` role.

**Response 404:** Workflow trace not found.

---

#### `GET /api/v1/decision-traces/{workflow_id}/approvals`

List all approval events for a workflow, ordered by `created_at`.

**Required role:** `viewer`

**Response 200:**
```json
[
  {
    "workflow_id": "wf_20260413_001",
    "approver": "alice@example.com",
    "decision": "approved",
    "reason": "Evidence is clear...",
    "created_at": "2026-04-13T10:05:30Z"
  }
]
```

---

### Dashboard

#### `GET /api/v1/dashboard`

Returns aggregated stats for the dashboard view: total incidents, approval rates, confidence distribution.

**Required role:** `viewer`

---

### Settings (Runtime Control)

#### `GET /api/v1/settings`

Returns current runtime configuration (model provider, adapter mode, mock flags).

**Required role:** `admin`

#### `PATCH /api/v1/settings`

Update runtime configuration without restart. Changes apply immediately to the running process.

**Required role:** `admin`

**Request body (partial update):**
```json
{
  "model_provider": "ollama",
  "model_name": "qwen2.5:14b",
  "splunk_adapter_mode": "native",
  "splunk_live_mode": true,
  "model_mock_mode": false
}
```

---

### Monitoring

#### `GET /api/v1/monitoring/health`

Detailed health check — reports status of PostgreSQL, Redis, Splunk adapter, and OTel collector connectivity.

---

### Fraud Risk Analysis

#### `GET /api/v1/fraud/overview?mode=auto|seed|live`

Returns fraud-risk overview for the current runtime profile.

- `mode=auto` → live when `SPLUNK_LIVE_MODE=true`, otherwise seeded fallback
- `mode=seed` → deterministic local demo data
- `mode=live` → force live Splunk query path

**Required role:** `analyst`

#### `GET /api/v1/fraud/demo`

Deterministic fraud demo payload for UI and local validation.

**Required role:** `analyst`

#### `POST /api/v1/fraud/analyze/live`

Forces live fraud analysis (returns `400` if `SPLUNK_LIVE_MODE=false`).

**Required role:** `analyst`

---

## Error Responses

All errors follow this envelope:

```json
{
  "detail": "Human-readable error message"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request — malformed body |
| 401 | Unauthenticated — missing or invalid credentials |
| 403 | Forbidden — insufficient role |
| 404 | Resource not found |
| 422 | Validation error — schema mismatch (Pydantic) |
| 429 | Rate limit exceeded (default: 100 req/min per tenant) |
| 500 | Internal server error |

---

## Rate Limiting

Default: **100 requests per minute per tenant** (`RATE_LIMIT_PER_MINUTE=100`).

Rate limits are tracked in Redis by `tenant.safe_id`. On breach, the API returns:
```
HTTP 429 Too Many Requests
Retry-After: <seconds>
```

---

## Pagination

Endpoints returning lists support:

| Query param | Default | Description |
|-------------|---------|-------------|
| `page` | 1 | Page number (1-indexed) |
| `page_size` | 20 | Items per page (max 100) |

Response includes `total`, `page`, `page_size` fields.

---

## Web Client Usage

The web app's API client (`apps/web/lib/api.ts`) uses these helpers:

```typescript
// List all incidents
const incidents = await listIncidents();

// Get a single decision trace (falls back to mock in dev if API is down)
const trace = await getIncidentDetail(workflowId);

// Submit an approval
await submitApproval(workflowId, {
  approver: "alice@example.com",
  decision: "approved",
  reason: "Analysis looks correct."
});

// List approval history
const approvals = await listApprovals(workflowId);
```

Set `NEXT_PUBLIC_USE_MOCK=true` to force mock data (useful for Storybook/E2E without a running API).
