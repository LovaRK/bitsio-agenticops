# Quick Start Guide

**Goal:** Get the app running in 5 minutes.

---

## Option A: Local Development (Fastest)

```bash
bash scripts/run-local.sh
```

**Opens:** http://localhost:3000  
**Includes:** Ollama (local LLM), FastAPI, Next.js  
**Time:** ~2 minutes  

### Then:
1. Navigate to http://localhost:3000/telemetry-value
2. Click **[🔄 Refresh Data]** button
3. Wait 5-10 seconds for live Splunk data to load

---

## Option B: Production (144.202.48.85)

### 1. Setup SSH Password (One-Time)

```bash
nano scripts/vultr.deploy.env
```

Find:
```
SSH_PASSWORD=""
```

Change to:
```
SSH_PASSWORD="[YOUR_VULTR_PASSWORD]"
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

### 2. Validate

```bash
bash scripts/validate-deployment.sh
```

Should show:
```
✓ SSH credentials configured
✓ SSH connection successful
✓ Git repository found
✓ Deploy script found
✅ All validations passed!
```

### 3. Deploy

```bash
bash scripts/deploy-safe.sh main
```

**Output:**
```
[1/3] STEP 1: PRE-DEPLOYMENT VALIDATION ✓
[2/3] STEP 2: DEPLOYING TO PRODUCTION ✓
[3/3] STEP 3: POST-DEPLOYMENT VERIFICATION ✓

✅ DEPLOYMENT SUCCESSFUL!

🌐 Web UI:      http://144.202.48.85:3000
📡 API:         http://144.202.48.85:8001
📊 Telemetry:   http://144.202.48.85:3000/telemetry-value
```

### 4. Open in Browser

```
http://144.202.48.85:3000/telemetry-value
```

Click **[🔄 Refresh Data]** → See live Splunk data

---

## Common Tasks

### Check Server Health
```bash
bash scripts/check-status.sh
```

### View Logs (Production)
```bash
source scripts/vultr.deploy.env
sshpass -p "$SSH_PASSWORD" ssh root@144.202.48.85 \
  "podman logs -f bitsio-agenticops_api_1"
```

### Stop Local Services
```bash
Ctrl+C  (in each terminal)
# or
make down
```

### Fresh Start (Local)
```bash
make down
bash scripts/run-local.sh
```

---

## What You'll See

### Telemetry Value Page
- **Top:** Filter bar with cost/GB, weights, [🔄 Refresh Data] button
- **Left:** KPI cards (ROI Score, GainScope, Daily Volume)
- **Center:** Charts showing data value split, tier distribution
- **Bottom:** Quick wins, security gaps, full scoring table

### [🔄 Refresh Data] Button
- **Normal:** Blue button in top-right of filter bar
- **Clicking:** Shows "⟳ Refreshing…" with spinner
- **Result:** Dashboard updates with latest Splunk data + timestamp

### Live Data Badge
- Shows: "🔴 Live Splunk data"
- Plus: "Fetched: 2026-04-29 20:52:45 UTC"
- Plus: "Latency: 1234ms"
- Plus: "Confidence: 95%"

---

## Troubleshooting

### "Port 3000 already in use"
```bash
# Find what's using port 3000
lsof -i :3000

# Kill it (if not needed)
kill -9 <PID>

# Then restart
bash scripts/run-local.sh
```

### "This site can't be reached"
```bash
# Check if deployment actually ran
bash scripts/validate-deployment.sh

# If failed, re-deploy
bash scripts/deploy-safe.sh main

# Wait 2-3 minutes, then check
bash scripts/check-status.sh
```

### "Splunk connection failed"
```bash
# Check SSH tunnel is active
make tunnel-status

# If not, start it
make tunnel-start

# Then retry refresh button
```

### "[🔄 Refresh Data] button not working"
```bash
# Check API is running
curl http://localhost:8001/health  # local
curl http://144.202.48.85:8001/health  # production

# Check browser console for errors
# (DevTools → Console tab)
```

---

## URLs

| Environment | URL |
|-------------|-----|
| Local Web | http://localhost:3000 |
| Local API | http://localhost:8001 |
| Local Ollama | http://localhost:11434 |
| Production Web | http://144.202.48.85:3000 |
| Production API | http://144.202.48.85:8001 |
| Production Telemetry | http://144.202.48.85:3000/telemetry-value |

---

## Files Reference

| File | Purpose |
|------|---------|
| `scripts/run-local.sh` | Start local development |
| `scripts/deploy-safe.sh` | Deploy to production |
| `scripts/validate-deployment.sh` | Check SSH before deploy |
| `scripts/check-status.sh` | Verify production is running |
| `scripts/vultr.deploy.env` | Production credentials (KEEP PRIVATE) |
| `docs/DEPLOYMENT_GUIDE.md` | Full deployment guide |
| `docs/PROJECT_STATUS.md` | Project status & features |

---

## Support

**For issues:**
1. Check troubleshooting section above
2. Read `docs/DEPLOYMENT_GUIDE.md`
3. Read `docs/LIVE_SPLUNK_ONLY.md` (data flow)
4. Check `docs/PROJECT_STATUS.md` (feature matrix)

**For questions:**
- Check `README.md` (main overview)
- Check `docs/` folder (architecture docs)
- Search codebase: `graphify query "your question"`

---

**Ready?** Start with Option A (local) to test immediately, then Option B (production) when ready.
