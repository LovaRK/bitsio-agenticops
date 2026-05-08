---
name: local-first-runtime-inference
description: Guides agents through writing or modifying any code that selects, configures, or invokes the runtime LLM. Use when touching packages/agent-core/models/, the Settings UI for model selection, the Ollama bootstrap script, the cloud opt-in flow, or anything that decides which model handles a customer's data. Encodes Rule 10 — Gemma 4 is the canonical local default; cloud is opt-in only with a customer-supplied API key; no path silently routes customer data to cloud; the UI always shows where inference happened.
---

# Local-First Runtime Inference

## Overview

The product runs in the customer's perimeter. The customer's telemetry analysis must not leave that perimeter unless they explicitly choose for it to. Therefore:

- **Default provider**: local Ollama
- **Default model**: `gemma4:26b-a4b` (canonical), `gemma4:31b` (upgrade), `gemma4:e4b` (compact)
- **Embedding model**: `embeddinggemma:300m`
- **Cloud routing**: OFF unless `customer_settings.cloud_inference_enabled = True` AND a non-empty user-provided API key
- **No silent fallback to cloud** when local is slow, unhealthy, or unreachable

Every decision-trace row records which provider and model handled it. Auditors filter by `inference_locale='cloud'` to verify perimeter compliance.

## When to Use

**Use this skill when:**
- Adding or modifying `packages/agent-core/models/adapter.py`, `ollama_provider.py`, or `cloud_provider.py`
- Building the Settings UI section for model selection or cloud opt-in
- Writing the bootstrap script that pulls models on first install
- Implementing the model-pickers (auto-detect hardware tier → default model)
- Touching any factory function that returns a `ModelAdapter`

**Do NOT use this skill for:**
- BitsIO build-time AI choices (use `dev-runtime-ai-separation`)
- Embedding tasks where the choice is independent of the chat model — use `embeddinggemma:300m` regardless

## Core Process

### Step 1 — The adapter is the only path

Nothing in `packages/agent-core/nodes/` calls Ollama or any cloud provider directly. The model adapter is the single seam:

```python
# packages/agent-core/models/adapter.py
from abc import ABC, abstractmethod
from typing import Literal
from pydantic import BaseModel, ConfigDict

class LLMRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    prompt: str
    system: str | None = None
    max_tokens: int = 2048
    temperature: float = 0.0
    stop: list[str] | None = None
    correlation_id: str

class LLMResponse(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    text: str
    model_id: str
    provider: Literal["ollama", "anthropic", "openai", "openrouter"]
    inference_locale: Literal["local", "cloud"]
    tokens_in: int
    tokens_out: int
    correlation_id: str
    finish_reason: Literal["stop", "length", "content_filter", "error"]

class ModelAdapter(ABC):
    @property
    @abstractmethod
    def provider(self) -> Literal["ollama", "anthropic", "openai", "openrouter"]: ...

    @property
    @abstractmethod
    def model_id(self) -> str: ...

    @abstractmethod
    def invoke(self, req: LLMRequest) -> LLMResponse:
        """
        Raises:
            LLMUnavailableError: provider unreachable after retries.
            LLMAuthError: API key invalid or daemon misconfigured.
            LLMOutputSchemaError: response did not parse.
            LLMTokenBudgetError: prompt too long for context window.

        Never returns a fabricated success.
        """
        ...
```

### Step 2 — The factory enforces the local-first contract

```python
# packages/agent-core/models/factory.py
from typing import Final

DEFAULT_LOCAL_MODEL: Final[str] = "gemma4:26b-a4b"
EMBEDDING_MODEL: Final[str] = "embeddinggemma:300m"

def get_model_adapter(settings: CustomerSettings) -> ModelAdapter:
    if not settings.cloud_inference_enabled:
        return OllamaAdapter(
            base_url=settings.ollama_base_url,
            model_id=settings.local_model_id or DEFAULT_LOCAL_MODEL,
        )

    # User has explicitly opted in. Validate the key is present.
    if not settings.cloud_provider_api_key:
        raise ConfigurationError(
            "cloud_inference_enabled=True but no API key configured. "
            "Set the API key in Settings or disable cloud inference."
        )

    return CloudAdapter(
        provider=settings.cloud_provider,        # "anthropic" | "openai" | "openrouter"
        api_key=settings.cloud_provider_api_key, # from secrets store
        model_id=settings.cloud_model_id,
    )
```

What this factory does NOT do:
- Detect that Ollama is unreachable and silently route to cloud
- Have a "best available" mode that picks dynamically
- Read a global default that overrides per-tenant settings

If `OllamaAdapter.invoke` raises `LLMUnavailableError`, the caller sees it. There is no `except LLMUnavailableError: return CloudAdapter(...)` anywhere. That would be Rule 10 plus Rule 9, both violated.

### Step 3 — The bootstrap script pulls Gemma 4 by hardware tier

```bash
# scripts/bootstrap_models.sh
#!/usr/bin/env bash
set -euo pipefail

available_gb=$(awk '/MemAvailable/ {printf "%.0f", $2/1024/1024}' /proc/meminfo)

if [ "$available_gb" -ge 32 ]; then
    DEFAULT_MODEL="gemma4:31b"
    TIER="standard"
elif [ "$available_gb" -ge 24 ]; then
    DEFAULT_MODEL="gemma4:26b-a4b"
    TIER="canonical"
elif [ "$available_gb" -ge 16 ]; then
    DEFAULT_MODEL="gemma4:e4b"
    TIER="compact"
else
    echo "ERROR: Minimum 16 GB RAM required. Detected: ${available_gb} GB" >&2
    exit 1
fi

echo "Detected hardware tier: $TIER. Default model: $DEFAULT_MODEL"
ollama pull "$DEFAULT_MODEL"
ollama pull embeddinggemma:300m

# Persist the detected default. Customer can override in Settings.
psql "$DATABASE_URL" -c \
  "INSERT INTO customer_settings (key, value) VALUES
   ('local_model_id', '$DEFAULT_MODEL'),
   ('embedding_model_id', 'embeddinggemma:300m'),
   ('cloud_inference_enabled', 'false')
   ON CONFLICT (key) DO NOTHING;"
```

The script refuses to start the system if hardware is below minimum (Rule 9). It does not fall back to a cloud provider as a workaround.

### Step 4 — Settings UI renders the choice transparently

The Settings page shows three sections:

```
═══════════════════════════════════════════════════════════
LOCAL MODEL (always available, default)
───────────────────────────────────────────────────────────
Detected hardware tier: canonical (24 GB available)

Active model:  [ gemma4:26b-a4b ▾ ]
               ├─ gemma4:31b       (recommended for 32+ GB)
               ├─ gemma4:26b-a4b   (canonical, current)
               ├─ gemma4:e4b       (compact, lower quality)
               └─ <other models pulled in your Ollama>

[Test connection]   [Pull a different model]

═══════════════════════════════════════════════════════════
CLOUD INFERENCE (opt-in, your data leaves the perimeter)
───────────────────────────────────────────────────────────
[ ] Use cloud inference for AI recommendations

  ⚠ Enabling this sends prompts to your chosen provider.
    Your telemetry analysis will leave your perimeter.
    Every cloud-routed decision is logged with
    inference_locale='cloud' for audit visibility.

Provider:  [ Anthropic | OpenAI | OpenRouter ]
API key:   [_______________________]   [Rotate]
Model:     [auto-populated]

═══════════════════════════════════════════════════════════
EMBEDDING MODEL
───────────────────────────────────────────────────────────
Active model: embeddinggemma:300m  (always local)
```

The cloud opt-in checkbox is OFF by default. Toggling it requires confirming a modal: "I understand my prompts will leave my perimeter. My data will be sent to {provider} per their data-handling terms."

### Step 5 — Every node-run records provenance

When the LLM-calling node returns, it populates `state.model_provenance` from the `LLMResponse`:

```python
return state.model_copy(update={
    "recommendation_draft": response.text,
    "model_provenance": ModelProvenance(
        provider=response.provider,
        model_id=response.model_id,
        inference_locale=response.inference_locale,
        tokens_in=response.tokens_in,
        tokens_out=response.tokens_out,
    ),
})
```

The trace wrapper (see `decision-trace-writing`) writes these fields into `node_runs`. Auditors can run:

```sql
SELECT workflow_id, started_at, model_provider, model_id
FROM node_runs
WHERE inference_locale = 'cloud'
  AND tenant_safe_id = $1
  AND started_at > $2;
```

If the customer has not enabled cloud inference, this query returns zero rows. That's verifiable perimeter compliance.

### Step 6 — UI banner shows current inference status

The dashboard top bar always shows:

```
Inference: LOCAL  ·  Model: gemma4:26b-a4b  ·  Cloud: DISABLED
```

When cloud is enabled:

```
Inference: CLOUD  ·  Provider: Anthropic  ·  Model: claude-sonnet-4-7
```

This is a hard requirement, not a feature. If a user can't see at a glance where inference is happening, they cannot make good security decisions.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "If Ollama is slow, I'll fail over to cloud — better UX." | That's exactly the silent-route-out-of-perimeter the entire product opposes. Slow local inference is the customer's hardware decision. Surface "local model busy, response in progress"; do not silently change inference_locale. |
| "I'll bundle a default BitsIO OpenRouter key — saves the customer setup." | A shared key is the worst possible architecture: customers' prompts pool through one BitsIO account, BitsIO becomes a high-value attack target, and every recommendation now has BitsIO on the data path. Cloud opt-in is per-customer with their own key. No shared default. |
| "Gemma 4 is overkill for some users — let me ship a small fast model as default." | The MoE 26B-A4B is already optimized: 4B active per token, fast inference, good quality. The compact tier (`e4b`) exists for low-spec hardware. Don't pre-pick mediocrity. |
| "Auto-pick the model based on prompt length — large prompts go cloud, small stay local." | Prompt-length routing is a covert cloud routing pattern. The customer set `cloud_inference_enabled=False`. Honor that. |
| "I'll make the embedding model configurable to a cloud provider." | Embeddings of customer data are still customer data. `embeddinggemma:300m` is local, fast, free, sufficient. Adding a cloud embedding option means another data-leakage path. |
| "The Settings UI is cluttered — I'll hide the cloud section unless it's enabled." | The cloud section is visible exactly because it is consequential. Hiding it makes accidental enablement worse, not better. |
| "Cloud opt-in is per-tenant — I can have a global override for development." | Development uses test tenants with their own settings. There is no global cloud-on flag. (The BitsIO build-time AI is a separate concern; see `dev-runtime-ai-separation`.) |

## Red Flags

- Any code in `packages/agent-core/` that imports `anthropic`, `openai`, or `litellm` outside `packages/agent-core/models/cloud_provider.py`
- An adapter factory that returns `CloudAdapter` without checking `settings.cloud_inference_enabled`
- A `try/except` around an Ollama call followed by a cloud invocation
- A bootstrap script that pulls a non-Gemma default model
- A Settings UI component where the cloud opt-in toggle is `defaultChecked` or hidden
- A `node_runs` insert that omits `model_provider`, `model_id`, or `inference_locale`
- An LLM call where the system prompt is loaded inline rather than from `prompts/` (cross-violation with Rule 7)
- A cloud key persisted as plaintext in the customer database (must be in the secrets store)
- Code that reads `OPENROUTER_API_KEY` or similar at runtime in customer-shipped code

## Verification

Before declaring the slice done:

- [ ] `get_model_adapter()` returns `OllamaAdapter` when `cloud_inference_enabled=False`
- [ ] `get_model_adapter()` raises `ConfigurationError` if cloud is enabled but no key is set
- [ ] No path silently swaps Ollama for cloud on failure — Ollama errors raise `LLMUnavailableError` and propagate
- [ ] `LLMResponse` includes `provider` and `inference_locale` populated from the actual call
- [ ] `state.model_provenance` is set in every LLM-calling node
- [ ] `node_runs` rows for LLM nodes have `model_provider`, `model_id`, `inference_locale`, `tokens_in`, `tokens_out`
- [ ] Settings UI shows current inference status banner
- [ ] Cloud opt-in modal shows the explicit warning and requires confirmation
- [ ] Bootstrap script auto-detects hardware tier and refuses on sub-minimum
- [ ] Embedding model is `embeddinggemma:300m` (local) by default; no cloud embedding path
- [ ] `make check-cloud-defaults` passes (no `anthropic|openai|openrouter` imports outside `cloud_provider.py`)
- [ ] Customer can verify `SELECT count(*) FROM node_runs WHERE inference_locale='cloud'` returns 0 when they have not opted in

Cross-references: `dev-runtime-ai-separation` for why BitsIO build-time choices are a different layer entirely. `decision-trace-writing` for the provenance fields. `zero-fallback-error-handling` for `LLMUnavailableError` and friends.
