# ADR-011: Anomaly Scoring Formula

## Status
Accepted (2026-04-16)

## Context
Need transparent anomaly score from current-vs-baseline metrics.

## Decision
Use z-score-based scoring with cap:
- `z = abs((current - baseline_mean) / baseline_stddev)`
- compute for `latency_p95` and `error_rate`
- use `max(z_latency, z_error)`
- normalize: `anomaly_score = min(1.0, z / 5.0)`

LLM explanation is generated only when `anomaly_score > 0.3`.

## Consequences
- Deterministic and explainable confidence input.
- Avoids noisy LLM usage for low-signal deviations.
