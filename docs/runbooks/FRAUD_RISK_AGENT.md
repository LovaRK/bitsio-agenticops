# Fraud Risk Analysis — Runbook

Last updated: 2026-04-18

## What This Feature Does

`/fraud-risk` analyzes payment + identity + approval telemetry and creates:

- Risk-scored fraud cases
- Approval-required recommendations (propose-only)
- Policy/compliance metadata (PCI-DSS, SOX)
- Data quality and agent telemetry context

The feature follows the same app pattern as Dashboard/Incidents/Approvals/Telemetry Value.

## API Endpoints

- `GET /api/v1/fraud/overview?mode=auto|seed|live`
- `GET /api/v1/fraud/demo`
- `POST /api/v1/fraud/analyze/live`

## Runtime Modes

- `mode=seed`: deterministic local cases for safe demos
- `mode=live`: query Splunk and derive risk cases dynamically
- `mode=auto`: live when enabled, otherwise seed fallback

## Live Data Requirements

Set in `.env`:

- `SPLUNK_LIVE_MODE=true`
- `SPLUNK_MCP_BASE_URL=...`
- `SPLUNK_MCP_TOKEN=...`
- `SPLUNK_ADAPTER_MODE=native` or `mcp`

## Demo Script (5 minutes)

1. Open `/fraud-risk`.
2. Explain KPI row: open cases, avg risk, exposure, data quality.
3. Walk one high-risk case from table.
4. Show policy evaluation and why approval is required.
5. Show compliance badges (classification/frameworks/encryption).
6. Open `/approvals` to demonstrate the human-in-loop gate.

## Guardrails

- Agent is propose-only (no autonomous remediation).
- Human approval is required for high-risk actions.
- All output remains traceable and suitable for audit workflows.
