# Threat Modeling Workshop — Phase 8 Security Deep Dive

**Duration**: 4-6 hours (can be split across 2 sessions)  
**Participants**: Security team, architects, ops lead  
**Facilitator Notes**: Included throughout  
**Output**: Threat Model document + Risk Register + Mitigation Plan

---

## Workshop Overview

This workshop uses the **STRIDE threat modeling methodology** to comprehensively analyze BitsIO AgenticOps and identify security risks across three deployment scenarios: Local Dev, Staging, and Production.

### STRIDE Categories
- **S**poofing Identity — Can attackers fake users/systems?
- **T**ampering with Data — Can attackers modify data?
- **R**epudiation — Can attackers deny their actions?
- **I**nformation Disclosure — Can attackers access sensitive data?
- **D**enial of Service — Can attackers disrupt service?
- **E**levation of Privilege — Can attackers gain unauthorized access?

### Workshop Schedule

**Session 1 (2-3 hours): Asset & Threat Identification**
- Asset inventory
- Data flow mapping
- Threat brainstorm (STRIDE)

**Session 2 (2-3 hours): Control & Risk Assessment**
- Current controls audit
- Risk scoring
- Mitigation planning

---

## Part 1: Asset & Threat Identification (Session 1)

### Step 1: Asset Inventory (30 min)

**Facilitator**: "What are the valuable assets we need to protect?"

#### Data Assets
| Asset | Classification | Sensitivity | Owner |
|-------|-----------------|-------------|-------|
| Splunk Incidents | Production Data | High | Security Ops |
| Decision Traces | Audit Data | High | Compliance |
| Approval Events | Audit Data | High | Compliance |
| User Identities | PII | Medium | IT Ops |
| API Keys (Dev) | Credentials | Medium | Engineering |
| API Keys (Prod) | Credentials | Critical | Security |
| JWT Tokens | Credentials | Critical | Security |
| Splunk MCP Token | Credentials | Critical | Security |

#### System Assets
| Asset | Type | Availability Target | Owner |
|-------|------|-------------------|-------|
| API Server (port 8001) | Service | 99.9% | Engineering |
| Web UI (port 3000) | Service | 99.9% | Engineering |
| PostgreSQL (port 5432) | Database | 99.99% | DBA |
| Redis (port 6379) | Cache | 99.9% | DBA |
| SSH Tunnel | Network | 99.5% | Ops |
| Splunk MCP | External | 99% | Splunk Admin |

#### Trust Boundaries
```
┌─────────────────────────────────────────────────────────────┐
│ EXTERNAL: Splunk MCP Server (144.202.48.85:8089)           │
│ TRUST: Public internet, SSL/TLS encrypted                  │
└─────────────────────────────────────────────────────────────┘
                           ↑↓ SSH Tunnel
┌─────────────────────────────────────────────────────────────┐
│ LOCAL NETWORK: Docker Compose Stack (localhost)            │
│ TRUST: Trusted developer machine                            │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Web UI       │ ←→ │ FastAPI      │ ←→ │ PostgreSQL   │ │
│  │ (port 3000)  │    │ (port 8001)  │    │ (port 5432)  │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         ↓                   ↓                     ↓         │
│     Browser            Splunk MCP           Decision        │
│     Headers            Adapter              Traces          │
│     Auth               Rate Limit            Approvals      │
│                        OTel                                 │
└─────────────────────────────────────────────────────────────┘
```

**Discussion**: Are there any assets we're missing? Any trust boundaries unclear?

---

### Step 2: Data Flow Mapping (45 min)

**Facilitator**: "Let's trace how data flows through the system and identify touch points."

#### Flow 1: Incident List Request
```
1. Browser → Sends GET /incidents + x-api-key header
2. Web API Client → Adds dev-analyst API key
3. Network → HTTPS/TLS on localhost (no encryption in dev)
4. API Server → rate_limit_middleware checks x-api-key in Redis
5. API Server → get_auth_context extracts user role from header
6. API Server → require_analyst decorator validates role
7. SplunkLiveService → Queries Splunk MCP via SSH tunnel
8. Splunk MCP → Returns incident JSON over HTTPS
9. API Server → Parses + normalizes incidents
10. API Server → Returns JSON to Web UI
11. Browser → Renders incident list
```

**Threats to identify** (you'll do this in Step 3):
- Can attacker intercept API key?
- Can attacker bypass rate limiter?
- Can attacker impersonate analyst?
- Can attacker inject malicious incident data?

#### Flow 2: Approval Submission
```
1. Browser → User clicks "Approve"
2. Web UI → Sends POST /approvals + decision + comment
3. Network → HTTPS/TLS (dev mode)
4. API Server → rate_limit_middleware checks tenant ID
5. API Server → get_auth_context extracts user from JWT/API-key
6. API Server → require_approver decorator checks role
7. TraceService → Appends ApprovalEvent to immutable trace
8. PostgreSQL → Stores approval event (audit trail)
9. API Server → Returns 201 Created to Web UI
10. Browser → Shows success toast
```

**Threats to identify**:
- Can attacker approve without authorization?
- Can attacker modify existing approvals?
- Can attacker fake audit trail?

#### Flow 3: SSH Tunnel Setup
```
1. Operator → Runs: ssh -N -L 8089:localhost:8089 root@144.202.48.85
2. SSH Client → Authenticates with SSH key or password
3. SSH Client → Establishes encrypted tunnel
4. Localhost:8089 → Forwarded to remote:8089 via SSH
5. API → Uses localhost:8089 as SPLUNK_MCP_BASE_URL
6. API → Connects to Splunk MCP via tunnel (encrypted)
```

**Threats to identify**:
- Can attacker intercept SSH tunnel?
- Can attacker establish rogue tunnel?
- What if SSH key is compromised?

**Discussion**: Map any additional flows specific to your deployment.

---

### Step 3: Threat Brainstorm (60 min)

**Facilitator**: "For each STRIDE category, what threats could affect our assets?"

#### Using the STRIDE Template

For each category, ask:

**S — Spoofing Identity**
- [ ] Can an attacker fake a user's identity?
- [ ] Can an attacker forge an API key?
- [ ] Can an attacker spoof JWT claims?
- [ ] Can an attacker impersonate Splunk MCP server?

**T — Tampering with Data**
- [ ] Can an attacker modify incident data in transit?
- [ ] Can an attacker modify approval events?
- [ ] Can an attacker tamper with rate limit buckets?
- [ ] Can an attacker modify decision traces?

**R — Repudiation**
- [ ] Can an attacker deny submitting an approval?
- [ ] Can an attacker deny accessing incidents?
- [ ] Are approvals logged with immutable timestamps?

**I — Information Disclosure**
- [ ] Can an attacker access Splunk data without auth?
- [ ] Can an attacker extract user roles from API responses?
- [ ] Can an attacker eavesdrop on Splunk MCP queries?
- [ ] Can an attacker see other tenants' rate limit buckets?
- [ ] Can tokens leak in logs?

**D — Denial of Service**
- [ ] Can an attacker exhaust rate limit to deny service?
- [ ] Can an attacker crash the API with malformed requests?
- [ ] Can an attacker overwhelm Splunk MCP?
- [ ] Can an attacker exhaust database connections?

**E — Elevation of Privilege**
- [ ] Can a viewer escalate to analyst?
- [ ] Can an analyst escalate to approver?
- [ ] Can an approver escalate to admin?
- [ ] Can a user bypass RBAC checks?

---

### Threat Brainstorm Worksheet

**Print this and fill in during workshop:**

```
SPOOFING IDENTITY THREATS
├─ Threat: Attacker forges API key (dev-analyst)
│  └─ Impact: Unauthorized incident access
│
├─ Threat: Attacker modifies JWT "role" claim
│  └─ Impact: Privilege escalation
│
└─ Threat: Attacker impersonates Splunk MCP endpoint
   └─ Impact: Man-in-the-middle incident data injection

TAMPERING WITH DATA THREATS
├─ Threat: Attacker modifies approval event in database
│  └─ Impact: Audit trail corruption
│
├─ Threat: Attacker injects malicious incident JSON
│  └─ Impact: XSS in web UI or logic injection
│
└─ Threat: Attacker modifies rate limit Redis key
   └─ Impact: DoS by disabling rate limiting

REPUDIATION THREATS
├─ Threat: Attacker denies they approved an incident
│  └─ Impact: Compliance violation (no audit trail)
│
└─ Threat: Attacker claims they never accessed incidents
   └─ Impact: Plausible deniability for insider threats

INFORMATION DISCLOSURE THREATS
├─ Threat: Attacker eavesdrops on SSH tunnel
│  └─ Impact: Splunk credentials, incident data exposed
│
├─ Threat: Attacker reads API logs with unredacted tokens
│  └─ Impact: Token compromise, session hijacking
│
├─ Threat: Attacker extracts user roles from error messages
│  └─ Impact: Privilege information leak
│
└─ Threat: Attacker reads rate limit bucket data in Redis
   └─ Impact: Tenant isolation bypass, multi-tenancy escape

DENIAL OF SERVICE THREATS
├─ Threat: Attacker floods API with 10k req/s
│  └─ Impact: Rate limiter exhausted, service degraded
│
├─ Threat: Attacker crafts malformed JSON to crash parser
│  └─ Impact: API 500 error, incident triage halted
│
├─ Threat: Attacker queries Splunk with expensive regex
│  └─ Impact: Splunk indexer CPU spike, slow queries
│
└─ Threat: Attacker opens 100 database connections
   └─ Impact: Connection pool exhausted, queries hang

ELEVATION OF PRIVILEGE THREATS
├─ Threat: Analyst forges "role: approver" in JWT
│  └─ Impact: Unauthorized approval submissions
│
├─ Threat: Attacker exploits missing RBAC on /health
│  └─ Impact: Information disclosure (service details)
│
├─ Threat: Attacker brute-forces dev API keys
│  └─ Impact: Access as analyst or approver
│
└─ Threat: Attacker exploits role hierarchy bug
   └─ Impact: Viewer claims analyst privileges
```

**Your Turn**: Fill in threats specific to your environment.

---

## Part 2: Control & Risk Assessment (Session 2)

### Step 4: Current Controls Audit (45 min)

**Facilitator**: "For each threat, what controls do we have in place?"

#### Control Template

For each threat, ask:
1. **Is there a control?** (Yes/No/Partial)
2. **How effective is it?** (Strong/Medium/Weak)
3. **Is it tested?** (Yes/No)
4. **Is it documented?** (Yes/No)

#### Example: Spoofing Identity — Forged API Key

| Threat | Control | Type | Strength | Tested | Documented |
|--------|---------|------|----------|--------|------------|
| Attacker forges API key | API key lookup in hardcoded map | Detective | Medium | ✅ Yes | ✅ Yes |
| | Dev keys only in dev mode | Preventive | Medium | ⚠️ Manual | ✅ Yes |
| | Rate limiting prevents brute force | Detective | Medium | ✅ Yes | ✅ Yes |

#### Current BitsIO Controls Inventory

**Authentication & Authorization**
- ✅ **AuthContext class** — Validates all incoming requests (detective)
- ✅ **Dependency injection** — `require_analyst`, `require_approver` decorators (preventive)
- ✅ **Role hierarchy** — `_ROLE_RANK` prevents downward privilege (preventive)
- ✅ **JWT validation** — PyJWT with JWKS signature check (detective)
- ✅ **Dev mode fallback** — API key lookup in `_DEV_API_KEYS` (preventive)
- ⚠️ **JWT exp claim** — Validated but no automatic refresh (detective)

**Data Protection**
- ✅ **HTTPS/TLS** — All external traffic encrypted (preventive)
- ✅ **Decision trace hashing** — SHA-256 content hash on traces (detective)
- ✅ **Immutable approvals** — Append-only, no modification (preventive)
- ⚠️ **Redaction in logs** — Partially implemented (detective)
- ⚠️ **Database encryption** — Not in MVP (preventive)

**Availability & DoS Protection**
- ✅ **Rate limiting** — 100 req/min per tenant (preventive)
- ✅ **Rate limiter tests** — Unit tests verify 429 responses (detective)
- ✅ **Redis-backed buckets** — Distributed rate limiting (preventive)
- ⚠️ **Request timeouts** — httpx timeout in adapter (detective)
- ⚠️ **Circuit breaker** — Not implemented (preventive)

**Audit & Compliance**
- ✅ **Approval audit trail** — Actor + timestamp on events (detective)
- ✅ **OTel instrumentation** — Spans with 8-tag matrix (detective)
- ✅ **Immutable trace store** — Hash validation (detective)
- ⚠️ **Log retention policy** — Not documented (preventive)
- ⚠️ **Compliance mapping** — Not done (detective)

**Network & Infrastructure**
- ✅ **SSH tunnel** — Encrypts dev-to-Splunk channel (preventive)
- ✅ **Docker isolation** — Services in separate containers (preventive)
- ✅ **Health checks** — Docker health endpoints (detective)
- ⚠️ **WAF/IDS** — Not in scope (preventive)
- ⚠️ **Secrets management** — Env vars (weak for production) (preventive)

**Discussion**: Which controls are strong? Which are gaps?

---

### Step 5: Risk Scoring (30 min)

**Facilitator**: "Let's quantify each threat using a simple risk matrix."

#### Risk Scoring Formula

```
Risk Score = Likelihood × Impact (1-5 scale)

Likelihood (1-5):
  1 = Very unlikely (attacker motivation is low, attack is complex)
  2 = Unlikely (attack is difficult, rare exploitability)
  3 = Possible (attack is feasible, some exploitability)
  4 = Likely (attack is easy, common exploitability)
  5 = Very likely (attack is trivial, widespread exploitability)

Impact (1-5):
  1 = Negligible (minimal business impact)
  2 = Minor (limited scope, easily contained)
  3 = Moderate (affects operations or compliance)
  4 = Major (data breach, regulatory violation)
  5 = Catastrophic (full system compromise, customer data at risk)

Risk Levels:
  1-5 = Low (no action required)
  6-12 = Medium (plan mitigation)
  13-18 = High (implement control immediately)
  19-25 = Critical (emergency response required)
```

#### Risk Register Template

Fill this out during workshop:

| ID | Threat | Likelihood | Impact | Score | Priority | Control | Status |
|----|--------|------------|--------|-------|----------|---------|--------|
| T1 | Attacker forges API key | 2 | 4 | 8 | Medium | Rate limiting + key validation | ✅ In place |
| T2 | Attacker modifies approval in DB | 1 | 5 | 5 | Low | Immutable trace store | ✅ In place |
| T3 | Attacker floods API (DoS) | 3 | 3 | 9 | Medium | Rate limiter | ✅ In place |
| T4 | Token leaks in logs | 2 | 4 | 8 | Medium | Redaction rules | ⚠️ Partial |
| T5 | JWT tamper (escalate role) | 1 | 5 | 5 | Low | Signature verification | ✅ In place |
| T6 | SSH tunnel intercepted | 1 | 5 | 5 | Low | SSH encryption | ✅ In place |
| T7 | Insider accesses other tenant data | 2 | 5 | 10 | Medium | Tenant isolation in rate limiter | ✅ In place |
| T8 | Database connection exhaustion | 2 | 3 | 6 | Low | Connection pooling | ✅ In place |
| T9 | Approval event modified post-submission | 1 | 5 | 5 | Low | Immutable append-only store | ✅ In place |
| T10 | Log injection / log forging | 2 | 2 | 4 | Low | Structured logging | ⚠️ Needs work |
| ... | ... | ... | ... | ... | ... | ... | ... |

**Your Turn**: Assess risks specific to your deployment.

---

### Step 6: Mitigation Planning (45 min)

**Facilitator**: "For each risk, what's our mitigation strategy?"

#### Mitigation Template

For each **Medium** or **High** risk, plan:
1. **Mitigation Control** — What will we implement?
2. **Timeline** — When?
3. **Owner** — Who?
4. **Effort** — How many hours?
5. **Success Criteria** — How do we verify?

#### Example Mitigation Plans

**T4: Token Leaks in Logs**
```
Risk Score: 8 (Medium)
Current Control: Partial redaction in logs

Mitigation Plan:
  Step 1: Implement comprehensive redaction rules
    - Regex pattern: /token[=:]\s*[a-zA-Z0-9_-]+/gi
    - Apply to all log outputs
    - Test with sample logs
    Owner: Backend Lead
    Timeline: 2 weeks
    Effort: 4 hours

  Step 2: Add redaction tests
    - Test suite: test_log_redaction.py
    - Verify tokens are masked in logs
    Owner: QA Lead
    Timeline: 1 week
    Effort: 3 hours

  Step 3: Document redaction policy
    - Create: docs/security/LOG_REDACTION_POLICY.md
    - Include: patterns, examples, testing
    Owner: Tech Writer
    Timeline: 1 week
    Effort: 2 hours

Success Criteria:
  ✅ 100% of tokens redacted in logs (verified by grep)
  ✅ Unit tests pass (test_log_redaction.py)
  ✅ No tokens in CloudWatch/Splunk logs
  ✅ Documentation approved by security
```

**T7: Insider Accesses Other Tenant Data**
```
Risk Score: 10 (Medium-High)
Current Control: Tenant isolation in rate limiter

Mitigation Plan:
  Step 1: Verify tenant isolation in all operations
    - Audit: All endpoints check tenant_id
    - Code review: apps/api/app/routers/*.py
    - Verify: x-tenant-id header is enforced
    Owner: Security Architect
    Timeline: 2 days
    Effort: 2 hours

  Step 2: Add tenant audit logging
    - Log: Every access with tenant_id + actor_id
    - Store: PostgreSQL audit_log table
    - Retention: 90 days minimum
    Owner: Backend Lead
    Timeline: 1 week
    Effort: 4 hours

  Step 3: Test tenant isolation
    - Test: User A cannot access Tenant B's data
    - Test: Rate limit buckets are per-tenant
    - Integration test: tests/integration/test_tenant_isolation.py
    Owner: QA Lead
    Timeline: 1 week
    Effort: 3 hours

Success Criteria:
  ✅ Tenant ID logged on all requests
  ✅ No cross-tenant data leaks in tests
  ✅ Audit log queryable in PostgreSQL
  ✅ Security team approves tenant isolation design
```

---

## Part 3: Deployment-Specific Threat Analysis (Optional Session 3)

If you have different deployment environments (local/staging/prod), analyze threats per environment:

### Local Dev Environment
```
Trust Model: Trusted developer machine
Threats:
  - Lower: Attacker would need local machine access
  - Higher: SSH key compromise (dev → Splunk)
Mitigations:
  - SSH key stored in ~/.ssh with 600 permissions
  - SSH key passphrase-protected (if possible)
  - Dev API keys only valid locally (hardcoded)
```

### Staging Environment
```
Trust Model: Internal network, shared staging DB
Threats:
  - Multiple developers have access
  - Production-like data (test incidents)
Mitigations:
  - OIDC with staging Azure AD/Okta
  - Staging tokens expire in 1 hour (shorter than prod)
  - Audit logging to separate staging Splunk instance
  - Rate limit lower (50 req/min) to catch DoS early
```

### Production Environment
```
Trust Model: Production data, external users potentially
Threats:
  - Real Splunk incidents (sensitive)
  - Real approval decisions (operational impact)
Mitigations:
  - OIDC with production Azure AD/Okta
  - MFA required for approver role
  - All tokens signed with production RSA key
  - Rate limit: 100 req/min (enterprise SLA)
  - Approval events logged to immutable audit sink
  - Secrets rotated quarterly
  - WAF in front (DDoS protection)
```

---

## Deliverables Checklist

After workshop, you'll produce:

- [ ] **Threat Model Document** (20-30 pages)
  - Asset inventory
  - Data flow diagrams
  - STRIDE threat list (50-100 threats identified)
  - Risk register with scores
  - Mitigation plans
  - Control implementation status

- [ ] **Risk Register** (spreadsheet)
  - All threats with likelihood/impact scores
  - Prioritized by score
  - Owner assignments
  - Timeline + effort estimates
  - Success criteria per mitigation

- [ ] **Compliance Mapping** (if applicable)
  - SOC2 CC controls mapped
  - FedRAMP AC controls mapped
  - HIPAA if health data involved
  - Evidence of control implementation

- [ ] **Runbooks** (from mitigations)
  - Token rotation procedure
  - Security incident response
  - Audit log investigation steps
  - Patch management

---

## Facilitation Tips

### Getting Participation
- **Encourage debate**: "Good security is built by disagreement"
- **No wrong answers**: "Let's note every threat, even if unlikely"
- **Anonymous threat cards**: If team is shy, collect threats on index cards first
- **Real examples**: "We saw this threat in X company. Could we be vulnerable?"

### Managing Time
- **Set a timer** for each STRIDE category (10-15 min)
- **Parking lot**: Park complex threats for follow-up discussion
- **Prioritize**: Focus on high-impact threats first
- **Iterate**: Threat modeling is never "complete" — schedule quarterly reviews

### Building Buy-In
- **Show controls already in place**: "We've already mitigated 40% of threats"
- **Risk scores**: "This threat is low-risk because of rate limiting"
- **Trade-offs**: "We could add MFA but increase deployment complexity"
- **Compliance**: "SOC2 requires this control, so let's implement it"

---

## Post-Workshop Actions

**Day 1 After Workshop**:
- [ ] Debrief: Consolidate threat list + risk scores
- [ ] Send thank you email to participants
- [ ] Note any urgent (Critical) risks for immediate action

**Week 1**:
- [ ] Draft Threat Model document (assign to security lead)
- [ ] Create GitHub issues for Medium/High mitigations
- [ ] Schedule follow-up meeting with owners

**Week 2-4**:
- [ ] Implement Medium risks (4-week sprint)
- [ ] Document completed mitigations
- [ ] Plan High risk mitigations (if any)

**Quarter 2**:
- [ ] Repeat threat modeling (quarterly review)
- [ ] Add new threats from lessons learned
- [ ] Update risk scores based on actual incidents

---

## Template: Threat Model Document Outline

Use this outline to write your final Threat Model:

```
# BitsIO AgenticOps — Threat Model

## 1. Executive Summary
- Overview of system
- Risk level: Low / Medium / High / Critical
- Top 3 risks
- Mitigation status

## 2. System Architecture
- Component diagram
- Data flow diagram
- Trust boundaries
- External dependencies (Splunk)

## 3. Asset Inventory
- Data assets (incidents, tokens, etc.)
- System assets (API, DB, etc.)
- User identities

## 4. Threat Analysis (by STRIDE)
- Spoofing: [list 10-15 threats]
- Tampering: [list 10-15 threats]
- Repudiation: [list 5-10 threats]
- Information Disclosure: [list 15-20 threats]
- Denial of Service: [list 10-15 threats]
- Elevation of Privilege: [list 10-15 threats]

## 5. Control Assessment
- Current controls (by threat)
- Control effectiveness (Strong/Medium/Weak)
- Testing status
- Documentation status

## 6. Risk Register
- All threats scored (Likelihood × Impact)
- Prioritized by risk score
- Owner assignments
- Timeline for mitigations

## 7. Mitigations
- High/Medium risk mitigations
- Implementation steps
- Success criteria
- Timeline + owner

## 8. Compliance Mapping
- SOC2 CC controls
- FedRAMP AC controls
- Evidence references

## 9. Appendices
- Glossary
- References (CIS, OWASP, etc.)
- Revision history
```

---

## Next Steps

1. **Schedule Workshop**: Invite security team + architects (4-6 hours)
2. **Send This Guide**: Share 1 week before workshop
3. **Prep Asset List**: Compile inventory before workshop
4. **Run Session 1**: Threats & controls (2-3 hours)
5. **Run Session 2**: Risks & mitigations (2-3 hours)
6. **Draft Report**: Consolidate findings (2-3 hours)
7. **Review & Approve**: Security team sign-off
8. **Publish**: Add to docs/ directory + wiki

---

**Ready to run threat modeling workshop?** Print this guide and schedule your first session! 🛡️

