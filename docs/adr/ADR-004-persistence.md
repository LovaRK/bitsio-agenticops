# ADR-004: Persistence

- Status: Accepted

## Context
We need relational workflow state, approvals, and optional embeddings without split-database overhead in MVP.

## Decision
Use PostgreSQL with pgvector as the persistence layer.

## Consequences
- Pros: single operational datastore for transactional and vector requirements.
- Pros: straightforward local Docker development.
- Cons: requires schema migration rigor and index tuning as scale grows.
