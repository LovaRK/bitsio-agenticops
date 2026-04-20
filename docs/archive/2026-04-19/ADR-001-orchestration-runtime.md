# ADR-001: Orchestration Runtime

- Status: Accepted

## Context
BitsIO requires deterministic step sequencing, pause/resume, and human approval gates for enterprise incident operations.

## Decision
Use LangGraph on Python 3.12 as the orchestration runtime for all agent workflows.

## Consequences
- Pros: durable state transitions, node-level observability, human-in-the-loop checkpoints.
- Pros: clear testability of each node with fixture-driven unit tests.
- Cons: additional graph-modeling discipline versus ad-hoc prompt chains.
