# AGENTS.md — BitsIO Build Contract

## The Four Architectural Laws

1. **LLMs never query Splunk directly** — normalize through adapters
2. **LLMs never see raw logs** — only typed semantic objects
3. **Every recommendation is explainable** — carries full evidence
4. **No autonomous writes** — all actions require human approval

## The Ten Rules

1. One bounded slice per turn
2. Every file testable without live network
3. Zero hardcoded secrets
4. Pydantic / TypeScript types across boundaries
5. Every LangGraph node has fixture-based tests
6. PRs include scope, what changed, tests, risks, rollback
7. Prompts in files, not embedded in code
8. Produce only what is asked
9. **Zero fallbacks — real errors only**
10. **Local-first inference by default; cloud only on explicit opt-in**

---

## AI Execution Modes

### Development AI (Non-Runtime)
- Used for: coding, reviews, architecture generation
- Models: Kimi K2.6, QwenCoder, DeepSeekCoder, Claude Sonnet (limited)
- Access: OpenCode, Antigravity, OpenRouter

### Production Runtime AI
- Used for: telemetry reasoning, waste analysis, recommendations
- Default: Ollama + Gemma4
- Override: Anthropic (explicit opt-in)

---

## Security Rules

- **NEVER** allow direct LLM → Splunk execution
- **NEVER** allow unrestricted SPL execution
- **ALWAYS** use Guardian Agent for policy enforcement

---

*This is the law. Every slice respects it.*