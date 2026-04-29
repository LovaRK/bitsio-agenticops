# Deployment Guide

**Version:** 2026-04-29  
**Status:** Production-Ready  

---

## Quick Start

### Local Development (Port 3000)
```bash
bash scripts/run-local.sh
# Opens http://localhost:3000
```

### Production Deployment (Safe)
```bash
bash scripts/deploy-safe.sh main
# Validates → Deploys → Verifies
# Result: http://144.202.48.85:3000
```

---

## Setup (One-Time)

### Step 1: Add SSH Password to `.env`

**File:** `scripts/vultr.deploy.env`

```bash
nano scripts/vultr.deploy.env
```

**Find line 13:**
```
SSH_PASSWORD=""
```

**Change to:**
```
SSH_PASSWORD="[YOUR_VULTR_ROOT_PASSWORD]"
```

**⚠️ IMPORTANT:** Keep this file PRIVATE. Do NOT commit to git.

### Step 2: Verify Connection

```bash
bash scripts/validate-deployment.sh
```

**Expected output:**
```
✓ SSH credentials configured
✓ SSH connection successful
✓ Git repository found
✓ Deploy script found
✅ All validations passed!
```

---

## Deployment Workflow

### Git Flow

```
Your Feature Branch (datasensAI)
  ↓ (commit & push)
lovark fork (GitHub)
  ↓ (create PR)
Main repo develop branch
  ↓ (merge & push)
Main repo main branch
  ↓ (deploy script pulls)
Production Server (144.202.48.85)
```

### Complete Deployment Sequence

```bash
# 1. Make changes locally
git add apps/web/components/telemetry/FilterBar.tsx
git commit -m "feat: add refresh button"

# 2. Push to your branch
git push origin datasensAI

# 3. Deploy to production (pulls from lovark/develop)
bash scripts/deploy-safe.sh main
```

---

## Scripts Reference

### `run-local.sh` — Local Development
```bash
bash scripts/run-local.sh
```
- Starts Ollama (port 11434)
- Starts API (port 8001)
- Starts Web UI (port 3000)
- No Splunk required
- Fast feedback loop

### `validate-deployment.sh` — Pre-Deployment Check
```bash
bash scripts/validate-deployment.sh
```
- ✓ Checks SSH password/key configured
- ✓ Tests SSH connection
- ✓ Verifies git repo exists
- ✓ Verifies deploy script exists

**Run this BEFORE every deployment.**

### `deploy-safe.sh` — Safe Production Deployment
```bash
bash scripts/deploy-safe.sh main
```
- Step 1: Runs validation
- Step 2: Executes deployment
- Step 3: Verifies servers are running

**Use this instead of `deploy_vultr_e2e.sh` directly.**

### `check-status.sh` — Production Health Check
```bash
bash scripts/check-status.sh
```
- Returns API health status
- Lists production URLs
- Can be run anytime

---

## Troubleshooting

### Error: "SSH password empty"
```
❌ FAILED: SSH_PASSWORD or SSH_KEY must be set
```
**Fix:** Add password to `scripts/vultr.deploy.env` line 13

### Error: "Permission denied (publickey)"
```
❌ FAILED: Cannot connect to 144.202.48.85
```
**Fix:** SSH password is incorrect in `vultr.deploy.env`

### Error: "This site can't be reached" after deployment
```
ERR_CONNECTION_TIMED_OUT
```
**Causes:**
- SSH authentication failed (deployment didn't actually run)
- Containers still starting (wait 2-3 more minutes)
- Network connectivity issue

**Fix:**
```bash
# Check if deployment actually worked
bash scripts/validate-deployment.sh

# If OK, wait 2-3 minutes then:
bash scripts/check-status.sh

# If containers not running:
bash scripts/deploy-safe.sh main
```

---

## Environment Variables

All configured in `scripts/vultr.deploy.env`:

| Variable | Value | Purpose |
|----------|-------|---------|
| `SSH_HOST` | 144.202.48.85 | Production server IP |
| `SSH_PORT` | 22 | SSH port |
| `SSH_USER` | root | SSH username |
| `SSH_PASSWORD` | [REQUIRED] | SSH authentication |
| `REMOTE_APP_DIR` | /opt/bitsio/bitsio-agenticops | Server app path |
| `APP_PORT_WEB` | 3000 | Web UI port |
| `APP_PORT_API` | 8001 | API port |
| `SPLUNK_LIVE_MODE` | true | Always live data |
| `MODEL_PROVIDER` | ollama | Local-first LLM |

---

## Key Conventions

1. **Always validate before deploying:**
   ```bash
   bash scripts/validate-deployment.sh
   ```

2. **Always use safe deploy script:**
   ```bash
   bash scripts/deploy-safe.sh main  # NOT deploy_vultr_e2e.sh
   ```

3. **Check status after deployment:**
   ```bash
   bash scripts/check-status.sh
   ```

4. **Test locally first:**
   ```bash
   bash scripts/run-local.sh
   # Verify changes work locally before pushing
   ```

5. **Never commit `vultr.deploy.env`:**
   ```bash
   git check-ignore scripts/vultr.deploy.env  # Should return true
   ```

---

## Production URLs

| Component | URL | Purpose |
|-----------|-----|---------|
| Web UI | http://144.202.48.85:3000 | Main dashboard |
| API | http://144.202.48.85:8001 | REST API |
| Telemetry | http://144.202.48.85:3000/telemetry-value | Telemetry dashboard |
| Health | http://144.202.48.85:8001/health | Server health |

---

## Deployment Timeline

| Step | Time | Action |
|------|------|--------|
| 1 | 30 sec | Validation (SSH check) |
| 2 | 2-3 min | Code deploy + containers rebuild |
| 3 | 30 sec | Health check verification |
| **Total** | **4-5 min** | Complete deployment |

**Note:** First deployment takes longer (container builds), subsequent updates are faster.

---

## Support

**If deployment fails:**
1. Run validation: `bash scripts/validate-deployment.sh`
2. Check SSH password in `vultr.deploy.env`
3. Try again: `bash scripts/deploy-safe.sh main`
4. Check status: `bash scripts/check-status.sh`

**Expected output of healthy deployment:**
```
✅ API server is responding
✅ DEPLOYMENT SUCCESSFUL!

PRODUCTION URLS:
🌐 Web UI:      http://144.202.48.85:3000
📡 API:         http://144.202.48.85:8001
📊 Telemetry:   http://144.202.48.85:3000/telemetry-value
```
