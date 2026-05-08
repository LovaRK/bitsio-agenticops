---
name: zero-fallback-error-handling
description: Guides agents through writing error handling that surfaces real failures with actionable detail, never canned data. Use when calling any external system (Splunk MCP, Postgres, Redis, Ollama, cloud LLM, OpenRouter), when designing the typed exception hierarchy for a new package, when reviewing a try/except for silent-degradation patterns, or when deciding whether a partial answer is honest. Encodes Rule 9: zero fallbacks, real errors only, with PartialResult as the only honest "graceful degradation" pattern.
---

# Zero-Fallback Error Handling

## Overview

When an external dependency fails — Splunk MCP, Postgres, Redis, Ollama, a cloud LLM, anything — the code surfaces the real failure: HTTP status, error body, retry attempts, correlation ID, what the caller should do next. It does not return canned data. It does not load a fixture. It does not silently degrade. It raises a typed exception with enough detail for the caller to decide.

The customer pays for an audit-grade FinOps analyst. An "analyst" that quietly invents numbers when Splunk is unreachable is worse than no analyst — it corrupts the audit trail and sells confidence the system does not have.

## When to Use

**Use this skill when:**
- Adding a new client for any external system
- Writing a `try/except` block that handles a network or I/O error
- Designing the typed exception hierarchy for a new package (e.g. `packages/connectors/<name>/errors.py`)
- Returning data from a function that might receive truncated results
- Reviewing a slice that contains the strings `except`, `fallback`, `default`, `mock`, `sample`, or `dummy`
- Deciding what the UI shows when a backend call fails

**Do NOT use this skill for:**
- Pure-function logic with no I/O (those don't have failure modes that need this treatment)
- Test code (fixtures and mocks are appropriate inside `tests/`)

## Core Process

### Step 1 — Define the typed exception hierarchy in the package

Every package that calls an external system has `<package>/errors.py` with a base class and subclasses for each documented failure mode. Use a known shape on the base so callers can log uniformly:

```python
# packages/connectors/<system>/errors.py
from datetime import datetime
from typing import Optional

class SystemError(Exception):
    """Base for this connector. Never caught generically by callers."""
    def __init__(
        self,
        message: str,
        *,
        correlation_id: str,
        attempted_at: datetime,
        retry_count: int = 0,
        upstream_status: Optional[int] = None,
        upstream_body: Optional[str] = None,
    ):
        super().__init__(message)
        self.correlation_id = correlation_id
        self.attempted_at = attempted_at
        self.retry_count = retry_count
        self.upstream_status = upstream_status
        self.upstream_body = upstream_body

class SystemAuthError(SystemError):
    """401 — credential expired or revoked. Do NOT retry."""

class SystemAccessError(SystemError):
    """403 — RBAC denied. Surface the missing capability."""

class SystemTimeoutError(SystemError):
    """Request exceeded the documented timeout."""

class SystemConnectionError(SystemError):
    """Transport failure after retry budget exhausted."""

class SystemSchemaError(SystemError):
    """Response shape did not match expected schema."""
```

### Step 2 — Document the raises contract in every public function

Every function that can fail documents which exceptions it raises in its docstring:

```python
def fetch_thing(*, correlation_id: str) -> ThingDTO | PartialResult[ThingDTO]:
    """
    Returns ThingDTO on full success.
    Returns PartialResult on row-cap or timeout (caller MUST check `truncated`).

    Raises:
        SystemAuthError: credential expired/revoked. Caller must reauthenticate.
        SystemAccessError: RBAC denied. Caller surfaces missing capability.
        SystemConnectionError: transport failure after 3 retries.
        SystemSchemaError: response shape did not match expected schema.
    """
```

The docstring is enforced by the validator subagent during review.

### Step 3 — The PartialResult contract is the ONLY honest fallback

```python
# packages/shared/schemas/partial_result.py
from typing import Generic, TypeVar
from pydantic import BaseModel, ConfigDict

T = TypeVar("T")

class PartialResult(BaseModel, Generic[T]):
    """
    A truthful partial answer. The caller MUST inspect `truncated`.
    PartialResult is NOT a fallback for failure — it's an honest report
    of partial success within an external system's documented limits.
    """
    model_config = ConfigDict(frozen=True, extra="forbid")
    data: T
    truncated: bool
    truncation_reason: str  # e.g. "splunk_row_cap_1000", "splunk_timeout_60s"
    rows_returned: int
    rows_attempted_estimate: int | None = None
    correlation_id: str
```

When a node receives a `PartialResult`:
- The `confidence_score` node downgrades confidence
- The agent's final output includes `truncated_inputs[]` in `missing_evidence`
- The UI renders a visible warning panel

A `PartialResult` flowing into a recommendation without the recommendation surfacing the truncation is a Rule 9 violation.

### Step 4 — Implement retries inside the call, never across the boundary

Retry inside one logical call, with bounded budget and exponential backoff. After the budget, raise. Never "retry until success" without a terminal condition.

```python
def _call_with_retries(self, operation, *, max_attempts: int = 3, correlation_id: str):
    last_exc = None
    for attempt in range(max_attempts):
        try:
            return operation()
        except (RetryableTransport,) as e:
            last_exc = e
            sleep(2 ** attempt)  # exponential backoff
            continue
    raise SystemConnectionError(
        f"transport failed after {max_attempts} attempts",
        correlation_id=correlation_id,
        attempted_at=datetime.now(timezone.utc),
        retry_count=max_attempts,
    ) from last_exc
```

A 401 (auth) or 403 (RBAC) is **not retryable**. The retry list contains only transient transport errors.

### Step 5 — At the API edge, convert typed exceptions to typed HTTP responses

The FastAPI middleware is the only place that catches `Exception` broadly, and only to map it to a proper HTTP error response with the correlation ID echoed:

```python
# apps/api/middleware/error_handler.py
@app.exception_handler(SplunkAuthError)
async def handle_splunk_auth(req, exc):
    return JSONResponse(
        status_code=503,
        content={
            "error": "splunk_auth_failed",
            "message": "Splunk credential is expired or revoked",
            "remediation": "Rotate the Splunk MCP token in Settings",
            "correlation_id": exc.correlation_id,
            "attempted_at": exc.attempted_at.isoformat(),
        },
    )
# ... one handler per typed exception class ...
```

The UI displays `message` and `remediation` directly. No "Something went wrong, please try again later" — the user is told what failed and what to do.

### Step 6 — Forbid fixture loading at runtime

Fixtures live in `tests/fixtures/`. They are loaded only by code that lives in `tests/`. The `make check-fallbacks` script enforces this:

```bash
# scripts/check_fallbacks.sh
#!/usr/bin/env bash
set -euo pipefail

# Bare except returning silently
if grep -RnE 'except[^:]*:\s*(return|pass)\s*$' \
    packages/ apps/api/ apps/web/src/ --include='*.py' --include='*.ts' --include='*.tsx'; then
    echo "FAIL: bare except returning silently"
    exit 1
fi

# Fixture loaders outside tests/
if grep -RnE 'load_fixture|read_fixture|SAMPLE_|DUMMY_|MOCK_RESPONSE|FALLBACK_' \
    packages/ apps/api/ --include='*.py' \
    | grep -v '/tests/' | grep -v '_test\.py'; then
    echo "FAIL: fixture loader in non-test file"
    exit 1
fi

# Status-code degradation
if grep -RnE 'if.*status.*!=\s*200.*return [^E]' \
    packages/ apps/api/ --include='*.py'; then
    echo "FAIL: silent status-code degradation"
    exit 1
fi

echo "PASS: no fallback patterns detected"
```

Wire `make check-fallbacks` into `make lint` and the CI pipeline.

### Step 7 — Cold cache miss returns truthful staleness, not silent success

If your code has a cache with a TTL, a miss is not "use stale data and pretend it's fresh." It's either:
- Live fetch and return real result
- Live fetch fails → raise typed exception
- Cache hit but stale → return `PartialResult(data=cached, truncated=True, truncation_reason="cache_stale_<ttl_seconds>", ...)` and let the UI tell the user

The UI must render the staleness. "Last updated 4 hours ago — newer data unavailable" is honest. Showing the cached number with no marker is fraud.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "An empty list is fine if Splunk is down — the dashboard will just show no recommendations." | An empty list is indistinguishable from a successful "you have no waste." That's an audit-trail-corrupting result. Surface the failure; let the UI render "Splunk unavailable: <reason>" instead. |
| "I'll catch the exception and return a default — it's defensive programming." | "Defensive programming" that hides bugs is bad programming. Defensive code surfaces failures with detail; offensive code surfaces nothing. |
| "If the LLM returns malformed JSON, I'll just retry silently — it usually works." | After N retries (configurable, default 2), raise `LLMOutputSchemaError` with the raw output captured. Silent retry-then-fabricate corrupts the recommendation if the next response isn't actually valid either. |
| "The user doesn't need to see the raw error — they'll just be confused." | The user needs to see what happened and what to do. Map typed exceptions to user-language remediation in the API edge. "Splunk credential expired — rotate in Settings" is much better than "Service Unavailable." |
| "I'll cache the last successful response and serve it during outages." | Only with `PartialResult(truncation_reason="cache_stale_*")` and a visible UI marker. Never silently. The customer's audit trail must show that this period's data came from cache, not from live Splunk. |
| "This call to Postgres almost never fails — I don't need to handle it." | Almost-never is the same as never-during-testing. Production has weeks; weeks contain rare events. Every external call has a typed error path. |
| "Returning `None` when something fails keeps the type signature simple." | `None` is the worst kind of fallback — the caller has to remember to check, and the audit trail loses the reason. Either return `T` or raise. Use `Optional` only when "no result" is a valid business outcome. |
| "The connector retries internally, so the caller never sees errors." | The connector exhausts its retry budget and then raises. Every layer has a budget; failures escalate. There is no "retry forever" anywhere. |

## Red Flags

Observable signs the skill is being violated:

- `except Exception:` followed by `return` of any non-exception value, anywhere outside the API edge handler
- `except:` (bare) anywhere
- `pass` as the body of an `except` block
- Function returns `None` or `[]` or `{}` from an `except` clause
- `time.sleep` in a loop with no terminal condition
- `if status != 200: return ...` where `...` is anything other than raising
- File paths matching `*_sample.json`, `*_default.json`, `*_fallback.json` referenced from non-test code
- Strings `"Service Unavailable"`, `"Something went wrong"`, `"Try again later"` rendered to users
- A retry loop without a bounded budget
- `try/except` around an `await` of a database write that swallows on failure (audit-trail-corrupting)

## Verification

Before declaring the slice done:

- [ ] Every external call has a documented typed exception in its `errors.py`
- [ ] Every public function's docstring lists the exceptions it raises
- [ ] Retry logic has a bounded `max_attempts` and exponential backoff
- [ ] 401 and 403 responses do NOT retry
- [ ] Every truncation case returns `PartialResult` with a specific `truncation_reason`
- [ ] The `PartialResult.truncated` flag is consumed by `confidence_score` and surfaced in `missing_evidence`
- [ ] The UI renders the failure message and remediation (no "something went wrong")
- [ ] `make check-fallbacks` passes — no `load_fixture`, `SAMPLE_`, `DUMMY_`, `FALLBACK_`, bare except + return, or status-code degradation outside tests
- [ ] FastAPI exception handlers map every typed exception in this slice to a typed HTTP response
- [ ] Any cache returns `PartialResult` with `truncation_reason` starting with `cache_stale_` when serving stale data
- [ ] Tests cover at least: happy path, auth-error path, rbac-error path, timeout path, connection-error path, schema-error path
- [ ] No test-only artifact (`tests/fixtures/*`) is referenced from production code

Cross-references: `splunk-mcp-adapter` for the canonical example. `decision-trace-writing` for how errored runs are recorded. `langgraph-node-authoring` for how nodes propagate connector errors. `guardian-agent-checks` for runtime detection of fallback-pattern attempts.
