#!/bin/bash
set -e

BRANCH="${1:-main}"

echo "📤 Pushing changes to remote repo..."
echo ""

cd "$(dirname "$0")/.."

echo "   Branch: lovark/develop"
git push origin lovark/develop

echo "   Branch: dev"
git push origin dev

echo "   Branch: $BRANCH"
git push origin $BRANCH

echo ""
echo "🚀 Deploying to production (144.202.48.85)..."
echo ""

if [ ! -f "scripts/vultr.deploy.env" ]; then
  echo "❌ ERROR: scripts/vultr.deploy.env not found"
  exit 1
fi

source scripts/vultr.deploy.env
bash scripts/deploy_vultr_e2e.sh scripts/vultr.deploy.env

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Production URLs:"
echo "   Web UI:  http://144.202.48.85:3000"
echo "   API:     http://144.202.48.85:8001"
echo ""
echo "✨ Feature: [🔄 Refresh Data] button is now live!"
