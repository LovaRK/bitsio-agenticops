# ADR-010: Embedding Service Abstraction

## Status
Accepted (2026-04-16)

## Context
Historical correlation needs similarity search while remaining deterministic in tests.

## Decision
Adopt `EmbeddingService` protocol with:
- `StubEmbeddingService` for tests/local fallback
- `PgvectorEmbeddingService` scaffold for production vector search

Graph consumes protocol, not concrete implementation.

## Consequences
- Contract tests can run with zero external infra.
- Production path can switch/vector-tune independently.
- Requires migration for `incident_embeddings` table.
