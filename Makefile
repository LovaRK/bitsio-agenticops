SHELL := /bin/bash

.PHONY: bootstrap dev test lint seed eval load-test api-smoke verify-local tunnel-start tunnel-stop tunnel-status ollama-start ollama-stop ollama-status live-api live-web live-seed live-verify local local-stop local-status share-web

bootstrap:
	uv sync --all-groups
	pnpm install

dev:
	docker compose up --build

test:
	uv run pytest -q

lint:
	uv run ruff check .
	uv run black --check .
	uv run isort --check-only .
	pnpm --filter web lint

seed:
	uv run python scripts/seed_incidents.py

eval:
	uv run python infra/scripts/run_eval_harness.py --min-pass-rate 90

load-test:
	uv run locust -f tests/load/locustfile.py --host $${HOST:-http://localhost:8001} --headless -u $${USERS:-50} -r $${SPAWN_RATE:-10} -t $${DURATION:-2m}

api-smoke:
	uv run python infra/scripts/api_smoke.py --base-url $${HOST:-http://localhost:8001}

verify-local:
	docker compose up -d --build
	uv run python infra/scripts/api_smoke.py --base-url $${HOST:-http://localhost:8001}
	pnpm --filter web test:e2e
	$(MAKE) test
	$(MAKE) eval

live-api:
	uv run python scripts/run_live_api.py

live-web:
	NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001 INTERNAL_API_BASE_URL=http://127.0.0.1:8001 NEXT_PUBLIC_USE_MOCK=false NEXT_PUBLIC_REQUIRE_LIVE_API=true pnpm --filter web dev --hostname 127.0.0.1 --port 3000

live-seed:
	uv run python scripts/seed_live_splunk_demo.py

live-verify:
	uv run python scripts/verify_live_flow.py

# SSH Tunnel to Splunk MCP (for live mode when 8089 is private)
tunnel-start:
	@echo "🔌 Starting SSH tunnel to Splunk MCP (144.202.48.85:8089)..."
	@if lsof -nP -iTCP:8089 -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "✅ Tunnel already active on localhost:8089"; \
	else \
		ssh -fN -L 8089:localhost:8089 root@144.202.48.85; \
		sleep 1; \
		echo "✅ Tunnel active: localhost:8089 → 144.202.48.85:8089"; \
	fi
	@echo "   (Use 'make tunnel-stop' to close)"

tunnel-stop:
	@pkill -f "ssh -fN -L 8089:localhost:8089 root@144.202.48.85" 2>/dev/null || true
	@pkill -f "ssh -N -L 8089:localhost:8089 root@144.202.48.85" 2>/dev/null || true
	@echo "✅ Tunnel stop command issued"

tunnel-status:
	@if lsof -nP -iTCP:8089 -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "✅ Tunnel active on localhost:8089"; \
	else \
		echo "❌ Tunnel not active"; \
	fi

ollama-start:
	@echo "🧠 Ensuring Ollama server is running on localhost:11434..."
	@if lsof -nP -iTCP:11434 -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "✅ Ollama already active on localhost:11434"; \
	else \
		command -v ollama >/dev/null 2>&1 || (echo "❌ ollama not found. Install from https://ollama.com/download" && exit 1); \
		nohup ollama serve >/tmp/bitsio-ollama.log 2>&1 & echo $$! > /tmp/bitsio-ollama.pid; \
		sleep 2; \
		if lsof -nP -iTCP:11434 -sTCP:LISTEN >/dev/null 2>&1; then \
			echo "✅ Ollama started on localhost:11434"; \
		else \
			echo "❌ Failed to start Ollama. Check /tmp/bitsio-ollama.log"; \
			exit 1; \
		fi \
	fi

ollama-stop:
	@pkill -f "ollama serve" 2>/dev/null || true
	@echo "✅ Ollama stop command issued"

ollama-status:
	@if lsof -nP -iTCP:11434 -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "✅ Ollama: up (11434)"; \
	else \
		echo "❌ Ollama: down"; \
	fi

# Local live runner:
# - ensures MCP tunnel
# - starts API and Web in background
# - validates health URLs
local:
	@echo "🚀 Starting local live stack (tunnel + API + Web)..."
	@$(MAKE) ollama-start
	@$(MAKE) tunnel-start
	@lsof -ti tcp:8001 | xargs kill -9 2>/dev/null || true
	@lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true
	@pkill -f "run_live_api.py" 2>/dev/null || true
	@pkill -f "pnpm --filter web dev" 2>/dev/null || true
	@nohup uv run python scripts/run_live_api.py > .api-live.log 2>&1 & echo $$! > /tmp/bitsio-live-api.pid
	@nohup env NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001 INTERNAL_API_BASE_URL=http://127.0.0.1:8001 NEXT_PUBLIC_USE_MOCK=false NEXT_PUBLIC_REQUIRE_LIVE_API=true pnpm --filter web dev --hostname 127.0.0.1 --port 3000 > .web-live.log 2>&1 & echo $$! > /tmp/bitsio-live-web.pid
	@sleep 6
	@curl -fsS http://127.0.0.1:8001/health >/dev/null && echo "✅ API healthy: http://127.0.0.1:8001/health"
	@curl -fsS http://127.0.0.1:3000 >/dev/null && echo "✅ Web ready: http://127.0.0.1:3000"
	@echo "📍 Open: http://127.0.0.1:3000"

local-stop:
	@echo "🛑 Stopping local live stack..."
	@lsof -ti tcp:8001 | xargs kill -9 2>/dev/null || true
	@lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true
	@pkill -f "run_live_api.py" 2>/dev/null || true
	@pkill -f "pnpm --filter web dev" 2>/dev/null || true
	@$(MAKE) tunnel-stop
	@echo "✅ Local stack stopped"

local-status:
	@echo "🔎 Local status"
	@if curl -fsS http://127.0.0.1:8001/health >/dev/null 2>&1; then \
		echo "✅ API: up (8001)"; \
	else \
		echo "❌ API: down"; \
	fi
	@if curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1; then \
		echo "✅ Web: up (3000)"; \
	else \
		echo "❌ Web: down"; \
	fi
	@$(MAKE) ollama-status
	@$(MAKE) tunnel-status

# Free public share URL for quick demos.
# Requires cloudflared installed: brew install cloudflared
share-web:
	@echo "🌐 Starting Cloudflare quick tunnel for http://127.0.0.1:3000 ..."
	@command -v cloudflared >/dev/null 2>&1 || (echo "❌ cloudflared not found. Install with: brew install cloudflared" && exit 1)
	@cloudflared tunnel --url http://127.0.0.1:3000
