#!/bin/bash
set -e

BRANCH="${1:-main}"
CONFIG_FILE="${2:-scripts/vultr.deploy.env}"

echo "🚀 SAFE DEPLOYMENT WITH VALIDATION"
echo ""

# Step 1: Validate
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: PRE-DEPLOYMENT VALIDATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash scripts/validate-deployment.sh "$CONFIG_FILE"

# Step 2: Deploy
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: DEPLOYING TO PRODUCTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
source "$CONFIG_FILE"
bash scripts/deploy_vultr_e2e.sh "$CONFIG_FILE"

# Step 3: Post-deployment verification
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: POST-DEPLOYMENT VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Waiting for services to start (60 sec timeout)..."
MAX_ATTEMPTS=30
ATTEMPT=0
HEALTH_OK=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if curl -s -m 5 "http://$SSH_HOST:$APP_PORT_API/health" > /dev/null 2>&1; then
    echo "✓ API server is responding"
    HEALTH_OK=true
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  echo "  [Attempt $ATTEMPT/$MAX_ATTEMPTS] Waiting for API server..."
  sleep 2
done

if [ "$HEALTH_OK" = false ]; then
  echo ""
  echo "⚠️  WARNING: API server not responding after 60 seconds"
  echo "   This may be normal if services are still starting"
  echo "   Check manually in 2-3 minutes:"
  echo "   curl http://$SSH_HOST:$APP_PORT_API/health"
else
  echo ""
  echo "✅ DEPLOYMENT SUCCESSFUL!"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PRODUCTION URLS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Web UI:      http://$SSH_HOST:$APP_PORT_WEB"
echo "📡 API:         http://$SSH_HOST:$APP_PORT_API"
echo "📊 Telemetry:   http://$SSH_HOST:$APP_PORT_WEB/telemetry-value"
echo ""
