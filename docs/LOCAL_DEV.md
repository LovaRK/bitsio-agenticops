# Local Development Setup

## Quick Start

```bash
./scripts/local.sh
```

Opens http://127.0.0.1:3000 with all services running locally:
- **Ollama** (11434) — Local LLM engine (privacy-first)
- **API** (8001) — FastAPI backend with local-first model routing
- **Web** (3000) — Next.js frontend (dark theme)
- **Database** — SQLite or in-memory (dev mode)

## Architecture: Local-First Privacy

### Model Provider Selection

**Default (ALWAYS local):**
```python
MODEL_PROVIDER=ollama  # Local inference, no data leaves machine
```

**User-Selected Cloud (explicit only):**
```python
MODEL_PROVIDER=anthropic  # Only if user explicitly chooses in UI
```

The `ModelSelectionEngine` in `packages/agent-core/` routes:
- **PII/PHI-bearing data** → Ollama (local)
- **General analysis** → User's chosen provider

### Splunk Data Handling

**Live Mode** (production):
```bash
SPLUNK_LIVE_MODE=true
```
- **Requires** live Splunk connection
- **No fallback** to seed data (errors propagate)
- Production-only setting

**Seed Mode** (development):
```bash
SPLUNK_LIVE_MODE=false  # Default for local.sh
```
- Uses in-memory seed data (53 sourcetypes, ~170 GB/day)
- Safe for offline development
- Deterministic scoring (no randomness)

## Environment Variables

Set in `.env` or passed to `./scripts/local.sh`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `MODEL_PROVIDER` | `ollama` | LLM backend (ollama, anthropic) |
| `SPLUNK_LIVE_MODE` | `false` | Use live Splunk (true) or seed (false) |
| `ENVIRONMENT` | `local` | Environment name (local, dev, prod) |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server address |

## Telemetry Executive Dashboard

The `/telemetry-value` page uses:

1. **Scoring Engine** (`apps/api/app/services/scoring_engine.py`)
   - Deterministic composite scoring
   - No LLM involved
   - Weights: Utilization 35% + Detection 40% + Quality 25%

2. **Data Source**
   - Live: Real Splunk queries (5 SPL queries, window_days=90)
   - Seed: Pre-computed 53 sourcetypes with realistic distribution

3. **Cost Engine** (`apps/api/app/services/cost_engine.py`)
   - Annual spend = GB/day × 365 × cost_per_gb_year
   - Default: $10/GB/year (configurable via FilterBar)
   - ROI Score, GainScope, Savings Staircase (5 stages)

## Logs and Debugging

```bash
# Watch logs in real-time
tail -f .logs/api.log
tail -f .logs/web.log
tail -f .logs/ollama.log

# Check if services are healthy
curl http://127.0.0.1:8001/health
curl http://127.0.0.1:3000/
```

## Stopping Services

```bash
# Press Ctrl+C in the terminal running ./scripts/local.sh
# Or:
pkill -f "ollama serve"
pkill -f "uvicorn.*apps.api"
pkill -f "pnpm.*web.*dev"
```

## Testing with Live Splunk

To use actual Splunk data while developing locally:

```bash
# Terminal 1: Start SSH tunnel to production
make tunnel-start

# Terminal 2: Set environment and run
export SPLUNK_LIVE_MODE=true
export SPLUNK_MCP_TOKEN=$(curl -s http://144.202.48.85:8089/internal-openclaw | jq -r .token)
./scripts/local.sh
```

This uses production data but keeps all model inference local (Ollama).

## Privacy Guarantees

✅ **Local-first by default**
- No PII/PHI sent to cloud LLM
- Ollama runs entirely on your machine
- No telemetry phoning home

✅ **User consent required for cloud**
- Cloud LLM (Claude, GPT) only if explicitly selected
- Clear UI indication when using cloud models
- Session logs tagged with model provider

✅ **Seed data for offline work**
- Realistic sample data (not dummy data)
- No production data stored in repo
- Safe for CI/CD and testing
