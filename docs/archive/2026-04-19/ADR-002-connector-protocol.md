# ADR-002: Connector Protocol

- Status: Accepted

## Context
Splunk is the system of record. Connector behavior must be secure, typed, and durable across API changes.

## Decision
Use MCP-first connectors and keep custom REST/SDK fallback only when MCP capability is unavailable.

## Consequences
- Pros: aligns with official Splunk direction.
- Pros: reduces bespoke maintenance burden.
- Pros: supports connector extensibility with common patterns.
- Cons: adapter boundary must be strictly enforced and contract-tested.
