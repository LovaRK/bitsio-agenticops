# System Design Flow (AgenticOps)

## End-to-End Runtime Flow

```mermaid
flowchart LR
  U["User (Browser)"] --> W["Next.js Web (127.0.0.1:3000)"]
  W --> A["FastAPI API (127.0.0.1:8001)"]
  A --> S["Splunk Incident Service"]
  S --> AD["Splunk Adapter (native|mcp)"]
  AD --> T["SSH Tunnel localhost:8089"]
  T --> SP["Splunk Server 144.202.48.85"]
  A --> D["Decision Trace Store"]
  A --> P["Approval Endpoints"]
  P --> D
  A --> O["OTel Spans + Logs"]
```

## What Goes In / What Comes Out

### Inputs

- Splunk events from `index=tutorial`
- Analyst interaction:
  - open incident
  - approve/reject decision

### Processing

- Incident list query (aggregated by incident identifier)
- Incident detail query (event sample + inferred probable cause)
- Policy/approval gate checks

### Outputs

- Incident summaries (`/api/v1/incidents`)
- Decision trace detail (`/api/v1/decision-traces/{id}`)
- Approval event ledger (`POST/GET approvals`)
- UI panels: timeline, assessment, confidence, gate

## Data Contracts (Stable Interfaces)

- Adapter methods:
  - `list_indexes()`
  - `run_search(query, earliest, latest)`
  - `get_server_info()`
  - `explain_error(...)`
- API methods:
  - `GET /api/v1/incidents`
  - `GET /api/v1/decision-traces/{workflow_id}`
  - `POST /api/v1/decision-traces/{workflow_id}/approvals`
  - `GET /api/v1/decision-traces/{workflow_id}/approvals`

## Deployment Modes

- `Mock mode`: fixture-backed UI and tests.
- `Live native mode`: Splunk REST `/services/search/jobs/export`.
- `Live MCP mode`: custom `/services/mcp/*` routes if app installed.

## Why This Design

- Adapter boundary isolates Splunk protocol differences.
- UI contract remains unchanged across backends.
- Human-in-the-loop decision gate is enforceable and auditable.
