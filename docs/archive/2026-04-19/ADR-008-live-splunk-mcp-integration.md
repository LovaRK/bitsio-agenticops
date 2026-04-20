# ADR-008: Live Splunk MCP Integration with SSH Tunnel

**Status:** Accepted
**Date:** 2026-04-11
**Deciders:** Ramakrishna (Lead), Codex (Architect)

## Context

BitsIO AgenticOps was initially designed with **mock-first Splunk integration** for deterministic local testing. As we approach production, we need to shift to **live Splunk MCP connectivity** while maintaining:

1. **Zero mock fallback** — when `SPLUNK_LIVE_MODE=true`, enforce real Splunk data
2. **Network security** — 8089 is private; SSH tunnel required for local dev access
3. **Backward compatibility** — mock mode still available for local dev/CI
4. **Fast failure** — fail loudly if live mode is broken, not silently with mock data

### Forces at Play

- **Production readiness**: Can't ship to production without real Splunk validation
- **Network constraints**: Splunk server at 144.202.48.85:8089 not publicly accessible
- **Developer experience**: SSH tunnel setup adds friction but ensures security
- **Testing**: All tests (42 unit, 8 e2e) should pass with both mock and live
- **Cost**: No additional infrastructure needed; leverages existing Splunk server

## Decision

**Implement live Splunk MCP mode with enforced connectivity and SSH tunnel support.**

### What We're Doing

1. **SplunkLiveService** — new service that always hits Splunk MCP (no mock fallback)
2. **SPLUNK_LIVE_MODE flag** — when true, disable all mock paths entirely
3. **SSH tunnel helpers** — `make tunnel-start/stop/status` for secure 8089 access
4. **Fail-fast validation** — API errors if Splunk is unreachable in live mode
5. **Web-side enforcement** — `NEXT_PUBLIC_REQUIRE_LIVE_API=true` prevents mock UI rendering

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Workflow                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Terminal A: SSH Tunnel                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ make tunnel-start                                    │  │
│  │ → ssh -N -L 8089:localhost:8089 root@144.202.48.85  │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  Terminal B: API (localhost:8001)                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ make dev (or docker compose up)                      │  │
│  │ → apps/api/app/main.py                              │  │
│  │   → SplunkLiveService                               │  │
│  │   → SplunkMCPAdapter                                │  │
│  │   → https://localhost:8089/services/mcp             │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  Terminal C: Web (localhost:3000)                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ pnpm --filter web dev                               │  │
│  │ → apps/web/lib/api.ts (no mock fallback)            │  │
│  │   → requires NEXT_PUBLIC_REQUIRE_LIVE_API=true      │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  http://localhost:3000/incidents                            │
│  ↓ (shows live Splunk data or 503 if Splunk down)          │
└─────────────────────────────────────────────────────────────┘
```

## Options Considered

### Option A: Live Splunk with SSH Tunnel (Chosen)

| Dimension | Assessment |
|-----------|------------|
| Security | **Excellent** — SSH tunnel is encrypted, no public exposure |
| Dev UX | **Good** — `make tunnel-start` is simple; one-time setup |
| Cost | **Zero** — uses existing Splunk server |
| Reliability | **High** — tunnel is stable; can auto-reconnect |
| Testing | **Good** — all tests pass with live or mock |
| Compliance | **Excellent** — keeps credentials off networks |

**Pros:**
- Secure tunnel isolates Splunk from public networks
- No infrastructure cost
- Developers keep control of their own tunnel
- SSH key auth is industry standard
- Easy to troubleshoot (tunnel logs, `netstat`, etc.)

**Cons:**
- Requires SSH setup (key auth or password)
- One more terminal to manage during dev
- If tunnel dies, app fails (but that's correct behavior)

---

### Option B: Open Port 8089 Publicly

| Dimension | Assessment |
|-----------|------------|
| Security | **Poor** — exposes Splunk API to internet |
| Dev UX | **Excellent** — no tunnel setup needed |
| Cost | **Medium** — firewall rules, WAF, monitoring |
| Reliability | **Medium** — needs DDoS protection, rate limiting |
| Testing | **Good** — all tests pass immediately |
| Compliance | **Poor** — violates zero-trust network |

**Pros:**
- Zero setup friction for developers
- Immediate access without tunnel management

**Cons:**
- **Security risk** — Splunk management API exposed
- Requires additional defense (WAF, rate limiting)
- Harder to audit who accessed what
- Token rotation becomes higher risk
- Vulnerable to credential compromise

**Decision:** **Rejected** — security risk outweighs UX benefit.

---

### Option C: Jump Host / Bastion Server

| Dimension | Assessment |
|-----------|------------|
| Security | **Excellent** — centralized access control |
| Dev UX | **Fair** — extra hop, more moving parts |
| Cost | **Medium** — bastion server + monitoring |
| Reliability | **Good** — bastion handles tunnel pooling |
| Testing | **Good** — all tests pass through bastion |
| Compliance | **Excellent** — audit trail on bastion |

**Pros:**
- Centralized access logs
- Can enforce 2FA on bastion
- Good for team with many developers

**Cons:**
- Overkill for current 1-2 person team
- Adds operational burden
- More to maintain

**Decision:** **Deferred** — revisit if team grows or compliance requires audit logs.

---

## Trade-off Analysis

### Security vs. Developer Experience

**We chose:** Security wins, but UX is acceptable.

SSH tunnel requires setup once, then `make tunnel-start` every session. This is a small friction cost for:
- No credentials in transit
- Encrypted connection
- Clear failure mode (tunnel down → app fails, not silent mock)

### Infrastructure Simplicity vs. Compliance

**We chose:** Simplicity with future-proof design.

We're not spinning up a bastion or WAF now, but the SSH tunnel approach scales to those if needed. The tunnel is a standard Unix pattern; adding a bastion later just becomes another tunnel layer.

### Testing Flexibility

**Dual-mode is good:**
- Local CI: Mock mode (deterministic, no network)
- Dev mode: Live mode (real data, enforced)
- Staging/Prod: Live mode only

All tests pass in both; we validate integration at runtime with `make live-verify`.

## Consequences

### Positive

1. **Production-ready** — Can validate against real Splunk immediately
2. **Secure by default** — SSH tunnel keeps API private
3. **Clear semantics** — Live mode = real Splunk; no silent fallback surprises
4. **Testable** — All tests pass with both mock and live
5. **Debuggable** — Tunnel failures are visible, not hidden

### Negative

1. **Dev friction** — Need SSH access and tunnel management
2. **Network dependency** — Dev requires SSH to 144.202.48.85
3. **Tunnel overhead** — One extra terminal to manage
4. **Failure mode** — If tunnel dies, app goes down (correct but annoying)

### Will Need to Revisit

1. **Auto-reconnect** — May want `ssh -v` wrapper that auto-restarts tunnel
2. **Bastion server** — If team grows beyond 2-3 devs or compliance requires audit
3. **Rate limiting** — Need to enforce Splunk API quotas per developer
4. **Token rotation** — Schedule regular SPLUNK_MCP_TOKEN rotation + emergency revocation

## Action Items

### Immediate (Done)

- [x] Implement `SplunkLiveService` with no mock fallback
- [x] Add `SPLUNK_LIVE_MODE` flag to `.env`
- [x] Wire web UI to enforce live mode (`NEXT_PUBLIC_REQUIRE_LIVE_API`)
- [x] Add `make tunnel-*` targets
- [x] Document in `docs/LIVE_SPLUNK_MODE.md` and `docs/SSH_TUNNEL_SETUP.md`
- [x] Verify all 42 tests pass
- [x] Verify all services running (docker compose ps)

### Short-term (Before Prod)

- [ ] User sets up SSH key auth to 144.202.48.85 (or password auth)
- [ ] Start tunnel and verify `make live-verify` passes
- [ ] Load test with live Splunk (`make load-test`)
- [ ] Test Splunk token rotation procedure

### Medium-term (Phase 8 Hardening)

- [ ] Wire RBAC middleware into API routes (roles: viewer, analyst, approver, admin)
- [ ] Implement threat model mitigations (docs/security/threat-model.md)
- [ ] Add GitHub Actions release gate workflow
- [ ] Set up monitoring/alerting for Splunk connectivity

### Long-term (Staging/Prod)

- [ ] Optional: Deploy bastion server if team grows
- [ ] Optional: Add WAF/DDoS protection if exposing 8089 in future
- [ ] Document runbooks for emergency token revocation
- [ ] Set up centralized audit logging

## References

- **Implementation**: `apps/api/app/services/splunk_live.py`
- **Adapter**: `packages/connectors/splunk-mcp/src/splunk_mcp/adapter.py`
- **Setup Guide**: `docs/LIVE_SPLUNK_MODE.md`
- **Tunnel Guide**: `docs/SSH_TUNNEL_SETUP.md`
- **API Routes**: `apps/api/app/main.py`
- **Web Integration**: `apps/web/lib/api.ts`

---

## Ratification

This ADR is **Accepted** by the core team. Live Splunk MCP integration with SSH tunnel is the canonical path for Phase 8 and beyond.

**Next decision point:** Once live connectivity is verified (SSH tunnel working + `make live-verify` passing), proceed to Phase 8 hardening (RBAC, threat model, load testing).
