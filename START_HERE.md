# 🚀 START HERE — BitsIO Workspace

## One-Minute Setup

```bash
export OPENROUTER_API_KEY=sk-or-YOUR_KEY_HERE
opencode
```

Inside OpenCode:
## 4 Laws (Never Violate)

1. LLMs never query Splunk directly
2. LLMs never see raw logs
3. Every recommendation is explainable
4. No autonomous writes (human approval required)

## 10 Rules (Always Enforce)

1. One bounded slice per turn
2. Every file testable without live network
3. Zero hardcoded secrets
4. Pydantic / TypeScript types across boundaries
5. Every LangGraph node has fixture-based tests
6. PRs include scope, what changed, tests, risks, rollback
7. Prompts in files, not embedded in code
8. Produce only what is asked
9. Zero fallbacks — real errors only
10. Local-first by default; cloud only on explicit opt-in

Ready? 🎉
