#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   cp scripts/vultr.deploy.env.example scripts/vultr.deploy.env
#   # edit scripts/vultr.deploy.env with secrets and server values
#   bash scripts/deploy_vultr_e2e.sh scripts/vultr.deploy.env

ENV_FILE="${1:-scripts/vultr.deploy.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[ERROR] Env file not found: $ENV_FILE"
  echo "Create it from: scripts/vultr.deploy.env.example"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

required_vars=(
  REPO_DIR REPO_REMOTE_NAME REPO_REMOTE_URL GIT_BRANCH PUSH_LOCAL_CHANGES
  SSH_HOST SSH_PORT SSH_USER
  REMOTE_APP_DIR APP_PORT_WEB APP_PORT_API
  NEXT_PUBLIC_API_BASE_URL INTERNAL_API_BASE_URL
  SPLUNK_MCP_BASE_URL SPLUNK_MCP_TOKEN
)
for v in "${required_vars[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "[ERROR] Missing required variable: $v"
    exit 1
  fi
done

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "[ERROR] REPO_DIR does not look like a git repo: $REPO_DIR"
  exit 1
fi

if [[ "${PUSH_LOCAL_CHANGES}" != "true" && "${PUSH_LOCAL_CHANGES}" != "false" ]]; then
  echo "[ERROR] PUSH_LOCAL_CHANGES must be true|false"
  exit 1
fi

if [[ -n "${SSH_PASSWORD:-}" ]] && ! command -v sshpass >/dev/null 2>&1; then
  echo "[ERROR] SSH_PASSWORD is set but sshpass is not installed."
  echo "Install: brew install hudochenkov/sshpass/sshpass"
  exit 1
fi

ssh_opts=(-p "$SSH_PORT" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30)
if [[ -n "${SSH_PASSWORD:-}" ]]; then
  SSH_CMD=(sshpass -p "$SSH_PASSWORD" ssh "${ssh_opts[@]}")
  SCP_CMD=(sshpass -p "$SSH_PASSWORD" scp -P "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
else
  SSH_CMD=(ssh "${ssh_opts[@]}")
  SCP_CMD=(scp -P "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
fi

REMOTE="${SSH_USER}@${SSH_HOST}"

echo "[1/8] Preparing local git state..."
cd "$REPO_DIR"

if ! git remote get-url "$REPO_REMOTE_NAME" >/dev/null 2>&1; then
  git remote add "$REPO_REMOTE_NAME" "$REPO_REMOTE_URL"
else
  git remote set-url "$REPO_REMOTE_NAME" "$REPO_REMOTE_URL"
fi

if [[ "$PUSH_LOCAL_CHANGES" == "true" ]]; then
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "[INFO] Local working tree has uncommitted changes."
    echo "[ERROR] Commit or stash first, then rerun."
    git status --short
    exit 1
  fi
  echo "[INFO] Pushing ${GIT_BRANCH} to ${REPO_REMOTE_NAME}..."
  git push -u "$REPO_REMOTE_NAME" "$GIT_BRANCH"
else
  echo "[INFO] Skipping git push (PUSH_LOCAL_CHANGES=false)."
fi

echo "[2/8] Building remote .env payload..."
TMP_ENV="$(mktemp)"
cat > "$TMP_ENV" <<ENVEOF
ENVIRONMENT=${ENVIRONMENT:-production}
LOG_LEVEL=${LOG_LEVEL:-INFO}
HOST=0.0.0.0
PORT=${APP_PORT_API}

# Web/API routing
NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
INTERNAL_API_BASE_URL=${INTERNAL_API_BASE_URL}

# Splunk
SPLUNK_MCP_BASE_URL=${SPLUNK_MCP_BASE_URL}
SPLUNK_MCP_TOKEN=${SPLUNK_MCP_TOKEN}

# Model
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
MODEL_PROVIDER=${MODEL_PROVIDER:-ollama}
MODEL_NAME=${MODEL_NAME:-qwen2.5:7b}
OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-http://host.containers.internal:11434}
MODEL_MOCK_MODE=${MODEL_MOCK_MODE:-false}

# Runtime
SPLUNK_ADAPTER_MODE=${SPLUNK_ADAPTER_MODE:-native}
SPLUNK_LIVE_MODE=${SPLUNK_LIVE_MODE:-true}

# Compose defaults
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_REQUIRE_LIVE_API=true
ENVEOF

TMP_ENV_B64="$(base64 < "$TMP_ENV" | tr -d '\n')"
rm -f "$TMP_ENV"

echo "[3/8] Connecting server and installing dependencies..."
"${SSH_CMD[@]}" "$REMOTE" "bash -s" <<REMOTE_BOOTSTRAP
set -euo pipefail

if command -v apt >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt update
  apt -y install git curl ca-certificates ufw
elif command -v dnf >/dev/null 2>&1; then
  dnf -y install git curl ca-certificates
else
  echo "Unsupported OS package manager" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable docker
systemctl start docker

if [[ "${MODEL_PROVIDER:-}" == "ollama" ]]; then
  if ! command -v ollama >/dev/null 2>&1; then
    curl -fsSL https://ollama.com/install.sh | sh
  fi
  systemctl enable ollama || true
  systemctl restart ollama || true
fi
REMOTE_BOOTSTRAP

echo "[4/8] Syncing repo on server..."
"${SSH_CMD[@]}" "$REMOTE" "bash -s" <<REMOTE_GIT
set -euo pipefail
mkdir -p "$(dirname "$REMOTE_APP_DIR")"
if [[ -d "$REMOTE_APP_DIR/.git" ]]; then
  cd "$REMOTE_APP_DIR"
  git fetch --all --prune
  git checkout "$GIT_BRANCH"
  git reset --hard "${REPO_REMOTE_NAME}/${GIT_BRANCH}" || git reset --hard "origin/${GIT_BRANCH}" || true
  git pull --ff-only || true
else
  git clone "$REPO_REMOTE_URL" "$REMOTE_APP_DIR"
  cd "$REMOTE_APP_DIR"
  git checkout "$GIT_BRANCH" || true
fi
REMOTE_GIT

echo "[5/8] Writing .env and compose override..."
"${SSH_CMD[@]}" "$REMOTE" "bash -s" <<REMOTE_ENV
set -euo pipefail
cd "$REMOTE_APP_DIR"

printf '%s' "$TMP_ENV_B64" | base64 --decode > .env

cat > docker-compose.override.yml <<OVERRIDE
services:
  web:
    environment:
      NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL}
      INTERNAL_API_BASE_URL: ${INTERNAL_API_BASE_URL}
    ports:
      - "${APP_PORT_WEB}:3000"
  api:
    ports:
      - "${APP_PORT_API}:8001"
OVERRIDE
REMOTE_ENV

echo "[6/8] Starting application stack..."
"${SSH_CMD[@]}" "$REMOTE" "bash -s" <<REMOTE_UP
set -euo pipefail
cd "$REMOTE_APP_DIR"
if [[ "${MODEL_PROVIDER:-}" == "ollama" ]]; then
  ollama pull "${MODEL_NAME}" || true
fi
docker compose down || true
docker compose up -d --build
REMOTE_UP

echo "[7/8] Optional reverse proxy setup..."
if [[ "${ENABLE_CADDY}" == "true" && -n "${DOMAIN}" ]]; then
  "${SSH_CMD[@]}" "$REMOTE" "bash -s" <<REMOTE_CADDY
set -euo pipefail
if command -v apt >/dev/null 2>&1; then
  apt -y install debian-keyring debian-archive-keyring apt-transport-https gnupg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/deb/debian.any-version.list' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt update
  apt -y install caddy
  cat > /etc/caddy/Caddyfile <<CADDY
${DOMAIN} {
  encode gzip
  handle /api/* {
    reverse_proxy 127.0.0.1:${APP_PORT_API}
  }
  handle {
    reverse_proxy 127.0.0.1:${APP_PORT_WEB}
  }
}
CADDY
  systemctl enable caddy
  systemctl restart caddy
fi
REMOTE_CADDY
else
  echo "[INFO] Skipping Caddy (ENABLE_CADDY=false or DOMAIN empty)."
fi

echo "[8/8] Health checks..."
"${SSH_CMD[@]}" "$REMOTE" "bash -s" <<REMOTE_CHECK
set -euo pipefail
cd "$REMOTE_APP_DIR"
docker compose ps

for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:${APP_PORT_API}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

curl -fsS "http://127.0.0.1:${APP_PORT_API}/health"
curl -I -fsS "http://127.0.0.1:${APP_PORT_WEB}" | head -n 1
REMOTE_CHECK

echo ""
echo "✅ Deployment complete"
if [[ "${ENABLE_CADDY}" == "true" && -n "${DOMAIN}" ]]; then
  echo "App URL: https://${DOMAIN}"
  echo "API URL: https://${DOMAIN}/api"
else
  echo "App URL: http://${SSH_HOST}:${APP_PORT_WEB}"
  echo "API URL: http://${SSH_HOST}:${APP_PORT_API}"
fi

echo ""
echo "Useful remote commands:"
echo "  ssh ${REMOTE}"
echo "  cd ${REMOTE_APP_DIR}"
echo "  docker compose ps"
echo "  docker compose logs -f --tail=200"
