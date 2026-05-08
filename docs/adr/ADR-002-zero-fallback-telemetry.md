# ADR-002: Zero-Fallback Telemetry

## Status
Accepted

## Date
2026-05-08

## Context
The platform must never fabricate telemetry, synthetic metrics, or artificial ROI data. If telemetry retrieval fails, the failure must be surfaced as a first-class product state.

## Decision
1. **No Mock Data**: Never inject sample data when real data unavailable
2. **Explicit Failure States**: Show 0, null, unavailable, loading, inference unavailable
3. **Transparency**: All metrics show source (live vs mock)
4. **Failure is Not Error**: Missing data is a valid state, not an exception

## Allowed Fallback States
- `0` - count of zero events
- `null` - no data available
- `unavailable` - service unreachable
- `loading` - in progress
- `inference unavailable` - AI model not responding

## Consequences

### Positive
- Customers trust the system because data is authentic
- No false positives from fabricated metrics
- Clear indication when data sources are unavailable

### Negative
- UI may show empty states more frequently
- Requires better error handling throughout

## Implementation
- All telemetry endpoints return explicit status
- Frontend displays loading/unavailable states
- No silent fallbacks to mock data

## References
- CLAUDE.md: Zero Fabricated Telemetry Rules
- AGENTS.md Rule 9: Zero fallbacks — real errors only