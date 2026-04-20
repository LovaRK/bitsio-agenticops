# BitsIO Showcase Flow (Live Data)

Use this script to demo the product to stakeholders with real Splunk-backed behavior.

## Audience Personas

- `SOC Analyst`: needs incident context quickly.
- `SRE/On-call Engineer`: needs probable cause + action guidance.
- `Approver/Manager`: needs auditable human-in-the-loop controls.
- `Platform Admin`: needs confidence in integration and control gates.

## Demo Story (10-15 min)

### 1. Setup Proof (2 min)

Show:
- Tunnel active (`make tunnel-status`)
- Live API running (`make live-api`)
- Web running (`make live-web`)

Explain:
- No mock fallback is allowed in this run.
- Data is fetched from production Splunk through the native adapter.

### 2. Incident Intake (2 min)

Open `http://127.0.0.1:3000/incidents`.

Say:
- "This list is built from `index=tutorial` in Splunk."
- "Severity and status are extracted and normalized by API service."

### 3. Investigation Trace (3 min)

Open first incident `Details`.

Point out:
- `Reasoning Timeline`
- `Final Assessment`
- `Probable cause`
- `Confidence` panel
- Evidence references to Splunk search

### 4. Human Approval Gate (3 min)

In `Decision Gate`:
- Enter comment
- Click `Approve`
- Reload and click `Reject`

Explain:
- Every decision is recorded through approval endpoints.
- This demonstrates controlled automation rather than blind execution.

### 5. Navigation + Operations (2 min)

Quickly navigate:
- Dashboard
- Incidents
- Approvals
- Monitoring
- Settings
- Support

Optional:
- Use floating dock `Quick Resolve` and `Recent Activity` interactions.

## Talking Points

- Typed contracts across connector/API/UI reduce integration drift.
- Live adapter supports both custom MCP and native Splunk REST.
- Decision traces + approvals provide auditability.
- Policy/rate-limit/RBAC gates are active in API.

## Evidence to Show After Demo

- `make live-verify` output
- `pytest` and `e2e` pass results
- `docs/security/threat-model.md` controls status
