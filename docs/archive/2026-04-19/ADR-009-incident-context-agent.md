# ADR-009: Incident Context Agent Decomposition

## Status
Accepted (2026-04-16)

## Context
Incident triage needed richer context beyond raw event evidence: metadata enrichment, historical similarity, and anomaly framing.

## Decision
Introduce `incident_context_agent` as a dedicated 5-node graph:
1. `context_ingest`
2. `context_enrichment`
3. `historical_correlation`
4. `anomaly_detection`
5. `context_response`

Each node remains a pure function with dependency injection for external services.

## Consequences
- Improves explainability and reuse across API/UI.
- Keeps testability high (stub-first services).
- Adds one new API contract: `POST /api/v1/incidents/{incident_id}/enrich`.
