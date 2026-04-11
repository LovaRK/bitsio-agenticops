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
- Splunk integration package for live Phase-2 validation:
  - endpoint
  - auth mechanism
  - read-only role
  - index access confirmation (`tutorial`)
- Optional remote deployment credentials for non-local validation.

## Security Rules
- No secrets in source control.
- Use environment variables or vault-backed secret injection only.
