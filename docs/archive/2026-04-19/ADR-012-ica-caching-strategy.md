# ADR-012: ICA Enrichment Caching Strategy

## Status
Accepted (2026-04-16)

## Context
Repeated incident detail loads were re-running enrichment and adding latency.

## Decision
Use API-side in-memory cache keyed by `incident_id` for local/dev and expose `force_refresh` flag.
Also persist a corresponding decision-trace record for audit continuity.

## Consequences
- Faster repeat page loads in local/demo runs.
- `force_refresh=true` supports explicit recomputation.
- For multi-instance production, cache should migrate to shared store (Redis/Postgres).
