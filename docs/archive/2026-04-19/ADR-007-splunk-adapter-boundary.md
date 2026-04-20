# ADR-007: Splunk Adapter Boundary

- Status: Accepted

## Context
Raw MCP payloads can leak unstable fields and unredacted sensitive content across the codebase.

## Decision
Contain all raw MCP interactions within `packages/connectors/splunk-mcp` and expose typed Pydantic DTOs only.

## Consequences
- Pros: stable internal contract and safer logging controls.
- Pros: easier contract testing with fixture payloads.
- Cons: adapter mapping layer must be maintained as MCP payloads evolve.
