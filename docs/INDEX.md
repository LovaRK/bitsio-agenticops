# Documentation Index

Complete guide to all BitsIO AgenticOps documentation.

---

## 🚀 Getting Started (Start Here)

### For Everyone
- **[QUICKSTART.md](QUICKSTART.md)** — 5-minute setup guide
  - Option A: Local development (fastest)
  - Option B: Production deployment
  - Troubleshooting section

### For Different Roles

**👨‍💻 Developers**
1. [README.md](../README.md) — Project overview & quick commands
2. [PROJECT_STATUS.md](PROJECT_STATUS.md) — Current features & architecture
3. [LIVE_SPLUNK_ONLY.md](LIVE_SPLUNK_ONLY.md) — Data flow details

**🔧 Operations/DevOps**
1. [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) — Complete deployment walkthrough
2. [QUICKSTART.md](QUICKSTART.md) — Troubleshooting section
3. `scripts/` folder — Automated deployment scripts

**🏗️ Architects**
1. [README.md](../README.md) — Architecture diagram
2. [PROJECT_STATUS.md](PROJECT_STATUS.md) — Feature matrix & technical specs
3. `graphify-out/GRAPH_REPORT.md` — Knowledge graph of codebase

**👤 Product Managers**
1. [PROJECT_STATUS.md](PROJECT_STATUS.md) — Feature completion & status
2. [QUICKSTART.md](QUICKSTART.md) — User workflows

---

## 📚 Core Documentation

### Deployment
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** (380 lines)
  - Step-by-step setup (one-time SSH configuration)
  - Git workflow & branching strategy
  - Complete deployment sequence
  - Environment variables (all 15+)
  - Troubleshooting matrix (error → resolution)
  - Production URLs
  - Deployment timeline (4-5 minutes)

### Data & Architecture
- **[LIVE_SPLUNK_ONLY.md](LIVE_SPLUNK_ONLY.md)** (392 lines)
  - Configuration guarantee (SPLUNK_LIVE_MODE=true)
  - Data source flow (Splunk → Backend → Frontend)
  - Cost calculation & scaling formulas
  - Time window & data freshness (90-day rolling)
  - Refresh mechanism (why user-triggered)
  - Zero impact on client Splunk
  - Requirements & setup
  - Error handling scenarios

### Feature Documentation
- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** (350 lines)
  - Executive summary (Phase 8D - Production Ready)
  - Recent completions (refresh button + safety scripts)
  - Feature matrix (20+ features)
  - Technical specifications (scoring formula, weights)
  - Git commits from this session
  - Testing verification steps
  - Known limitations & next steps (P0-P2)
  - Support & troubleshooting

### Quick Reference
- **[QUICKSTART.md](QUICKSTART.md)** (200 lines)
  - 5-minute getting started
  - Option A: Local (2 min)
  - Option B: Production (5 min)
  - Common tasks with commands
  - Troubleshooting Q&A
  - URLs reference

### Main Project README
- **[README.md](../README.md)** (250 lines)
  - Quick start commands
  - Telemetry Value page features
  - Deployment scripts overview
  - Runtime switching (UI-based)
  - API contracts & endpoints
  - Incident Context Agent (ICA)
  - Make commands
  - Architecture diagram

---

## 🔧 Scripts & Configuration

### Deployment Scripts
| Script | Purpose |
|--------|---------|
| `scripts/run-local.sh` | Start local development on port 3000 |
| `scripts/deploy-safe.sh` | Deploy to production with validation |
| `scripts/validate-deployment.sh` | Pre-deployment SSH check |
| `scripts/check-status.sh` | Verify production server health |

### Configuration Files
| File | Purpose |
|------|---------|
| `scripts/vultr.deploy.env` | Production credentials (KEEP PRIVATE) |
| `.env.example` | Local development template |
| `.env` | Local development config (from .env.example) |

---

## 🏛️ Architecture Documents

### Existing
- `docs/adr/` — Architecture Decision Records (7 files)
- `docs/runbooks/` — Operational runbooks
- `docs/security/` — Security specifications

### Knowledge Graph
- `graphify-out/GRAPH_REPORT.md` — Navigable knowledge graph of codebase
  - Symbol definitions
  - Cross-file references
  - Dependency chains

---

## 📊 Feature Documentation

### Telemetry Value Page
- **Location:** `apps/web/app/telemetry-value/page.tsx`
- **Features:**
  - Live Splunk data (no fallback)
  - [🔄 Refresh Data] button (user-triggered)
  - Composite scoring (Util 35%, Det 40%, Qual 25%)
  - Cost optimization staircase (5 stages)
  - Quick wins analysis
  - Security gaps reporting
  - Tier distribution
  - Full scoring table
- **Filter Bar:** `apps/web/components/telemetry/FilterBar.tsx`
  - Cost/GB control
  - Weight adjustment
  - Refresh button

### Incident Context Agent (ICA)
- **Graph:** `packages/agent-core/src/agent_core/graphs/incident_context_agent.py`
- **Nodes:** context_ingest → context_enrichment → historical_correlation → anomaly_detection → context_response
- **API:** `POST /api/v1/incidents/{id}/enrich`
- **UI:** Incident Context panel on incident detail page

### Other Features
- Approval gates (YAML policy engine)
- RBAC middleware (x-api-key headers)
- OpenTelemetry spans (8 required tags)
- Redis rate limiting (100 req/min)
- Decision trace logging (SHA-256 hashing)

---

## 🔐 Configuration Reference

### Critical (Must Set)
```bash
SPLUNK_LIVE_MODE=true              # No fallback to mock data
SSH_PASSWORD="your-password"       # For production deployment
SPLUNK_MCP_TOKEN="token-here"      # Splunk authentication
```

### Defaults
```bash
cost_per_gb_year=10
util_weight=0.35
det_weight=0.40
qual_weight=0.25
MODEL_PROVIDER=ollama              # Local-first
NEXT_PUBLIC_TELEMETRY_METRICS_TIMEOUT_MS=45000
```

### See Also
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) — Complete environment variables reference

---

## 🧪 Testing & Verification

### Local Testing
```bash
bash scripts/run-local.sh
# http://localhost:3000/telemetry-value
# Click [🔄 Refresh Data] → See live data load
```

### Production Testing
```bash
bash scripts/check-status.sh
# Verifies all containers running
# Shows health status (db/redis/splunk)
# Lists production URLs
```

### API Testing
```bash
curl http://144.202.48.85:8001/api/v1/telemetry/executive-summary \
  -H "x-api-key: dev-analyst" | jq '.trust.fetched_at'
# Should show ISO 8601 timestamp (live data)
```

---

## 🚨 Troubleshooting Quick Links

### Common Issues
- **Port 3000 in use** → See [QUICKSTART.md](QUICKSTART.md)
- **Site can't be reached** → See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) "Troubleshooting"
- **SSH connection failed** → See [QUICKSTART.md](QUICKSTART.md) "Troubleshooting"
- **Refresh button not working** → See [QUICKSTART.md](QUICKSTART.md)

### When to Read What
- **"I don't know where to start"** → [QUICKSTART.md](QUICKSTART.md)
- **"How do I deploy?"** → [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **"What features are done?"** → [PROJECT_STATUS.md](PROJECT_STATUS.md)
- **"How does data flow?"** → [LIVE_SPLUNK_ONLY.md](LIVE_SPLUNK_ONLY.md)
- **"What's the architecture?"** → [README.md](../README.md) + `graphify-out/`

---

## 📈 Progress Tracking

### This Session (2026-04-29)
- ✅ [🔄 Refresh Data] button implementation
- ✅ Deployment safety infrastructure (validation + health checks)
- ✅ Updated README.md with new scripts
- ✅ Created PROJECT_STATUS.md (full project overview)
- ✅ Created QUICKSTART.md (5-minute guide)
- ✅ Created DEPLOYMENT_GUIDE.md (comprehensive)
- ✅ Production deployment successful (all containers running)

### Phase Completion
- Phase 0-7: ✅ Complete
- Phase 8A-8C (ICA): ✅ Complete
- Phase 8D (UI + Deployment): ✅ Complete

---

## 📞 Support

**Getting Help:**
1. Check [QUICKSTART.md](QUICKSTART.md) troubleshooting section
2. Search in [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
3. Check [PROJECT_STATUS.md](PROJECT_STATUS.md) "Known Limitations"
4. Run `bash scripts/check-status.sh`

**Reporting Issues:**
- Include: Your OS, commands run, error message
- Reference: Which doc you followed
- Attach: Output of `bash scripts/validate-deployment.sh`

---

## 📄 Document Stats

| Document | Lines | Purpose |
|----------|-------|---------|
| QUICKSTART.md | ~200 | 5-min getting started |
| DEPLOYMENT_GUIDE.md | ~380 | Full deployment guide |
| LIVE_SPLUNK_ONLY.md | ~392 | Data flow architecture |
| PROJECT_STATUS.md | ~350 | Project state & features |
| README.md | ~250 | Main project overview |
| **TOTAL** | **~1,572** | Complete documentation |

---

## 🎯 Navigation Map

```
START HERE
    ↓
QUICKSTART.md (5 min)
    ↓
    ├─ Deploy? → DEPLOYMENT_GUIDE.md
    │
    ├─ How it works? → LIVE_SPLUNK_ONLY.md
    │
    ├─ What's done? → PROJECT_STATUS.md
    │
    └─ Architecture? → README.md + graphify-out/
```

---

**Last Updated:** 2026-04-29  
**Total Documentation:** 5 comprehensive guides + code reference  
**Coverage:** Features, Deployment, Architecture, Troubleshooting, API Reference  
