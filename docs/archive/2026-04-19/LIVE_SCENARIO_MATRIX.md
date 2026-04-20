# Live Scenario Matrix (Real Data + Personas)

Use this matrix while validating with production Splunk data.

## Persona 1: SOC Analyst

- Goal: identify what happened and why.
- Steps:
  1. Open `/incidents`
  2. Pick high severity incident
  3. Review timeline + final assessment
- Expected:
  - Incident row exists
  - Timeline renders
  - Probable cause present

## Persona 2: On-call SRE

- Goal: act quickly with confidence.
- Steps:
  1. Open incident detail
  2. Check confidence + evidence refs
  3. Validate impacted host summary
- Expected:
  - Confidence panel visible
  - Evidence references present
  - Host correlation in probable cause

## Persona 3: Approver / Manager

- Goal: enforce controlled automation.
- Steps:
  1. Enter comment in Decision Gate
  2. Click Approve
  3. Reload and click Reject
- Expected:
  - Approve message visible
  - Reject message visible
  - Approval list endpoint includes decisions

## Persona 4: Platform Admin

- Goal: verify integration health and controls.
- Steps:
  1. Run `make live-verify`
  2. Check API health + incident count
  3. Check RBAC behavior
- Expected:
  - Live verify passes
  - No mock fallback warnings in UI
  - Unauthorized actions blocked by role

## Negative Scenarios

- Invalid Splunk token:
  - Expected `401` from Splunk and API `502` with clear error
- Tunnel down:
  - Expected timeout/connection error and no live incidents
- Missing tutorial data:
  - Use `make live-seed`, then incidents appear

## Completion Criteria

- All 4 persona flows pass.
- Approve/reject both confirmed.
- At least one real incident from `tutorial` displayed.
