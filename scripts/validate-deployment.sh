#!/bin/bash
set -e

echo "🔍 Pre-Deployment Validation..."
echo ""

CONFIG_FILE="${1:-scripts/vultr.deploy.env}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ ERROR: $CONFIG_FILE not found"
  exit 1
fi

source "$CONFIG_FILE"

# Check 1: SSH configuration
echo "[1/4] Checking SSH configuration..."
if [ -z "$SSH_PASSWORD" ] && [ -z "$SSH_KEY" ]; then
  echo "❌ FAILED: SSH_PASSWORD or SSH_KEY must be set in $CONFIG_FILE"
  exit 1
fi
echo "✓ SSH credentials configured"

# Check 2: SSH connectivity
echo "[2/4] Testing SSH connection to $SSH_HOST..."
if [ -n "$SSH_PASSWORD" ]; then
  if ! sshpass -p "$SSH_PASSWORD" ssh -p "$SSH_PORT" -o ConnectTimeout=10 "$SSH_USER@$SSH_HOST" "echo test" > /dev/null 2>&1; then
    echo "❌ FAILED: Cannot connect to $SSH_HOST with provided credentials"
    exit 1
  fi
else
  if ! ssh -i "$SSH_KEY" -p "$SSH_PORT" -o ConnectTimeout=10 "$SSH_USER@$SSH_HOST" "echo test" > /dev/null 2>&1; then
    echo "❌ FAILED: Cannot connect to $SSH_HOST with SSH key"
    exit 1
  fi
fi
echo "✓ SSH connection successful"

# Check 3: Git repository
echo "[3/4] Checking git repository..."
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ FAILED: Not in a git repository"
  exit 1
fi
echo "✓ Git repository found"

# Check 4: Deploy script exists
echo "[4/4] Checking deploy script..."
if [ ! -f "scripts/deploy_vultr_e2e.sh" ]; then
  echo "❌ FAILED: scripts/deploy_vultr_e2e.sh not found"
  exit 1
fi
echo "✓ Deploy script found"

echo ""
echo "✅ All validations passed!"
echo "Ready to deploy to $SSH_HOST"
