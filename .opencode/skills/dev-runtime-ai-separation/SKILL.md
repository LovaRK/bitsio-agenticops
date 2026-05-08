---
name: dev-runtime-ai-separation
description: Guides agents through maintaining strict separation between BitsIO development-time AI (OpenCode + OpenRouter + Kimi/Qwen/Claude for coding) and customer runtime AI (Ollama + Gemma 4 for telemetry inference). Use when configuring opencode.json, when reviewing whether a model reference is appropriate for its layer, when adding any AI-related dependency to the runtime bundle, or when answering "which model handles this?" Encodes the absolute rule that development models never appear in customer-shipped code.
---

# Dev / Runtime AI Separation

## Overview

The platform contains two completely separate AI systems. They share architectural language, they are governed by different rules, and they must never be mixed:

| Layer | Purpose | Models | Where it runs |
|---|---|---|---|
| **Development AI** | Build the software | Kimi K2.5/2.6, Qwen Coder, DeepSeek Coder, Claude Sonnet/Opus, GPT-5 | BitsIO developer machines via OpenCode + OpenRouter |
| **Runtime AI** | Serve customer telemetry | Gemma 4 (default) on Ollama; cloud only on customer opt-in | Customer's perimeter |

Mixing these two layers — pulling a development model into the customer bundle, or sending customer data through OpenRouter, or hardcoding a Kimi slug into runtime code — is a category error and a security incident.

## When to Use

**Use this skill when:**
- Configuring `opencode.json` (project root) or `~/.config/opencode/opencode.json` (developer)
- Adding or modifying any environment variable that names a model
- Reviewing a diff that mentions OpenRouter, Kimi, Qwen, Anthropic, or OpenAI
- Adding a new Python or TypeScript dependency that pulls an AI client library
- Writing the Docker build steps for any service in the customer bundle
- Answering "which model handles this code path?" for any code path

**Do NOT use this skill for:**
- The customer-facing model selection logic (use `local-first-runtime-inference`)
- Generic Pydantic / TypeScript schema concerns

## Core Process

### Step 1 — Classify the layer of every AI reference

Every time the codebase mentions a model, identify which layer it belongs to:

| Reference appears in | Layer |
|---|---|
| `opencode.json` (root) — for the build agent | Development |
| `~/.config/opencode/opencode.json` (developer machine) | Development |
| `.github/workflows/*.yml` invoking AI in CI | Development |
| `apps/web/`, `apps/api/`, `packages/agent-core/`, `packages/connectors/` | Runtime |
| `infra/docker/compose/*.yml` | Runtime |
| `scripts/bootstrap_models.sh` | Runtime |
| Anywhere shipped to the customer | Runtime |

If you cannot answer the classification question for a given file, the file is mis-located.

### Step 2 — Development layer: cheap workhorse + premium reviewer

The dev layer's whole point is fast, cheap iteration with a premium model on call for high-stakes review.

The project's `opencode.json` (committed) does NOT pin a model. Each developer's machine config does:

```json
// ~/.config/opencode/opencode.json   (NEVER committed)
{
  "$schema": "https://opencode.ai/config.json",
  "model": "openrouter/moonshotai/kimi-k2.6",
  "small_model": "openrouter/moonshotai/kimi-k2:free",
  "provider": {
    "openrouter": {
      "options": {
        "apiKey": "{env:OPENROUTER_API_KEY}",
        "baseURL": "https://openrouter.ai/api/v1"
      }
    },
    "anthropic": {
      "options": { "apiKey": "{env:ANTHROPIC_API_KEY}" }
    },
    "openai": {
      "options": { "apiKey": "{env:OPENAI_API_KEY}" }
    }
  },
  "agent": {
    "build": {
      "model": "openrouter/moonshotai/kimi-k2.6",
      "description": "Workhorse coder: SWE-bench tuned, 256K ctx, cheap"
    },
    "plan": {
      "model": "openrouter/moonshotai/kimi-k2-thinking",
      "description": "Long-horizon planner with thinking tokens"
    },
    "executor": {
      "model": "openrouter/moonshotai/kimi-k2.6"
    },
    "validator": {
      "model": "openrouter/qwen/qwen3-coder"
    },
    "reviewer": {
      "model": "anthropic/claude-opus-4-7",
      "description": "Premium reviewer; manual invoke only — never auto"
    }
  }
}
```

When to escalate to `@reviewer` (Opus / GPT-5):
- ADR review or revision
- Schema changes to `decision_traces`, `node_runs`, `approval_events`
- Auth, RBAC, secrets handling, secret-rotation flows
- Policy YAML changes in `packages/agent-core/policies/rules/`
- Stuck — Kimi has produced two failing iterations on the same slice
- Release tagging

For everything else (CRUD, normalization, UI components, tests) — Kimi K2.6 / 2.5 / Qwen Coder is the right tool.

### Step 3 — Runtime layer: only Gemma + Ollama by default

The customer-shipped runtime imports zero developer-AI libraries:

| Library | Allowed in runtime? |
|---|---|
| `ollama` (Python client) | ✅ yes — runtime inference path |
| `litellm` | ✅ yes — when customer opts into cloud |
| `anthropic` (SDK) | ⚠ only inside `packages/agent-core/models/cloud_provider.py`, gated by `cloud_inference_enabled` |
| `openai` (SDK) | ⚠ same |
| `httpx` to `openrouter.ai` | ❌ never (OpenRouter is dev-only) |
| `langchain_openai`, `langchain_anthropic` | ⚠ only inside `cloud_provider.py` |
| Anything that names `kimi`, `qwen`, `deepseek` | ❌ never in runtime code |

The Docker build for `agent-runtime` does not include OpenRouter dependencies. It pulls Ollama and `gemma4:26b-a4b` (default) as part of the image build or the bootstrap script.

### Step 4 — Mark every dev-only file explicitly

Any file that exists for development convenience and must not ship to customers gets a header comment:

```python
# DEV-ONLY: this file is not bundled into the customer Docker image.
# It exists to support BitsIO's build-time AI workflow (OpenCode + OpenRouter).
# Verify exclusion: grep this filename in `infra/docker/compose/Dockerfile.*`.
```

The Docker build's `.dockerignore` excludes:

```
# Development tooling
.opencode/
~/.config/opencode/
docs/dev-environment/
scripts/dev-*.sh

# Tests and fixtures (not needed at runtime)
tests/
**/__pycache__/
```

A diff that puts dev files inside `apps/`, `packages/`, or `infra/docker/compose/` is mis-located.

### Step 5 — Marketing and product copy honors the separation

External-facing language must not conflate the layers. Acceptable:

- "BitsIO uses high-efficiency AI coding agents during development to ship faster and cheaper."
- "Your runtime inference happens locally on Gemma 4 inside your perimeter."

Not acceptable:

- "Powered by Kimi K2" (in a customer-facing context — they don't see Kimi)
- "Built with Claude" (same — Claude is a build-time tool, not the product)
- Mentioning OpenRouter or any dev-time provider in customer-shipped UI

### Step 6 — When asked to "improve performance by using a better model" — surface the layer

If a request says "let's use Claude instead of Gemma for the agent recommendations" — that's a runtime layer change. It requires:
- A customer-Settings opt-in flow (already exists in `local-first-runtime-inference`)
- Their own API key
- `inference_locale='cloud'` recorded in every trace
- A confirmation modal warning that data leaves the perimeter

If a request says "let's use Claude instead of Kimi for our build sessions" — that's a developer-layer choice. Add it to `~/.config/opencode/opencode.json` for that developer; don't touch the project repo.

If a request says "let's bundle a small Claude usage into the runtime so users don't need to configure cloud" — refuse and explain why. That's a category error.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Just put Kimi in the runtime — it's cheaper than letting customers run their own GPU." | Customers running their own inference is the value proposition. Replacing it with our shared cloud account violates the perimeter promise and creates BitsIO-as-attack-target. |
| "Let me add a fallback to OpenRouter when Ollama is down." | Same issue as `local-first-runtime-inference` Rule 10 — silent cross-perimeter routing. The fallback is to surface the failure, not to leak data. |
| "I'll bundle the Claude SDK so cloud opt-in works out of the box." | Importing the SDK is fine when gated; what matters is the Docker image. The SDK can ship inside `cloud_provider.py` for use only when the customer enables cloud. The OpenRouter / Kimi clients never ship. |
| "I'll use the same OpenRouter client for development AI and cloud opt-in." | Different concerns. OpenRouter is dev convenience for BitsIO; cloud opt-in is customer choice for their data. The runtime cloud adapter goes through `litellm` (or direct provider SDK), not through OpenRouter. |
| "The Kimi model name appears in `opencode.json` — that's the project root, not a runtime file." | Correct, that's fine. The boundary is `apps/`, `packages/`, `infra/`, anything Docker-built. `opencode.json` at the repo root is dev tooling. |
| "Marketing wants to say 'Powered by Claude and Kimi' — sounds impressive." | Correct positioning is what we ship to customers. Kimi never reaches customers. Claude only reaches customers if the customer brings their own key. Marketing copy that conflates layers misleads buyers. |

## Red Flags

- Imports of `kimi`, `qwen`, `deepseek` SDKs anywhere in `apps/`, `packages/`, `infra/`
- A Docker image that pulls OpenRouter dependencies
- A reference to `openrouter.ai/api/v1` in any runtime code path
- A model slug like `moonshotai/kimi-k2.6` referenced in non-development code
- An environment variable like `OPENROUTER_API_KEY` read from a runtime service
- A marketing string in `apps/web/` that names Kimi, Qwen, or OpenRouter
- The dev `opencode.json` config committed (should be in developer's `~/.config/opencode/`)
- A subagent definition in `.opencode/agents/` that ships in the customer bundle (those are dev-only)
- A test fixture that asserts a Kimi response — tests should mock the adapter generically, not name-specific dev models

## Verification

Before declaring the slice done:

- [ ] All Kimi / Qwen / DeepSeek references confined to dev-machine config and `~/.config/opencode/opencode.json`
- [ ] `apps/`, `packages/`, `infra/` contain zero references to OpenRouter
- [ ] `infra/docker/compose/Dockerfile.*` does not install OpenRouter clients
- [ ] `.dockerignore` excludes `.opencode/`, dev configs, tests, fixtures
- [ ] Anthropic / OpenAI SDK imports (if any) are confined to `packages/agent-core/models/cloud_provider.py`
- [ ] `cloud_provider.py` is only invoked when `customer_settings.cloud_inference_enabled = True`
- [ ] No customer-facing UI text names a development-layer provider
- [ ] Build-time tools (subagents, planner, validator) are documented as dev-only with file headers
- [ ] `grep -RE "kimi|qwen|deepseek|openrouter" apps/ packages/ infra/` returns nothing
- [ ] `grep -RE "anthropic|openai" packages/agent-core/` is contained to `models/cloud_provider.py`

Cross-references: `local-first-runtime-inference` for the customer-runtime side. `splunk-mcp-adapter` for the connector-isolation principle that mirrors this same boundary thinking.
