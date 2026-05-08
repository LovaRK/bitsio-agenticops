# Dependencies and Inputs

## Runtime Dependencies (Implemented)
- Python 3.12
- Node.js 22+
- pnpm
- FastAPI
- Pydantic v2
- LangGraph
- PostgreSQL + pgvector
- Redis
- OpenTelemetry SDK + Collector
- Next.js App Router + TypeScript + Tailwind
- Playwright

## Dev Tooling
- uv
- pytest
- ruff
- black
- isort
- pre-commit
- GitHub Actions

## Required From Team / Environment
- GitHub repository remote for branch/PR workflow.
- Anthropic API key for live model validation (mock mode works without key).
- Splunk live integration access:
  - endpoint (`SPLUNK_MCP_BASE_URL`)
  - token (`SPLUNK_MCP_TOKEN`)
  - adapter mode (`SPLUNK_ADAPTER_MODE=native|mcp|auto`)
  - index access confirmation (`tutorial`)
  - SSH tunnel access if 8089 is private
- Optional remote deployment credentials for non-local validation.

## Security Rules
- No secrets in source control.
- Use environment variables or vault-backed secret injection only.
