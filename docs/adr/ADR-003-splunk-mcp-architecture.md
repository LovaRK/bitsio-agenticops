# ADR-003: Splunk MCP Architecture

## Status
Accepted

## Date
2026-05-08

## Context
All Splunk access must go through a controlled adapter layer. The agent must never directly query Splunk - all access must be mediated through the MCP (Model Context Protocol) adapter.

## Decision
1. **Single Adapter Boundary**: All Splunk access via `SplunkMCPAdapter`
2. **Controlled SPL**: No arbitrary SPL execution, only validated queries
3. **Semantic Transformation**: Raw Splunk data → Semantic Telemetry Objects
4. **No Direct Access**: LLM never talks to Splunk directly

## Data Flow
```
Splunk → SplunkMCPAdapter → Telemetry Normalizer → Semantic Objects → LangGraph Agent
```

## Implementation
- Adapter in `packages/connectors/splunk-mcp/`
- Normalization in `packages/telemetry-engine/`
- Semantic objects in `packages/shared/schemas/telemetry/`

## Consequences

### Positive
- Clear boundary for security scanning
- Easy to swap mock vs real Splunk
- Standardized data format for agents

### Negative
- Additional latency from transformation
- Must maintain adapter for new Splunk features

## References
- CLAUDE.md: Critical Security Rule - LLM must never directly query Splunk
- AGENTS.md Law 1: LLMs never query Splunk directly — normalize through adapters