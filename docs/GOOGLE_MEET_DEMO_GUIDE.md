# Google Meet Demo Guide — BitsIO AgenticOps Phase 8

**Purpose**: Demo to AI agents (ChatGPT, Claude, Copilot, etc.)  
**Duration**: 20-30 minutes (includes Q&A)  
**Format**: Google Meet screen share + live system

---

## Pre-Demo Setup (30 min before)

### 1. Google Meet Room Setup
```
1. Create Google Meet: https://meet.google.com
2. Test audio/video (camera, mic)
3. Share meeting link with attendees
4. Set up second monitor for notes/chat
5. Close notifications (mute Slack, email, etc.)
```

### 2. System Verification
```bash
# Terminal 1: Check everything
make tunnel-status         # ✅ Tunnel active
docker compose ps          # ✅ 7/7 services up
curl http://localhost:8001/health | jq .  # ✅ API responding
curl -s http://localhost:8001/api/v1/incidents \
  -H "x-api-key: dev-analyst" | jq '.items | length'
# ✅ Should return: 50 (incidents available)
```

### 3. Browser Preparation
```
1. Open Chrome/Safari
2. Navigate to: http://localhost:3000/incidents
3. Set zoom to 100% (readable on camera)
4. Open in full screen
5. Have curl commands ready in terminal
```

### 4. Documentation Tabs Open
- Have these tabs ready to share:
  - `docs/DEMO_READINESS.md` (for talking points)
  - `docs/OPERATOR_HANDBOOK.md` (quick reference)
  - `docs/PHASE_8_COMPLETE_SUMMARY.md` (executive summary)
  - API endpoint: `http://localhost:8001` (for API demo)

---

## Google Meet Demo Flow (20-30 min)

### [Pre-Demo: 5 min] — Introduction & Context

**What to say**:
```
"Hello everyone! Today I'm demoing BitsIO AgenticOps — 
an AI-powered observability platform that connects to live Splunk,
uses AI to analyze incidents, and puts humans in control of approvals.

This is Phase 8: Live Integration complete with:
- Real-time Splunk incident queries
- RBAC (role-based access control)
- Decision tracing with audit trails
- Rate limiting + security hardening
- Load tested (1,319 requests validated)

Let me walk you through how it works."
```

**Share**:
- Screen: Your face + system behind you (builds trust)
- Share your desktop (next step)

---

### [Demo: 15-20 min] — Live System Walkthrough

#### Segment 1: Incident List (2 min)

**Say**:
```
"First, the incident list. These are real incidents 
from our live Splunk instance—no mock data.

Notice:
- Severity color coding (red = high, orange = medium)
- Event count (how many related events)
- Timestamp (when incident occurred)
- Source (which Splunk index)

All 50 incidents are fetched from Splunk in real time 
via a secure SSH tunnel. This data updates live."
```

**Action**:
1. Share screen: Show `http://localhost:3000/incidents`
2. Let audience see incident list (pause 10 sec)
3. Point to severity colors, event counts
4. Scroll to show variety of incidents
5. Say: "Each incident has AI analysis. Let's click one."

**Expected**: 40-50 incidents visible, good contrast

---

#### Segment 2: Decision Trace & AI Reasoning (4 min)

**Say**:
```
"When I click an incident, the system shows the complete 
AI reasoning timeline. The AI went through 7 steps:

1. Incident Ingest — parse raw data
2. Evidence Retrieval — query Splunk for related events
3. Correlation — find patterns across systems
4. Reasoning Draft — generate AI explanation
5. Confidence Scoring — calculate trustworthiness
6. Approval Check — flag for human review
7. Final Response — structured summary

This is NOT a black box. Every step is timestamped and traced."
```

**Action**:
1. Click on first incident in list
2. Wait for detail page to load (should be <2 sec)
3. Show "Final Assessment" section
4. Point to confidence score (should be 0.7-0.9)
5. Scroll to "Reasoning Timeline"
6. Point to each of the 7 steps
7. Read the AI's conclusion aloud

**Expected**:
- Page loads quickly
- 7 steps visible with timestamps
- Confidence score >0.7
- Assessment text is coherent

---

#### Segment 3: Evidence Links (2 min)

**Say**:
```
"The AI's conclusion is only as good as the evidence. 
We can verify every claim by jumping to Splunk.

This 'View in Splunk' link takes you directly to the events 
the AI analyzed. Full traceability."
```

**Action**:
1. Scroll to "Evidence" section
2. Click "View in Splunk" (or explain it would open Splunk)
3. Say: "This links directly to the source data"
4. Return to BitsIO tab

**Expected**: Link is clickable and valid

---

#### Segment 4: Approval Gate (3 min)

**Say**:
```
"Here's the critical control: Human approval.

The AI recommends an action, but humans decide.
An analyst can:
- View the recommendation
- Check the reasoning
- Add context or notes
- Approve or reject

When approved, it's recorded with:
- Actor ID (who approved)
- Timestamp (when)
- Comment (why)

This is your audit trail for compliance."
```

**Action**:
1. Scroll to "Approval Gate" section
2. Point to current decision status
3. Add comment: "Verified in runbook. Scaling approved."
4. Click "Approve" button
5. Show success response
6. Point to timestamp and actor ID

**Expected**:
- Approval form visible
- Success response appears
- Timestamp shows current time
- Actor ID shows your user

---

#### Segment 5: Backend Architecture (2 min)

**Say**:
```
"Behind the scenes, here's what powers this:

API Server (FastAPI):
- 9 REST endpoints
- RBAC middleware (role-based access control)
- Rate limiting (100 req/min per tenant)
- OTel instrumentation (distributed tracing)

Database:
- PostgreSQL 16 with pgvector
- Stores decision traces + approvals
- Immutable audit trail (append-only)

Cache:
- Redis 7.2
- Rate limit buckets
- Query caching

External:
- Splunk MCP (incident source)
- OpenTelemetry Collector
- SSH tunnel (secure connection)

All 7 services run in Docker."
```

**Action**:
1. Show terminal: `docker compose ps`
2. Point to each service (api, web, postgres, redis, etc.)
3. Say: "All healthy, all running"

**Expected**: 7 services shown as "Up"

---

#### Segment 6: Performance & Load Testing (3 min)

**Say**:
```
"We load tested this system under realistic stress.

Test Scenario:
- 10 concurrent users
- 5 minutes duration
- 1,319 total requests
- Realistic traffic pattern

Results:
- p50 latency: 4ms (excellent)
- p95 latency: 1.1 seconds (acceptable, includes Splunk query)
- p99 latency: 2 seconds (within tolerance)
- Approval endpoint: 6ms (ultra-fast)
- Zero crashes
- Rate limiter: Working correctly (429 responses)

No infrastructure issues. System is stable under load."
```

**Action**:
1. Share: `docs/LOAD_TESTING_GUIDE.md` or `reports/BASELINE_ANALYSIS.md`
2. Point to key metrics:
   - Response time percentiles
   - Error breakdown
   - Infrastructure health
3. Say: "We tested with real Splunk data"

**Expected**: Metrics show green status across the board

---

### [Post-Demo: 5-10 min] — Q&A

**Common Questions & Answers**:

**Q: How does RBAC work?**
A: 4 roles: viewer (read-only), analyst (view incidents), approver (approve decisions), admin (full access). Enforced at API layer. Every route requires role check.

**Q: What if Splunk is down?**
A: System can fall back to mock data (configurable). SSH tunnel monitored. Fallback is transparent to users.

**Q: How do you prevent privilege escalation?**
A: Role hierarchy is strictly enforced. Users can't fake JWT claims. RBAC decorators on every route.

**Q: Is this production-ready?**
A: MVP is complete with security hardening underway. Load tested. CI/CD pipelines ready. SOC2/FedRAMP compliance mapping in progress.

**Q: Can I use this with my Splunk?**
A: Yes. Set `SPLUNK_MCP_BASE_URL` to your Splunk MCP endpoint. SSH tunnel or direct connection supported. Dev API keys for initial setup, OIDC JWT for production.

---

## Documentation to Share

### 📋 Pre-Demo (Send 24 hours before)

**Email to send**:
```
Subject: BitsIO AgenticOps Demo Tomorrow — 20 min on Google Meet

Hi [Attendees],

Tomorrow I'm demoing BitsIO AgenticOps Phase 8 Live Integration.

What we'll see:
✅ Real-time incident list from live Splunk
✅ AI reasoning timeline (7 steps, fully traced)
✅ Approval gate with audit trail
✅ Load test results (1,319 requests validated)
✅ Production-ready system

Pre-demo docs (optional reading):
- PHASE_8_COMPLETE_SUMMARY.md — Executive overview
- OPERATOR_HANDBOOK.md — Quick reference
- RBAC_AUDIT.md — Security controls

Google Meet link: [LINK]
Time: [TIME]

See you there!
```

---

### 📄 Documents to Share During Demo

**Share these 3 files in Google Meet chat**:

#### 1. **PHASE_8_COMPLETE_SUMMARY.md** (2 pages)
- What was delivered
- Test results (42/42 unit tests passing)
- Infrastructure status (7/7 services)
- Next steps

#### 2. **OPERATOR_HANDBOOK.md** (4 pages)
- 3-terminal startup
- Mode-switch matrix
- 5-minute demo script
- Troubleshooting checklist

#### 3. **DEMO_READINESS.md** (8 pages)
- Pre-demo checklist
- Step-by-step demo script
- Talking points
- Troubleshooting guide

---

### 📊 Post-Demo (Send after)

**Follow-up email**:
```
Subject: BitsIO AgenticOps Demo — Full Docs & Next Steps

Hi [Attendees],

Thanks for joining the demo! 

Full documentation:
📋 Operator Handbook: docs/OPERATOR_HANDBOOK.md
🔒 Security (RBAC): docs/RBAC_AUDIT.md
📈 Load Testing: docs/LOAD_TESTING_GUIDE.md
🏗️ Architecture: docs/IMPLEMENTATION_GUIDE.md
🧵 Threat Model: docs/security/THREAT_MODELING_WORKSHOP.md
🚀 CI/CD: docs/CICD_PIPELINE.md

Live System:
- Web UI: http://localhost:3000/incidents
- API: http://localhost:8001/api/v1/incidents
- Docs: https://github.com/[repo]/tree/main/docs

Questions? Reply to this email or open an issue.

Next: Threat modeling workshop (4-6 hours) + CI/CD activation.
```

---

## Demoing to AI Agents (ChatGPT, Claude, Copilot)

### Special Guidance for AI Audiences

**AI agents need detailed, structured information. Here's how to present it:**

#### 1. **System Architecture Description**
Share this structured format:
```
SYSTEM: BitsIO AgenticOps

COMPONENTS:
- Web UI (Next.js 14) → localhost:3000
- REST API (FastAPI) → localhost:8001
- PostgreSQL 16 → localhost:5432
- Redis 7.2 → localhost:6379
- Splunk MCP Adapter → SSH tunnel to 144.202.48.85:8089

KEY FEATURES:
- Live incident queries from Splunk
- AI reasoning (LangGraph + Claude API)
- RBAC (4-tier: viewer/analyst/approver/admin)
- Rate limiting (100 req/min per tenant)
- Decision tracing (immutable audit trail)

DATA FLOW:
1. User requests incident list
2. API authenticates (RBAC check)
3. SplunkLiveService queries Splunk
4. Results returned + AI analyzes
5. User approves or rejects
6. Approval logged (immutable)

SECURITY CONTROLS:
- JWT signature validation (OIDC)
- API key fallback (dev mode)
- Rate limiter (Redis-backed)
- Redaction in logs
- SSH encryption to Splunk
```

#### 2. **API Endpoint Documentation**
Share this for AI understanding:
```
GET /api/v1/incidents
  Headers: x-api-key: dev-analyst
  Returns: {"items": [...incidents...]}
  Status: 200 OK or 429 Too Many Requests

GET /api/v1/decision-traces/{workflow_id}
  Headers: x-api-key: dev-analyst
  Returns: {"workflow_id": "...", "reasoning": [...]}
  Status: 200 OK or 404 Not Found

POST /api/v1/decision-traces/{workflow_id}/approvals
  Headers: x-api-key: dev-approver
  Body: {"decision": "approve", "comment": "..."}
  Returns: {"event": {...approval event...}}
  Status: 201 Created or 403 Forbidden
```

#### 3. **Code Structure Summary**
Share for AI code understanding:
```
apps/
├── api/
│   ├── main.py → FastAPI app factory
│   ├── routers/ → 9 REST endpoints
│   ├── dependencies.py → Splunk adapter factory
│   ├── middleware/ → RBAC, rate limit, OTel
│   └── services/ → SplunkLiveService, TraceService
├── web/
│   ├── lib/api.ts → API client with timeout handling
│   ├── pages/ → Incident list, detail, approval
│   └── components/ → UI components
└── workers/
    └── job queue scaffold

packages/
├── agent-core/ → LangGraph orchestration
├── decision-tracing/ → Immutable trace store
├── connectors/splunk-mcp/ → Splunk adapter
└── shared/auth/ → RBAC middleware
```

#### 4. **Test Evidence**
Share for AI verification:
```
UNIT TESTS: 42/42 passing ✅
- test_rbac.py (6 tests)
- test_rate_limit.py (5 tests)
- test_splunk_live.py (8 tests)
- test_auth.py (3 tests)
- [+ 5 more test files]

E2E TESTS: 8/8 passing ✅
- incident-list.spec.ts
- incident-detail.spec.ts
- approval-flow.spec.ts
- auth.spec.ts
- error-handling.spec.ts

LOAD TEST: 1,319 requests ✅
- 10 concurrent users
- 5 minute duration
- 4.41 req/s throughput
- p95 latency: 1.1s
- Zero crashes
```

#### 5. **Decision Tree for AI Understanding**

Share this logic flow:
```
USER REQUESTS INCIDENT LIST
  ↓
API RECEIVES REQUEST
  ├─ Check x-api-key header
  ├─ Lookup role in dev keys
  ├─ Check if role ≥ analyst (hierarchy)
  │  ├─ If not → 403 Forbidden
  │  └─ If yes → Continue
  ├─ Check rate limit (100 req/min)
  │  ├─ If exceeded → 429 Too Many Requests
  │  └─ If OK → Continue
  ├─ Query Splunk via SSH tunnel
  │  ├─ Parse incident JSON
  │  ├─ Normalize fields
  │  └─ Return 50 incidents
  └─ Send to client

CLIENT CLICKS INCIDENT
  ↓
REQUEST DECISION TRACE
  ├─ Validate user role (analyst+)
  ├─ Query trace store
  ├─ If not found → Try Splunk live
  ├─ Reconstruct 7-step timeline
  └─ Return with confidence score

USER SUBMITS APPROVAL
  ↓
API RECEIVES APPROVAL
  ├─ Validate role (approver+)
  ├─ Validate workflow exists
  ├─ Append event to trace (immutable)
  ├─ Hash new trace (SHA-256)
  ├─ Store in PostgreSQL
  └─ Return 201 Created
```

---

## Google Meet Demo Checklist

### 30 minutes before
- [ ] Google Meet room created, link shared
- [ ] Audio/video tested
- [ ] System verification done (tunnel, docker, API)
- [ ] Browser tabs open (incidents, API, docs)
- [ ] Notifications muted
- [ ] Documentation files ready to share

### 5 minutes before
- [ ] Share screen (show your face + system)
- [ ] Google Meet chat visible (for sharing links)
- [ ] Incident list loaded and ready
- [ ] Terminal open with curl commands
- [ ] Smile and take a breath 😊

### During demo
- [ ] Speak clearly (camera adds 1-2 sec latency)
- [ ] Pause for 3 seconds on each screen (let them read)
- [ ] Click deliberately (no typing errors)
- [ ] Make eye contact (look at camera)
- [ ] Say: "Any questions so far?" between segments

### After demo
- [ ] Ask for questions (silence is OK, wait 5 sec)
- [ ] Share follow-up docs in chat
- [ ] Send follow-up email with all links
- [ ] Thank everyone for attending

---

## Demo Timing Breakdown

```
[0:00-1:00]   Introduction + context
[1:00-3:00]   Incident list walkthrough
[3:00-7:00]   Decision trace + reasoning
[7:00-9:00]   Evidence links + Splunk
[9:00-12:00]  Approval gate demo
[12:00-14:00] Backend architecture (Docker)
[14:00-17:00] Load test results
[17:00-25:00] Q&A (open discussion)
```

**Timing Tip**: Go slower than you think. Internet latency adds 1-2 sec. Audience needs time to process visuals.

---

## Common Google Meet Issues & Fixes

### "I can't see the screen"
- Share full screen (not just window)
- Set zoom to 100% (too small is hard to read)
- Close other windows (reduces clutter)

### "Audio is breaking up"
- Close video (video + screen share = heavy bandwidth)
- Mute other apps (Spotify, Slack notifications)
- Use wired internet (WiFi is unstable)

### "API is slow"
- Splunk queries are normal (200-300ms)
- Show load test results to explain
- Demo is still working, just slower network

### "Can't see incident details"
- Hard refresh: Cmd+Shift+R (not just F5)
- Check browser console for errors (F12)
- Restart API: docker compose restart api

### "Meeting keeps dropping"
- Switch to wired ethernet
- Use Chrome (most stable browser)
- Reduce video quality in Meet settings
- Have backup phone number ready

---

## Pro Tips for Google Meet Demos

✅ **Do**:
- Speak slowly (add 50% more pause time)
- Use pointer/highlighter tool (Google Meet has this)
- Have second screen for notes/timer
- Wear contrasting colors (cameras wash out pastels)
- Make eye contact with camera
- Have water nearby (stay hydrated)
- Smile (makes you sound more confident)

❌ **Don't**:
- Type during demo (very boring)
- Apologize for slow loading ("It's fast normally!")
- Use dark mode for web UI (hard to see on camera)
- Have cluttered desktop background
- Shuffle papers or fidget (distracting)
- Use laser pointer (hard to see on screen share)
- Read from notes (looks unprepared)

---

## Post-Demo Follow-up

**Send within 24 hours**:

```
Subject: BitsIO AgenticOps Demo — Docs & Next Steps

Hi [Attendees],

Thank you for attending yesterday's demo of BitsIO AgenticOps Phase 8!

FULL DOCUMENTATION:
📋 Quick Start: docs/OPERATOR_HANDBOOK.md
🎬 Demo Guide: docs/DEMO_READINESS.md
🔒 Security: docs/RBAC_AUDIT.md
📈 Performance: reports/BASELINE_ANALYSIS.md
🏗️ Architecture: docs/IMPLEMENTATION_GUIDE.md
🧵 Roadmap: docs/plan/PHASE_8_HARDENING_PLAN.md

LIVE SYSTEM ACCESS:
- Web UI: http://localhost:3000/incidents (requires setup)
- API: http://localhost:8001 (REST endpoints)
- GitHub: [REPO URL]

NEXT PHASE:
- Threat modeling workshop (4-6 hours)
- GitHub Actions CI/CD (ready to activate)
- Production hardening (3-4 weeks)

QUESTIONS?
- Email: [YOUR EMAIL]
- Slack: [YOUR SLACK]
- GitHub Issues: [REPO URL/issues]

Looking forward to working with you!
```

---

## Summary

**Google Meet Demo Checklist**:
- ✅ Pre-demo setup (30 min)
- ✅ System verification
- ✅ Demo script (20-25 min)
- ✅ Q&A session (5-10 min)
- ✅ Documentation sharing
- ✅ Post-demo follow-up

**Documents to Share**:
1. PHASE_8_COMPLETE_SUMMARY.md (executive overview)
2. OPERATOR_HANDBOOK.md (quick reference)
3. DEMO_READINESS.md (detailed walkthrough)
4. RBAC_AUDIT.md (security details)
5. Load test results (performance proof)

**For AI Agents**:
- Share structured system architecture
- API endpoint documentation
- Code structure summary
- Test evidence (42/42 tests passing)
- Decision tree logic flows

**Status**: ✅ READY TO DEMO! 🚀

