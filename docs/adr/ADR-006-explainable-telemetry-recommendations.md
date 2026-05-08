# ADR-006: Explainable Telemetry Recommendations

## Status
Accepted

## Date
2026-05-08

## Context
Every AI recommendation must be fully explainable with evidence, confidence scores, and operational impact. Customers must understand why the system recommends any action.

## Decision
1. **Evidence-Backed**: Each recommendation includes source telemetry references
2. **Confidence Transparency**: Show confidence score (0-1) with breakdown
3. **Impact Analysis**: Include estimated cost savings, affected dashboards/alerts
4. **Human-Readable**: Reasoning in plain English, not just metrics
5. **Audit Trail**: Full decision trace with immutable SHA-256 hash

## Recommendation Schema
```json
{
  "category": "cost|anomaly|roi|optimization",
  "severity": "low|medium|high|critical",
  "description": "Human-readable explanation",
  "recommendation": "What to do",
  "estimated_impact": 13413.00,
  "evidence": ["index:aws_cloudtrail", "searches:0"]
}
```

## Consequences

### Positive
- Builds customer trust
- Enables informed decision-making
- Supports compliance requirements

### Negative
- More complex response format
- Requires maintaining evidence collection

## Implementation
- Decision traces in `packages/decision-tracing/`
- Frontend timeline in `apps/web/src/app/`
- Backend schemas in `apps/api/app/models/schemas.py`

## References
- CLAUDE.md: Explainable Decisions section
- AGENTS.md Law 3: Every recommendation is explainable — carries full evidence