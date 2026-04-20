# ADR-005: Auth Approach

- Status: Accepted

## Context
MVP must remain secure while enterprise SSO integration may arrive later.

## Decision
Implement an OIDC-ready auth boundary and prohibit hardcoded credentials in source code.

## Consequences
- Pros: secure defaults now and clean migration path to enterprise identity.
- Pros: enables approver identity checks from auth context.
- Cons: temporary mock-auth context needed in local MVP flows.
