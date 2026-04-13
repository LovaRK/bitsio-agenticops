SHELL := /bin/bash

.PHONY: bootstrap dev test lint seed eval load-test api-smoke verify-local tunnel-start tunnel-stop tunnel-status live-api live-web live-seed live-verify

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
	@ssh -N -L 8089:localhost:8089 root@144.202.48.85 &
	@echo "PID: $$!" > /tmp/splunk-tunnel.pid
	@sleep 2
	@echo "✅ Tunnel active: localhost:8089 → 144.202.48.85:8089"
	@echo "   (SSH tunnel runs in background; use 'make tunnel-stop' to close)"

tunnel-stop:
	@if [ -f /tmp/splunk-tunnel.pid ]; then \
		kill $$(cat /tmp/splunk-tunnel.pid) 2>/dev/null && \
		rm /tmp/splunk-tunnel.pid && \
		echo "✅ Tunnel stopped"; \
	else \
		echo "⚠️  No tunnel found"; \
	fi

tunnel-status:
	@if [ -f /tmp/splunk-tunnel.pid ]; then \
		PID=$$(cat /tmp/splunk-tunnel.pid); \
		if ps -p $$PID > /dev/null; then \
			echo "✅ Tunnel active (PID: $$PID)"; \
		else \
			echo "❌ Tunnel process dead"; \
			rm /tmp/splunk-tunnel.pid; \
		fi; \
	else \
		echo "❌ No tunnel"; \
	fi
