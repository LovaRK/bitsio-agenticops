# ADR-001: Local-First Inference

## Status
Accepted

## Date
2026-05-08

## Context
The BitsIO Telemetry Value Agent must run entirely on customer infrastructure with no telemetry data leaving the client's environment. This requires AI inference to happen locally by default.

## Decision
1. **Default Runtime**: Ollama with Gemma4 model running on customer infrastructure
2. **Cloud Override**: Anthropic cloud available only via explicit opt-in through settings
3. **Development Mode**: OpenRouter for development purposes only
4. **No Hidden Switching**: UI must always display active model, provider, and inference mode

## Consequences

### Positive
- Zero telemetry data leaves customer environment by default
- No dependency on external API connectivity for core functionality
- Lower cost for high-volume usage
- GDPR/compliance friendly

### Negative
- Gemma4 may be less capable than cloud models for complex reasoning
- Initial model download (~2GB) required
- Customer must have compute resources for local inference

## Implementation
- Model adapter factory in `packages/agent-core/src/models/adapter.py`
- Settings UI in `apps/web/src/app/settings/page.tsx`
- Environment variables: `OLLAMA_BASE_URL`, `DEFAULT_MODEL_PROVIDER`, `DEFAULT_MODEL_NAME`

## References
- AGENTS.md Rule 10: Local-first inference by default; cloud only on explicit opt-in