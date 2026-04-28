# BitsIO AgenticOps — Threat Model (STRIDE)

This document provides a comprehensive threat model for the BitsIO AgenticOps platform using the STRIDE methodology.

## 1. System Overview

### Architecture Diagram

```text
[ User Browser ]
       |
       | (HTTPS)
       v
[ Next.js (Web) ] <---- (OIDC/JWT) ----> [ Identity Provider ]
       |
       | (Internal HTTP + x-api-key)
       v
[ FastAPI (API) ] <--------------------> [ PostgreSQL + pgvector ]
       |                                [ Redis (Rate Limit/Cache) ]
       |
       +---- [ LangGraph Agent ] ----> [ LLM (Ollama/Anthropic) ]
       |
       +---- [ Splunk Adapter ] ----> [ Splunk (via SSH Tunnel) ]
       |
       +---- [ OTel Exporter ] ----> [ OTel Collector ]
```

### Trust Boundaries
- **External**: Internet to Next.js (Untrusted).
- **Frontend-Backend**: Next.js to FastAPI (Trusted with API Key/JWT).
- **Data Persistence**: FastAPI to Postgres/Redis (Trusted internal network).
- **Third-Party Services**: FastAPI to Splunk/LLM (External trusted, encrypted via SSH/TLS).

---

## 2. STRIDE Analysis

| Component | Threat Category | Description | Severity | Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **API Endpoints** | Spoofing | Attacker impersonates an analyst. | High | RBAC middleware (viewer/analyst/approver). |
| | Tampering | Modification of incident data in transit. | Medium | TLS for all connections; API key validation. |
| | Information Disclosure | Unauthorized access to telemetry logs. | High | Strict tenant isolation (tenant_safe_id). |
| | Denial of Service | Flooding API with analysis requests. | High | Redis-based rate limiting (100 req/min). |
| | Elevation of Privilege | Viewer performing approval actions. | High | Role-based check on sensitive routes. |
| **Auth Middleware** | Spoofing | Forged JWT tokens. | High | PyJWT signature verification with JWKS cache. |
| | Repudiation | Actions performed without audit trail. | Medium | DecisionTrace stores all agent/human actions. |
| **Splunk Adapter** | Information Disclosure | Leakage of Splunk credentials in logs. | High | Automatic redaction of tokens in logging. |
| | Tampering | Prompt injection via Splunk results. | Medium | Pydantic validation of all adapter outputs. |
| **LangGraph Agent** | Information Disclosure | LLM leak of sensitive PII/PHI. | Medium | Local-first model policy (Ollama). |
| | Denial of Service | Infinite loops in graph execution. | High | Max-steps guardrails and node-level timeouts. |
| **Postgres Store** | Tampering | Modification of decision traces. | High | SHA-256 content hashing for immutability. |
| | Information Disclosure | SQL Injection. | High | Use of SQLAlchemy/Asyncpg parameterized queries. |
| **Redis Cache** | Denial of Service | Cache exhaustion. | Low | TTL-based expiration on all keys. |
| **OTel Pipeline** | Information Disclosure | Sensitive data in traces. | Medium | Filter/redaction middleware in OTel exporter. |

---

## 3. Implemented Mitigations

- **RBAC**: Implemented in `packages/shared/auth/middleware.py`.
- **JWT Verification**: Using `PyJWT` and `PyJWKClient` with 1-hour cache.
- **Rate Limiting**: Redis-based, 100 req/min per tenant.
- **Data Integrity**: SHA-256 hashing for all `DecisionTrace` records.
- **Redaction**: Splunk tokens redacted in `packages/connectors/splunk-mcp/`.
- **Infrastructure**: Gitleaks pre-commit hooks to prevent credential leakage.

---

## 4. Known Gaps & Risks

- **No mTLS**: Internal service-to-service communication relies on network trust within the container runtime.
- **Prompt Injection**: Incident data is passed to LLMs without extensive sanitization against adversarial prompts.
- **Unencrypted Redis**: Redis is currently running without a password in the development environment.
- **DDoS Protection**: No edge WAF or DDoS protection is currently implemented.
- **Audience Validation**: Relies on correct configuration of `OIDC_AUDIENCE` env var.

---

## 5. Rollback & Response Plan

- **Auth Failure**: Rotate `DEV_ANALYST_KEY` and flush Redis JWKS cache.
- **Trace Corruption**: Verify integrity using SHA-256 hashes; restore from Postgres backups.
- **LLM Loop**: Kill API process via PID file and restart with lower node timeout settings.

---
*Last updated: 2026-04-27*
