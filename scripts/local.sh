#!/bin/bash
# Local development runner: Ollama + API (8001) + Web (3000)
# All with local-first defaults (no cloud LLM, deterministic seed fallback)

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${REPO_ROOT}/.logs"
mkdir -p "$LOG_DIR"

echo "🚀 BitsIO AgenticOps Local Dev Server"
echo "=========================================="
echo ""

# Check Ollama
echo "📚 Checking Ollama (localhost:11434)..."
if ! lsof -nP -iTCP:11434 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "  ⚠️  Ollama not running. Starting..."
  ollama serve > "$LOG_DIR/ollama.log" 2>&1 &
  sleep 3
  if lsof -nP -iTCP:11434 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  ✅ Ollama started (PID $!)"
  else
    echo "  ❌ Failed to start Ollama. Check $LOG_DIR/ollama.log"
    exit 1
  fi
else
  echo "  ✅ Ollama already running"
fi

# Kill any existing API/Web processes
echo "🧹 Cleaning up old processes..."
pkill -f "uvicorn.*apps.api.app.main" 2>/dev/null || true
pkill -f "pnpm --filter web dev" 2>/dev/null || true
lsof -ti tcp:8001 | xargs kill -9 2>/dev/null || true
lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true
sleep 1

# Load .env
if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  source "$REPO_ROOT/.env"
  set +a
fi

# Force local-first defaults
export MODEL_PROVIDER="ollama"
export SPLUNK_LIVE_MODE="${SPLUNK_LIVE_MODE:-false}"
export SPLUNK_ADAPTER_MODE="native"
export SPLUNK_MCP_BASE_URL="https://localhost:8089"
export SPLUNK_MCP_SSL_VERIFY="false"
export WEB_BASE_URL="http://127.0.0.1:3000"
export ENVIRONMENT="${ENVIRONMENT:-local}"

echo ""
echo "⚙️  Configuration:"
echo "  • Model Provider: $MODEL_PROVIDER (local Ollama)"
echo "  • Splunk Live Mode: $SPLUNK_LIVE_MODE"
echo "  • API: http://127.0.0.1:8001"
echo "  • Web: http://127.0.0.1:3000"
echo ""

# Start API backend
echo "🔧 Starting API (port 8001)..."
cd "$REPO_ROOT"
nohup uv run python scripts/run_live_api.py > "$LOG_DIR/api.log" 2>&1 &
API_PID=$!
echo "  → PID $API_PID (logs: $LOG_DIR/api.log)"

# Wait for API to be ready
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if curl -fsS http://127.0.0.1:8001/health >/dev/null 2>&1; then
    echo "  ✅ API healthy"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  sleep 1
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo "  ❌ API failed to start. Check $LOG_DIR/api.log"
  kill $API_PID 2>/dev/null || true
  exit 1
fi

# Start Web frontend
echo "🎨 Starting Web (port 3000)..."
export NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:8001"
export INTERNAL_API_BASE_URL="http://127.0.0.1:8001"
export NEXT_PUBLIC_USE_MOCK="false"
export NEXT_PUBLIC_REQUIRE_LIVE_API="true"

nohup pnpm --filter web dev --hostname 127.0.0.1 --port 3000 > "$LOG_DIR/web.log" 2>&1 &
WEB_PID=$!
echo "  → PID $WEB_PID (logs: $LOG_DIR/web.log)"

sleep 2

echo ""
echo "✨ Local development server running!"
echo "   🌐 Open http://127.0.0.1:3000"
echo ""
echo "📋 Process summary:"
echo "   Ollama  (11434): $(lsof -ti tcp:11434 2>/dev/null || echo 'not running')"
echo "   API     (8001):  $(lsof -ti tcp:8001 2>/dev/null || echo 'not running')"
echo "   Web     (3000):  $(lsof -ti tcp:3000 2>/dev/null || echo 'not running')"
echo ""
echo "📜 Logs:"
echo "   tail -f $LOG_DIR/api.log"
echo "   tail -f $LOG_DIR/web.log"
echo "   tail -f $LOG_DIR/ollama.log"
echo ""
echo "🛑 To stop: pkill -P $$ or close this terminal"
echo ""

# Keep script alive
wait $API_PID $WEB_PID 2>/dev/null || true
