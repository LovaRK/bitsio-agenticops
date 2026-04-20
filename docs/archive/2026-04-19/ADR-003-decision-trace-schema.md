# ADR-003: Decision Trace Schema

- Status: Accepted

## Context
Enterprise adoption requires explainability, replay, and auditability of AI decisions.

## Decision
Use a typed JSON schema for decision traces including node-level `input_hash` and `output_hash` fields.

## Consequences
- Pros: deterministic validation and easier compliance reviews.
- Pros: stable contract for API/UI/test fixtures.
- Cons: schema evolution requires migration discipline.
