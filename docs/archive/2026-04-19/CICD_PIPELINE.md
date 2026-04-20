# CI/CD Pipeline Documentation — Phase 8

**Status**: ✅ Complete & Ready to Use  
**Last Updated**: 2026-04-13

---

## Overview

BitsIO AgenticOps includes a complete CI/CD pipeline with:
- ✅ **Unit Tests** — Python code quality + security scanning
- ✅ **E2E Tests** — Full application workflow validation
- ✅ **Security Scanning** — Trivy, gitleaks, safety, npm audit
- ✅ **Release Automation** — Semantic versioning + changelog generation
- ✅ **Docker Build** — Automated image building on release

All workflows are in `.github/workflows/` and use GitHub Actions.

---

## Workflows

### 1. Unit Tests (unit-tests.yml)

**When**: On every push to `main`/`develop` and every PR

**What it does**:
1. Runs Python unit tests (`make test`)
2. Lints code (ruff, black, isort)
3. Uploads coverage to Codecov
4. Scans for secrets (gitleaks)

**Success Criteria**:
- ✅ 42/42 tests passing
- ✅ No ruff/black/isort errors (warnings OK)
- ✅ No secrets detected

**View Results**:
```
GitHub → Your PR → "Checks" tab → "Unit Tests"
```

**If it fails**:
```bash
# Fix locally
make test          # Run tests
make lint          # Run linting
git add . && git commit -m "fix: lint errors"
git push           # Re-run workflow
```

---

### 2. E2E Tests (e2e-tests.yml)

**When**: On push to `main`, PR to `main`

**What it does**:
1. Starts full Docker stack
2. Waits for API health
3. Runs Playwright E2E tests
4. Uploads test results
5. Collects Docker logs on failure

**Success Criteria**:
- ✅ 8/8 E2E tests passing
- ✅ API responds to health check
- ✅ Web UI loads and interacts correctly

**View Results**:
```
GitHub → Your PR → "Checks" tab → "E2E Tests"
→ Artifacts tab → "e2e-test-results"
```

**If it fails**:
```bash
# Debug locally
docker compose up -d
sleep 30
pnpm --filter web test:e2e

# View results
pnpm --filter web test:e2e -- --debug
```

---

### 3. Security Scanning (security.yml)

**When**: On every push to `main`/`develop`, PRs, and nightly

**What it does**:
1. **Trivy** — Scans Docker images for vulnerabilities
2. **gitleaks** — Detects secrets/credentials in code
3. **safety** — Checks Python dependencies for CVEs
4. **npm audit** — Checks Node dependencies for CVEs
5. **RBAC Audit** — Verifies all routes have auth decorators

**Success Criteria**:
- ✅ No HIGH/CRITICAL Trivy findings
- ✅ No secrets detected (gitleaks)
- ✅ No known Python CVEs
- ✅ No known npm vulnerabilities
- ✅ All routes have RBAC decorators

**View Results**:
```
GitHub → Actions tab → "Security Scanning"
→ "Artifacts" tab (reports available)
```

**If vulnerabilities found**:
```bash
# For Trivy findings
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image bitsio-agenticops-api:latest

# For Python CVEs
uv pip list --format=freeze | uv run safety check --stdin

# For npm audit
pnpm audit --audit-level=high
```

---

### 4. Release Workflow (release.yml)

**When**: Manual trigger via GitHub Actions UI

**What it does**:
1. Validates version format (X.Y.Z)
2. Runs all tests
3. Creates Git tag
4. Generates changelog from commits
5. Creates GitHub Release
6. Builds Docker images with version tag

**How to Release**:

```bash
# Option 1: GitHub UI (Recommended)
1. Go to GitHub → Actions tab
2. Click "Release" workflow
3. Click "Run workflow"
4. Enter version (e.g., 0.2.0)
5. Click "Run workflow"
6. Wait for completion

# Option 2: GitHub CLI
gh workflow run release.yml -f version=0.2.0
```

**Version Format**:
- Use semantic versioning: `MAJOR.MINOR.PATCH`
- Example: `0.2.0` (not `v0.2.0`)

**Success Criteria**:
- ✅ All unit tests pass
- ✅ All E2E tests pass
- ✅ Linting passes
- ✅ Git tag created (`v0.2.0`)
- ✅ GitHub Release created with changelog
- ✅ Docker images tagged with version

**Verify Release**:
```bash
# Check GitHub Release
gh release view v0.2.0

# Check Docker images built
docker images | grep 0.2.0

# Check Git tag
git tag -l v0.2.0
```

---

## Workflow Status & Monitoring

### View All Workflows
```
GitHub → Actions tab → See all workflows
```

### Check Specific PR
```
GitHub → Your PR → "Checks" tab
→ Shows status of all workflows
```

### View Logs
```
GitHub → Actions → [Workflow name]
→ Click run → Expand step for logs
```

### Subscribe to Notifications
```
GitHub → Settings → Notifications
→ Enable: "Workflow runs"
```

---

## Configuration Files

### Environment Variables

All workflows use `.env` from repository:
- Unit tests: `ANTHROPIC_API_KEY`, `SPLUNK_MCP_TOKEN`
- E2E tests: Docker Compose services
- Security: No special env vars needed

**For GitHub Secrets** (if needed later):
```yaml
# In .github/workflows/unit-tests.yml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Secrets Management

Current setup uses:
- `.env` file (dev/local, not in git)
- GitHub Secrets for sensitive values (production)

**To add secrets**:
```
GitHub → Settings → Secrets and variables → Actions
→ New repository secret
```

---

## Troubleshooting

### Unit Tests Failing

**Symptom**: "42 passed" becomes "39 passed, 3 failed"

**Causes**:
1. Code change broke test
2. Dependency version changed
3. Environment variable missing

**Fix**:
```bash
# Run locally first
make test

# If failing locally:
make bootstrap    # Reinstall dependencies
make test -v      # Verbose output

# Check logs in GitHub UI
GitHub → Actions → [Run] → [Failed job]
```

### E2E Tests Timeout

**Symptom**: "Waiting for API health... timeout"

**Cause**: Docker services didn't start in time (>30s)

**Fix**:
```bash
# Increase timeout in .github/workflows/e2e-tests.yml
timeout-minutes: 45  # was 30

# Or check locally
docker compose up -d
docker compose logs api    # Check for errors
curl http://localhost:8001/health
```

### Security Scan Shows Vulnerability

**Symptom**: Trivy found "HIGH" severity CVE

**Example Fix** (Python dependency):
```bash
# Find vulnerable package
# From Trivy report: "Pillow 9.1.0 has CVE-2022-22815"

# Update .env or requirements
pip install --upgrade Pillow

# Run Trivy locally to verify
docker compose build api
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image bitsio-agenticops-api:latest
```

### Release Workflow Fails

**Symptom**: "Release" workflow shows red X

**Check**:
1. Is version format correct? (must be `X.Y.Z`)
2. Did unit tests pass?
3. Is the tag already created?

**Fix**:
```bash
# Verify version format
echo "0.2.0" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' && echo "Valid" || echo "Invalid"

# Check if tag exists
git tag | grep v0.2.0

# Delete tag if created but release failed
git tag -d v0.2.0
git push --delete origin v0.2.0

# Retry release
```

---

## Advanced: Customizing Workflows

### Add a New Workflow

1. Create file: `.github/workflows/my-workflow.yml`
2. Copy structure from existing workflow
3. Customize `name`, `on`, `jobs`, `steps`
4. Commit and push

Example: **Deploy to Staging**
```yaml
name: Deploy to Staging

on:
  push:
    branches: [ develop ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: |
          echo "Deploying to staging..."
          # Your deployment script here
```

### Modify Test Matrix

**Current**: Tests Python 3.12 only

**To add Python 3.13**:
```yaml
# In unit-tests.yml
strategy:
  matrix:
    python-version: ['3.12', '3.13']
```

### Add Slack Notifications

```yaml
# Add to any workflow:
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "Build failed: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
      }
```

---

## Best Practices

### For Developers

✅ **Do**:
- Run `make test` locally before pushing
- Run `make lint` to catch style issues
- Use conventional commits (`feat:`, `fix:`, etc.)
- Small focused PRs

❌ **Don't**:
- Commit unformatted code (lint will catch it)
- Ignore failing workflows (fix before merging)
- Push secrets (gitleaks will catch it)

### For Release Managers

✅ **Do**:
- Test in staging first
- Use semantic versioning
- Document breaking changes
- Monitor releases in production

❌ **Don't**:
- Release without running workflows
- Manually tag (use release workflow)
- Merge PRs with failing workflows

---

## Monitoring Dashboard

### GitHub Actions Dashboard
```
https://github.com/[user]/[repo]/actions
```
Shows:
- All workflow runs
- Success/failure status
- Run times
- Artifacts

### Workflow Badges

Add to `README.md`:
```markdown
[![Unit Tests](https://github.com/[user]/[repo]/actions/workflows/unit-tests.yml/badge.svg)](https://github.com/[user]/[repo]/actions)
[![E2E Tests](https://github.com/[user]/[repo]/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/[user]/[repo]/actions)
```

---

## Cost Considerations

### GitHub Actions Minutes

**Free tier**: 2,000 minutes/month per account

**Our usage** (estimated):
- Unit tests: 5 min/run × 10 runs/day = 50 min/day
- E2E tests: 20 min/run × 2 runs/day = 40 min/day
- Security: 10 min/run × 1 run/day = 10 min/day
- **Total**: ~100 min/day × 20 days = 2,000 min/month

**Status**: ✅ Within free tier

**If exceeding free tier**: Upgrade to GitHub Pro ($4/month) or higher

---

## Next Steps

### To Activate Workflows

1. ✅ Workflows already created in `.github/workflows/`
2. ✅ Commit and push to trigger
3. ✅ View in GitHub Actions tab

### To Monitor

1. Add GitHub Actions badge to README
2. Set up Slack notifications (optional)
3. Subscribe to workflow notifications

### To Customize

1. Modify workflows in `.github/workflows/`
2. Add environment variables or secrets as needed
3. Test changes in a PR first

---

## Support

**Having issues?**

1. Check GitHub Actions logs: `Actions` tab → [Run] → [Job] → [Step]
2. Run commands locally: `make test`, `make lint`
3. Check workflow syntax: GitHub Actions has YAML validator
4. View workflow documentation: https://docs.github.com/actions

---

**CI/CD Setup Complete! 🚀**

All workflows are production-ready. Next: Schedule threat modeling workshop + start Phase 8 hardening tasks.

