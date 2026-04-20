# Phase 8 Hardening Plan — Live Splunk Integration

**Status**: Phase 8 Core Complete (42/42 unit tests, 8/8 e2e tests passing)  
**Next**: Security Hardening & Production Readiness  
**Timeline**: 3-4 weeks at 8h/day (25-35 hours)

---

## Overview

Phase 8 has delivered a production-capable live Splunk integration with:
- ✅ SplunkLiveService (live incident queries via MCP/Native)
- ✅ RBAC middleware fully wired on all API routes
- ✅ Rate limiting (100 req/min per tenant, Redis-backed)
- ✅ OpenTelemetry instrumentation (8-tag matrix on all spans)
- ✅ Decision tracing with approval audit trail
- ✅ Docker infrastructure (7 services, all passing health checks)
- ✅ SSH tunnel support for secure local dev

**Current State**: Ready for hardening and compliance review.

---

## Phase 8 Remaining Work

### Task 1: Load Testing Against Live Splunk

**Effort**: 6-8 hours  
**Dependencies**: SSH tunnel + live Splunk connectivity  
**Owner**: QA / Performance Engineer  
**Success Criteria**:
- [ ] Locust load test harness runs without errors
- [ ] API maintains <500ms p95 latency under 100 concurrent users
- [ ] Rate limiter correctly rejects excess requests (429 responses)
- [ ] No memory leaks after 1-hour sustained load
- [ ] All 7 services remain healthy under load

**Files**:
- `tests/load/locustfile.py` — Locust load test definition
- `tests/load/scenarios/` — Pre-defined load scenarios
- `.env` — Configure for live mode: `SPLUNK_LIVE_MODE=true`

**Steps**:

```bash
# 1. Start SSH tunnel
make tunnel-start

# 2. Start Docker stack in live mode
make dev

# 3. Run load tests (generates HTML report)
make load-test

# 4. Review report
open reports/load_test_report.html
```

**Expected Load Test Metrics**:
| Metric | Target | Threshold |
|--------|--------|-----------|
| API p95 latency | <500ms | <1000ms (fail) |
| Splunk p95 latency | <300ms | <800ms (fail) |
| Rate limit accuracy | ±5% | >10% (fail) |
| Memory growth | <50MB/hour | >200MB/hour (fail) |
| Error rate | <1% | >5% (fail) |

**Deliverable**: `reports/load-test-phase8-<date>.html` + summary in PHASE_8_STATUS.md

---

### Task 2: Threat Model & Security Deep Dive

**Effort**: 4-6 hours  
**Dependencies**: RBAC audit (complete), load testing baseline  
**Owner**: Security Engineer  
**Success Criteria**:
- [ ] Identify all assets (data, compute, network)
- [ ] Catalog all threats per STRIDE model
- [ ] Map controls to threats (RBAC, rate limit, TLS, etc.)
- [ ] Document residual risks + mitigations
- [ ] Create 3-tier deployment matrix (dev/staging/prod)

**Files**:
- `docs/security/THREAT_MODEL.md` — Complete threat analysis
- `docs/security/DEPLOYMENT_MATRIX.md` — Environment-specific configs

**STRIDE Categories to Cover**:

| Category | Examples | Controls |
|----------|----------|----------|
| **S**poofing | Fake JWT, API key theft | JWT signature verification, dev keys local-only |
| **T**ampering | Modified approval events, incident data | Immutable trace store, hash validation |
| **R**epudiation | Approval denial, action denial | Audit log with actor ID + timestamp |
| **I**nformation Disc. | Splunk data leakage, token exposure | Redaction in adapter, no tokens in logs |
| **D**enial of Service | Rate limit bypass, Splunk overload | Rate limiter, query limits, timeout controls |
| **E**levation of Privilege | Analyst → Admin via RBAC bypass | Role rank validation, deny by default |

**Deliverable**: 
- `docs/security/THREAT_MODEL.md` (8-10 pages)
- `docs/security/DEPLOYMENT_MATRIX.md` with env-specific risk profiles

---

### Task 3: Release Gate GitHub Actions Workflow

**Effort**: 3-4 hours  
**Dependencies**: Load test results + threat model  
**Owner**: DevOps / Release Manager  
**Success Criteria**:
- [ ] Unit tests run automatically on PR
- [ ] E2E tests run on merge to main
- [ ] Load test harness available as on-demand job
- [ ] Security linting (gitleaks, trivy) blocks secrets
- [ ] RBAC audit report auto-generated
- [ ] Release notes auto-populated from commits

**Files**:
- `.github/workflows/unit-tests.yml` — Python unit tests (CI)
- `.github/workflows/e2e-tests.yml` — Web E2E tests (CI)
- `.github/workflows/load-test.yml` — Manual load test trigger
- `.github/workflows/release.yml` — Semantic versioning + release notes
- `.github/workflows/security.yml` — Trivy image scan + gitleaks

**Workflow Matrix**:

```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.12']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
      - run: make bootstrap
      - run: make test
      - uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: make bootstrap
      - run: make dev &
      - run: pnpm --filter web test:e2e
      - run: make docker-down

  load-test:
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: make load-test
      - uses: actions/upload-artifact@v3
        with:
          name: load-test-report
          path: reports/

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker run --rm -v $PWD:/root/src aquasec/trivy:latest image --severity HIGH,CRITICAL
      - run: gitleaks detect --verbose
```

**Deliverable**: 
- All `.github/workflows/*.yml` files created and tested
- Documentation: `docs/CICD_PIPELINE.md`

---

### Task 4: Incident Response Runbooks

**Effort**: 4-6 hours  
**Dependencies**: Threat model, operational knowledge  
**Owner**: SRE / Operations  
**Success Criteria**:
- [ ] Token rotation procedure documented
- [ ] Splunk connectivity troubleshooting guide
- [ ] Rate limit escalation procedure
- [ ] Approval audit investigation playbook
- [ ] Incident triage decision tree
- [ ] On-call escalation matrix

**Runbooks to Create**:

1. **`docs/runbooks/TOKEN_ROTATION.md`**
   - When: Quarterly or on compromise suspicion
   - How: Generate new Splunk JWT via admin UI
   - Verify: Test connectivity after rotation
   - Rollback: Keep old token for 24h

2. **`docs/runbooks/SPLUNK_CONNECTIVITY.md`**
   - Symptom: API returns 502 "Splunk failed"
   - Check: SSH tunnel status, token expiry, MCP endpoint
   - Mitigate: Auto-fallback to mock mode (if enabled)
   - Escalate: Contact Splunk admin if service down

3. **`docs/runbooks/RATE_LIMIT_INCIDENT.md`**
   - Symptom: Client receives 429 "Too Many Requests"
   - Root cause: Single tenant exceeding limits (or attacker)
   - Action: Check logs, increase limit, or block IP
   - Prevention: Monitor rate_limit_exceeded metrics

4. **`docs/runbooks/APPROVAL_AUDIT_INVESTIGATION.md`**
   - Symptom: Approval event missing or incorrect actor
   - Investigation: Query decision trace store by workflow_id
   - Recovery: Check audit log (immutable), escalate if tampered
   - Prevention: Implement approval event signing

5. **`docs/runbooks/INCIDENT_TRIAGE.md`**
   - Decision tree: Is incident real or false positive?
   - How to: Review evidence, check confidence score, contact Splunk
   - Escalation: When to page on-call SME
   - Root cause: Backlog incidents for post-incident review

**Deliverable**: 
- 5 markdown runbooks in `docs/runbooks/`
- Runbook index: `docs/runbooks/INDEX.md`
- On-call guide: `docs/runbooks/ON_CALL_GUIDE.md`

---

### Task 5: Compliance & Audit Logging

**Effort**: 4-6 hours  
**Dependencies**: RBAC audit, threat model  
**Owner**: Compliance / Security  
**Success Criteria**:
- [ ] Audit log captures all approval events (actor, timestamp, action)
- [ ] Decision traces are immutable (hash validation)
- [ ] Logs are queryable via OTel backend (Jaeger/Tempo)
- [ ] Log retention policy documented (min. 90 days)
- [ ] Compliance checklist (SOC2, FedRAMP, HIPAA as applicable)

**Audit Log Schema**:

```json
{
  "timestamp": "2026-04-13T10:05:00Z",
  "event_type": "approval_created",
  "actor": "dev:dev-approver",
  "workflow_id": "wf_inc_20260408_42",
  "incident_id": "inc_20260408_42",
  "decision": "approve",
  "confidence": 0.78,
  "comment": "Verified host logs; playbook documented",
  "ip_address": "127.0.0.1",
  "user_agent": "curl/7.64.1",
  "trace_id": "a1b2c3d4e5f6...",
  "status_code": 200
}
```

**Compliance Mappings**:

| Control | Mapping |
|---------|---------|
| SOC2 CC6.1 | Audit logs + RBAC enforcement |
| FedRAMP AC-2 | User identification (user_id in AuthContext) |
| HIPAA 164.312(b) | Immutable audit trail (decision traces) |
| ISO 27001 A.9.2 | Access control (RBAC roles) |

**Deliverable**:
- `docs/compliance/AUDIT_LOG_SCHEMA.md`
- `docs/compliance/COMPLIANCE_CHECKLIST.md` (SOC2, FedRAMP, HIPAA)
- Audit log retention policy

---

## Task Dependency Graph

```
RBAC Audit (Complete)
  ├─→ Load Testing (Task 1)
  │    └─→ Release Gate (Task 3)
  │         └─→ GitHub Actions CI/CD
  ├─→ Threat Model (Task 2)
  │    └─→ Runbooks (Task 4)
  │         └─→ On-Call Training
  └─→ Compliance (Task 5)
       └─→ SOC2 Audit Prep
```

---

## Effort Estimate by Role

### Backend Engineer
- Load testing setup & analysis: 6h
- Threat model (technical controls): 2h
- **Total**: 8 hours

### DevOps / SRE
- GitHub Actions workflows: 4h
- Release gate setup: 3h
- Runbooks & automation: 4h
- **Total**: 11 hours

### Security Engineer
- Threat model (STRIDE analysis): 4h
- Compliance mapping: 2h
- Risk assessment: 2h
- **Total**: 8 hours

### Total Effort: **27-35 hours** (3-4 days at 8h/day, 1-2 weeks at 4h/day)

---

## Success Criteria (Phase 8 Complete)

- [ ] All unit tests passing (42/42)
- [ ] All E2E tests passing (8/8)
- [ ] Load tests show API p95 latency <500ms at 100 concurrent users
- [ ] RBAC audit report signed off by security
- [ ] Threat model covers all deployment scenarios
- [ ] GitHub Actions CI/CD pipeline is green
- [ ] 5 incident response runbooks published
- [ ] Compliance checklist completed (SOC2/FedRAMP/HIPAA)
- [ ] Documentation index updated with all Phase 8 artifacts
- [ ] Release notes auto-generated for next version

---

## Rollout Plan

### Week 1: Testing & Security
- Mon-Tue: Load testing + analysis
- Wed: Threat model workshop
- Thu-Fri: Runbooks & incident response procedures

### Week 2: Release Infrastructure
- Mon-Tue: GitHub Actions setup
- Wed: Security scanning integration
- Thu: Release notes + semantic versioning
- Fri: Dry-run release to staging

### Week 3: Compliance & Hardening
- Mon-Tue: Compliance checklist + audit log validation
- Wed: Security review sign-off
- Thu-Fri: Final testing + release to production

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Load test reveals performance bug | Medium | High | Early testing, load test in parallel |
| Threat model gaps discovered late | Low | High | Use STRIDE framework, security review |
| GitHub Actions secrets leak | Low | Critical | Use GitHub secrets manager, no secrets in code |
| Runbooks become outdated | High | Medium | Automation + runbook tests in CI |
| Compliance delays release | Medium | Medium | Early engagement with compliance team |

---

## Governance & Approval

**Stakeholders**:
- Security team (threat model, compliance)
- Ops team (runbooks, release gate)
- Product team (feature/security trade-offs)
- Compliance officer (SOC2, FedRAMP, HIPAA)

**Sign-Off Gates**:
1. ✅ Load testing results reviewed
2. ⏳ Threat model approved by security
3. ⏳ Runbooks tested with on-call team
4. ⏳ GitHub Actions pipeline passes security scan
5. ⏳ Compliance checklist signed by legal/compliance
6. ⏳ Final QA sign-off before production release

---

## Next Steps

**Immediate** (Today):
- [ ] Share this plan with team
- [ ] Assign task owners
- [ ] Schedule kickoff meeting

**This Week**:
- [ ] Start load testing (Task 1)
- [ ] Begin threat model workshop (Task 2)
- [ ] GitHub Actions research spike (Task 3)

**Next Week**:
- [ ] Load test results review
- [ ] Threat model draft complete
- [ ] GitHub Actions workflows running
- [ ] Runbooks drafted

**Week 3**:
- [ ] All tasks complete
- [ ] Sign-offs obtained
- [ ] Staged release to production

---

**Plan Version**: 1.0  
**Last Updated**: 2026-04-13  
**Owner**: Engineering Team  
**Status**: Active (Ready to Kickoff)
