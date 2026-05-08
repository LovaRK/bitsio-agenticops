# BitsIO Telemetry Value Agent

Complete OpenCode build system with enterprise-grade architecture.

## Quick Start

```bash
export OPENROUTER_API_KEY=sk-or-YOUR_KEY_HERE
opencode
```

Inside OpenCode TUI:
/spec phase-1 monorepo skeleton with Docker Compose, Postgres, Redis, Ollama
/plan
(press Tab for Build mode)
/build slice 1

## What You Have

- Master AGENTS.md (10 rules, 4 laws)
- 9 BitsIO-specific skills (auto-load)
- 4 subagents (planner, executor, validator, reviewer)
- 7 slash commands (/spec /plan /build /test /review /code-simplify /ship)
- 9 Architecture Decision Records
- Complete documentation
- Git initialized

## The 4 Laws (Never Violate)

1. LLMs never query Splunk directly
2. LLMs never see raw logs
3. Every recommendation is explainable
4. No autonomous writes (human approval required)

## The 10 Rules (Always Enforce)

1. One bounded slice per turn
2. Every file testable without live network
3. Zero hardcoded secrets
4. Pydantic / TypeScript types across boundaries
5. Every LangGraph node has fixture-based tests
6. PRs include scope, what changed, tests, risks, rollback
7. Prompts in files, not embedded in code
8. Produce only what is asked
9. **Zero fallbacks — real errors only**
10. **Local-first by default; cloud only on explicit opt-in**

## Next Steps

1. Read START_HERE.md
2. Get API key at https://openrouter.ai (free tier)
3. Run `opencode`
4. Start with `/spec` command