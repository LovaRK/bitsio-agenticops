# SPEC.md — BitsIO Telemetry Value Agent

## Project Overview

- **Project Name**: bitsio-telemetry-agent
- **Category**: Local-first Agentic Telemetry Intelligence Platform for Splunk
- **Purpose**: Enterprise-grade, self-hosted AI system that analyzes Splunk telemetry utilization, ingest economics, and optimization opportunities

---

## 1. Architecture

### High-Level Architecture

```
┌──────────────────────────────────────┐
│          Next.js Frontend            │
│  Agentic UX • Dashboards • Settings  │
└──────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────┐
│            FastAPI Gateway           │
│ RBAC • Policy • Validation • APIs    │
└──────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────┐
│         LangGraph Agent Core         │
│ Reasoning • Workflows • Decisions    │
└──────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────┐
│      Telemetry Normalization Layer   │
│ Semantic Objects • Aggregation       │
└──────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────┐
│          Splunk MCP Adapter          │
│ Controlled SPL • Metadata Access     │
└──────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────┐
│               Splunk                 │
└──────────────────────────────────────┘
```

---

## 2. Core Product Principles

### 2.1 Local-First AI (Non-Negotiable)
- **Default**: Ollama + Gemma4 on customer infrastructure
- **Cloud override**: Disabled by default, explicit opt-in only

### 2.2 Zero Fabricated Telemetry
- Never fabricate telemetry, metrics, or ROI
- Failure states are first-class product states

### 2.3 Explainable Decisions
- Every recommendation includes evidence, confidence, impact, risks

### 2.4 Human-Governed AI
- All actions require human approval
- MVP prohibits autonomous remediation

---

## 3. Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 + TypeScript |
| UI | TailwindCSS + shadcn/ui |
| State | Zustand |
| Async Data | TanStack Query |
| Graph UX | ReactFlow |
| Charts | Recharts |
| Backend | FastAPI + Pydantic v2 |
| Agent Runtime | LangGraph |
| Database | PostgreSQL + pgvector |
| Queue | Redis |
| Runtime AI | Ollama + Gemma4 |
| Model Routing | LiteLLM |
| Observability | OpenTelemetry + Langfuse |

---

## 4. AI Model Configuration

| Mode | Provider | Model | When Used |
|------|----------|-------|-----------|
| **Production (Default)** | Ollama | Gemma4 | Local-first, always default |
| **Cloud Override** | Anthropic | Claude | User opt-in via settings |
| **Development** | OpenRouter | Various | Development/debugging |

---

## 5. Project Structure

```
bitsio-telemetry-agent/
├── apps/
│   ├── api/           # FastAPI backend
│   └── web/           # Next.js frontend
├── packages/
│   ├── agent-core/    # LangGraph engine
│   ├── shared/        # Shared utilities
│   ├── telemetry-engine/  # Telemetry processing
│   └── prompts/       # Prompt templates
├── docs/adr/          # Architecture Decision Records
├── docker/            # Docker configurations
├── .opencode/skills/  # BitsIO skills
└── docker-compose.yml
```

---

## 6. Phase Plan

### Phase 1: Platform Foundation
- Monorepo structure
- Docker Compose
- FastAPI skeleton
- Next.js skeleton
- Database schema
- Model configuration

### Phase 2: Telemetry Intelligence Core
- Splunk MCP adapter
- LangGraph agents
- Analysis nodes

### Phase 3: Governance & Explainability
- Decision traces
- Approval workflow
- Guardian Agent
- RBAC

### Phase 4: Enterprise UX
- Dashboards
- Visualizations
- Settings

---

*This spec follows AGENTS.md - the 10 rules and 4 laws.*