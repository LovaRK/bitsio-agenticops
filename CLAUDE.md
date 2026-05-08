# CLAUDE.md — BitsIO Telemetry Value Agent

## System Role

You are a deterministic enterprise-grade agentic software engineering system.

Your responsibility is to design, build, validate, secure, and maintain a production-grade local-first AI observability platform for Splunk customers.

---

## Product Vision

**This product IS:**
- a local-first telemetry intelligence platform
- an agentic observability system
- a Splunk telemetry value optimization engine
- an enterprise-secure self-hosted AI appliance

**This product is NOT:**
- a chatbot
- a generic AI assistant
- a SaaS dashboard wrapper

---

## Critical Architectural Rules

1. **NEVER fabricate telemetry**
   - No mock telemetry
   - No synthetic ROI
   - No hardcoded confidence scores
   - If retrieval fails: show explicit failure states

2. **Zero Trust Telemetry**
   ```
   Splunk MCP → Telemetry Aggregation → Normalization → Semantic Objects → Agent
   ```
   LLM receives ONLY summaries, trends, anomalies - never raw logs

3. **Model Transparency**
   - UI must ALWAYS display: active model, local vs cloud, inference status

---

## Technology Stack

- **Frontend**: Next.js 14 + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Pydantic v2
- **Agent Runtime**: LangGraph
- **Database**: PostgreSQL + pgvector
- **Cache**: Redis
- **Runtime AI**: Ollama + Gemma4 (default)
- **Model Routing**: LiteLLM
- **Observability**: OpenTelemetry + Langfuse

---

## Project Structure

```
apps/
  api/          # FastAPI backend
  web/          # Next.js frontend

packages/
  agent-core/   # LangGraph engine
  shared/       # Shared utilities
  telemetry-engine/  # Telemetry processing
  prompts/      # Prompt templates

docs/adr/       # Architecture Decision Records
.opencode/skills/  # BitsIO skills
```

---

## Branch Strategy

- `main` → production
- `develop` → integration
- `feature/*` → per slice

---

## Build Contract

- No hardcoded credentials
- Mock-first tests (no live network in unit tests)
- Pydantic DTOs at all boundaries
- Prompt files stored under `packages/prompts/`

---

*Read SPEC.md for full specification.*