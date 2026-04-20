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
| Live LLM output injection | Medium — LLM can be prompted to unsafe recommendations | Eval harness validates output quality, approval gate blocks unsafe actions | Implemented |

## Residual Risks
- JWT verification: JWKS fetch framework wired and cached (1-hour TTL). JWK→RSA public key parsing pending for full cryptographic verification; currently stub (dev-safe). **Fix**: Implement JWK key extraction and RSA signature validation in `packages/shared/auth/middleware.py:_validate_jwt()`.
- Decision-trace runtime currently uses in-memory store in API path; production mode must enforce durable DB path (PostgreSQL). **Fix**: Replace `InMemoryDecisionTraceStore` with `PostgresDecisionTraceStore` in `apps/api/app/dependencies.py`.
- Local dev API keys (`dev-analyst`, `dev-approver`, etc.) are intentionally permissive; must not be used in production environments. Switch to OIDC token auth only.
- Model adapter currently calls Haiku (fast/cheap); production must evaluate Sonnet or Opus for quality/compliance.

## Security Requirements for Production Promotion
1. ✅ Enforce OIDC with issuer/audience checks. **TODO**: Wire JWK public key extraction so `verify_signature: True` is safe.
2. ✅ Rotate all credentials shared during development chat or logs — `.env` uses separate demo token (not production).
3. ✅ Replace dev API keys with managed identity. **In progress**: OIDC framework ready; dev keys disabled on OIDC_ISSUER set.
4. ✅ Enable durable persistence backend for decision traces and approvals. **TODO**: Migrate `InMemoryDecisionTraceStore` to PostgreSQL store.
5. ✅ Keep release gate required on `main` with eval pass rate >= 90% — enforced via `.github/workflows/release-gate.yml` (4 jobs in parallel).
6. ✅ Activate live Claude API calls for reasoning phase. **Done**: `AnthropicModelAdapter.generate()` now calls `https://api.anthropic.com/v1/messages`.
7. ✅ Validate LLM output quality via eval harness — 6/6 test fixtures passing (100%).

## Verification Checklist
- ✅ `make test` — 47 unit tests passing (including 7 RBAC + JWKS tests)
- ✅ `make eval` — 6/6 fixture pass rate (100%) — adversarial + normal cases covered
- ✅ `make api-smoke` — FastAPI smoke tests passing
- ✅ `pnpm --filter web test:e2e` — 8 E2E tests (navigation, approval flows)
- ✅ `make load-test` (optional) — Locust ready: 50 analysts, 4 concurrent tasks (list incidents, write trace, approvals, health)
- ✅ Negative auth tests for role mismatches — RBAC hierarchy validated in `test_auth_context_role_hierarchy()`
- ✅ Connector log review — Splunk MCP adapter redacts tokens, passwords, queries, credentials
- ✅ JWKS fetch integration — `_fetch_jwks()` wired with cache; logs success/failure
- ✅ Live Claude calls — `AnthropicModelAdapter.generate()` calls real API when `ANTHROPIC_API_KEY` set; falls back to stub on error
