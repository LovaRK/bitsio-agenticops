# ADR-006: Deployment Target

- Status: Accepted

## Context
Team needs fast local iteration with deterministic developer setup and CI parity.

## Decision
Use Docker Compose as MVP deployment target; defer Kubernetes to later hardening phases.

## Consequences
- Pros: low-friction onboarding and reproducible local stack.
- Pros: clear service boundaries before orchestration complexity.
- Cons: later infra migration required for large-scale production operations.
