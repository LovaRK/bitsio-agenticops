# Threat Model (Phase 8)

## System Overview
BitsIO AgenticOps processes incident context and Splunk evidence through a FastAPI service, agent graph runtime, and decision-trace persistence layer. Human approval is required for guarded actions.

Key trust boundaries:
- External caller -> API boundary
- API -> Splunk MCP connector
- API -> persistence (decision traces + approvals)
- Agent reasoning/prompt output -> analyst UI

## Protected Assets
- Splunk credentials/tokens (`SPLUNK_MCP_TOKEN`)
- LLM credentials (`ANTHROPIC_API_KEY`)
- Decision traces and approval events (audit integrity)
- Tenant-scoped incident data and evidence references
- Policy rules and approval requirements

## Threats and Controls
| Threat | Risk | Control | Status |
|---|---|---|---|
| Authentication bypass | Unauthorized workflow writes/approvals | Auth context resolution with role checks | Implemented |
| Authorization drift | Non-approver can approve | `approver` role required on approval endpoint | Implemented |
| Cross-tenant traffic abuse | Noisy tenant impacts others | Tenant fixed-window rate limit (`100 req/min`) | Implemented |
| Secret leakage in logs | Credential exposure | Redaction of token/password/query fields in connector logs | Implemented |
| Prompt injection from untrusted data | Unsafe recommendations | Guardrail notes + approval gate before action | Implemented |
| Evidence tampering ambiguity | Audit uncertainty | Node hash fields + decision trace persistence contract | Implemented |
| Live dependency outage (Redis) | Rate limit blind spot | Redis-first limiter with in-memory fallback | Implemented |
| Live dependency outage (Splunk/LLM) | Workflow degradation | Mock-first testing and controlled failure handling | Implemented |
| Release of low-quality reasoning | Customer impact | Eval harness + release gate at >=90% pass | Implemented |
| Sensitive data over-collection in spans | Privacy/compliance risk | OTel tagging standards, no secrets/PII in attributes | Implemented |

## Residual Risks
- JWT verification currently uses non-JWKS validation mode and must be hardened before production exposure.
- Decision-trace runtime currently uses in-memory store in API path; production mode must enforce durable DB path.
- Local dev API keys are intentionally permissive; must not be used in production environments.

## Security Requirements for Production Promotion
1. Enforce OIDC with verified token signatures and issuer/audience checks.
2. Rotate all credentials shared during development chat or logs.
3. Replace any dev API keys with managed identity and secrets manager injection.
4. Enable durable persistence backend for decision traces and approvals.
5. Keep release gate required on `main` with eval pass rate >= 90%.

## Verification Checklist
- `make test`
- `make eval`
- `make load-test` (capture p95 and error-rate report)
- Negative auth tests for role mismatches on protected endpoints
- Connector log review verifies redaction behavior
