---
name: splunk-mcp-adapter
description: Guides agents through writing or modifying Splunk MCP adapter code, normalization layers, and contract tests. Use when touching packages/connectors/splunk-mcp/, when designing SPL queries that the adapter will execute, when adding a new semantic-object normalizer, or when handling errors from the Splunk MCP Server. Covers the official server's hard limits (60s timeout, 1000-event cap, OAuth 2.1, RBAC), the typed error hierarchy, the PartialResult contract, and the prohibition on direct LLM-to-Splunk access.
---

# Splunk MCP Adapter

## Overview

The Splunk MCP adapter is the only path BitsIO code uses to read Splunk. It speaks the **official Splunk MCP Server v1.1+** protocol, returns **typed Pydantic semantic objects** to `agent-core`, and surfaces **real errors** with actionable detail. It never hands raw payloads to an LLM, never retries silently, and never returns canned data when Splunk is unreachable.

Get this layer right and the four architectural laws are cheap to satisfy everywhere else.

## When to Use

**Use this skill when:**
- Adding or modifying any file under `packages/connectors/splunk-mcp/`
- Designing an SPL query that the adapter will execute
- Adding a new normalizer in `packages/connectors/splunk-mcp/normalize/`
- Writing or updating a contract test in `tests/contract/splunk-mcp/`
- Handling an error from the MCP server (auth, RBAC, timeout, row cap, schema, transport)
- Deciding whether to fall back to Splunk REST/SDK for a missing capability

**Do NOT use this skill for:**
- Reading or transforming data **after** it has entered `agent-core` (that's `langgraph-node-authoring`)
- Calling Splunk Observability Cloud — that's a different MCP server with different tools (open a separate ADR if needed)
- Anything that mentions sending Splunk results to an LLM (that's a Law 1 violation; refuse and surface)

## Core Process

Follow these steps in order. Skipping a step is a Rule 9 risk.

### Step 1 — Confirm the capability exists in the official MCP server

Before writing adapter code, check the tool exists on the Splunk MCP Server. The namespaced tools available today:

| Tool | Purpose |
|---|---|
| `splunk_run_query` | Execute SPL (60s timeout, 1000-event cap) |
| `splunk_list_indexes` | Index metadata |
| `splunk_list_saved_searches` | Knowledge objects |
| `splunk_list_data_models` | Data model definitions |
| `saia_explain_spl` (if SAIA installed) | LLM-explained SPL |
| `saia_generate_spl` (if SAIA installed) | NL → SPL |

If the capability you need is not listed, document the gap in `packages/connectors/splunk-mcp/CONTRACT.md` and only then consider Splunk REST/SDK as a fallback. Cite the missing MCP capability in code comments.

### Step 2 — Design the SPL to fit MCP's hard limits

Every SPL the adapter sends must respect:
- **60-second timeout**
- **1000-event row cap**

That means:
- Use `tstats` over raw `search` whenever possible (streaming, fast, summary-friendly)
- Use `stats` to aggregate at source, never aggregate in Python
- Keep the query streaming-friendly — avoid non-streaming commands that materialize results
- Cap result rows below 1000 by design; if you can't, accept that you will receive a `PartialResult`

Example — ingest volumes:

```spl
| tstats sum(kb) as daily_kb
  WHERE index=_internal sourcetype=splunkd component=Metrics group=per_index_thruput
| eval daily_gb = daily_kb / 1024 / 1024
| timechart span=1d sum(daily_gb) by series
```

This returns one row per (index, day), bounded by your time range. Plan the time range so total rows stay below 1000.

### Step 3 — Define the typed semantic object first

In `packages/shared/schemas/telemetry/`, define the Pydantic model BEFORE writing the adapter code. The shape of the object is the contract; the SPL is just one source of truth for filling it.

```python
# packages/shared/schemas/telemetry/ingest_volume.py
from pydantic import BaseModel, ConfigDict, Field
from typing import Annotated
from datetime import datetime

class IngestVolumeDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    schema_version: Annotated[str, Field(pattern=r"^v\d+$")] = "v1"
    index_name: str
    avg_daily_gb: Annotated[float, Field(ge=0)]
    retention_days: Annotated[int, Field(ge=0)]
    total_size_gb: Annotated[float, Field(ge=0)]
    last_event_age_days: Annotated[int, Field(ge=0)]
    measured_at: datetime
```

### Step 4 — Write the adapter method with typed errors

The adapter does three things and three things only: call MCP, capture the raw payload, hand it to a normalizer. Every failure surfaces as a typed exception. Read the `zero-fallback-error-handling` skill for the full error hierarchy.

```python
# packages/connectors/splunk-mcp/client.py
def fetch_ingest_volumes(
    self,
    *,
    time_window_days: int,
    correlation_id: str,
) -> list[IngestVolumeDTO] | PartialResult[list[IngestVolumeDTO]]:
    """
    Returns list[IngestVolumeDTO] on full success.
    Returns PartialResult on row-cap or timeout (caller MUST check `truncated`).

    Raises:
        SplunkAuthError: 401 — token expired or revoked. Do NOT retry.
        SplunkAccessError: 403 — RBAC denied; surface missing capability/index.
        SplunkConnectionError: transport failure after retry budget exhausted.
        SplunkSchemaError: payload shape did not match expected schema.
    """
    raw = self._mcp.call_tool(
        "splunk_run_query",
        spl=SPL_INGEST_VOLUMES,
        timeout_s=60,
        correlation_id=correlation_id,
        params={"time_window_days": time_window_days},
    )
    if raw.truncated:
        return PartialResult(
            data=normalize_ingest_volumes(raw.rows),
            truncated=True,
            truncation_reason=raw.truncation_reason,
            rows_returned=len(raw.rows),
            correlation_id=correlation_id,
        )
    return normalize_ingest_volumes(raw.rows)
```

### Step 5 — Write the normalizer as a pure function

`normalize_ingest_volumes(raw_rows: list[dict]) -> list[IngestVolumeDTO]` lives in `packages/connectors/splunk-mcp/normalize/ingest_volumes.py`. It is pure, takes plain dicts in, returns Pydantic objects out, and raises `SplunkSchemaError` (with the offending row captured) on shape mismatch. No silent skip of malformed rows.

### Step 6 — Write contract tests (real failure modes)

In `tests/contract/splunk-mcp/test_ingest_volumes.py`, cover:
- Happy path against the mock MCP fixture
- Row-cap path (mock returns 1000 rows + `truncated=True`) → assert `PartialResult` with the right reason
- Timeout path (mock raises timeout) → assert `SplunkTimeoutError` returned as `PartialResult` with `splunk_timeout_60s` reason
- 401 path → assert `SplunkAuthError` raised, no retry attempted
- 403 path with `missing_capability` → assert `SplunkAccessError` with that field populated
- Schema-mismatch path (mock returns `{"weird": "row"}`) → assert `SplunkSchemaError` with the row captured

Every failure mode has a test. No mode is uncovered.

### Step 7 — Update the CONTRACT.md

`packages/connectors/splunk-mcp/CONTRACT.md` lists every adapter method with its inputs, outputs, error types, and which MCP tool it calls. Update it in the same diff as the code change. Reviewers reject diffs where the contract drifts from the code.

## SPL Patterns Reference

Common shapes the adapter uses. All `tstats`-shaped where possible.

```spl
# Ingest volume per index (30d daily avg)
| tstats sum(kb) as daily_kb WHERE index=_internal sourcetype=splunkd
    component=Metrics group=per_index_thruput
| eval daily_gb = daily_kb / 1024 / 1024
| timechart span=1d sum(daily_gb) by series

# Search utilization (90d count of searches per index)
| tstats count WHERE index=_audit action=search
| stats count by search_index

# Dashboard / alert dependencies (REST not tstats; capability gap noted)
| rest /services/saved/searches
| where alert_type!="number of events" OR is_scheduled=1
| table title, search, actions

# Parse error rate
index=_internal sourcetype=splunkd component=AggregatorMiningProcessor
| stats sum(total_count) as events,
        sum(invalid_cause_count) as parse_errors by source
| eval parse_error_pct = round(parse_errors/events * 100, 2)
| where parse_error_pct > 5
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll just call Splunk REST directly — it's faster than waiting for MCP to support this." | The MCP server enforces RBAC, OAuth 2.1, and audit logging server-side. Bypassing it strips those guarantees. If MCP genuinely lacks the capability, document it in `CONTRACT.md` with a TODO and a comment block citing the missing tool, then file a Splunkbase support request. Don't quietly bypass. |
| "The 1000-row cap won't matter for my query — Splunk usually returns fewer." | "Usually" is a Rule 9 violation. Plan for the cap. Return `PartialResult` when it hits, and let the caller see `truncated=True`. |
| "I'll catch `Exception` and log it — the agent will figure it out." | The agent has no way to figure it out. Surface the typed error (`SplunkAuthError`, `SplunkAccessError`, etc.) so the caller branches correctly. Generic catch hides bugs and corrupts the audit trail. |
| "Adding a new normalizer is fine — I'll just emit `Dict[str, Any]` for now and tighten later." | Untyped data crosses module boundaries and Rule 4 fails immediately. The Pydantic model is the contract; write it first, even if it has only three fields. |
| "I can mock the MCP response with a fixture in production for development environments." | Test fixtures live in `tests/fixtures/`. They never load at runtime in production code paths. That's Rule 9 zero-fallback. |
| "Retrying on a 401 is fine — the token might just have expired." | If a 401 means an expired token, the rotation path is to surface `SplunkAuthError` so the customer's secret store rotates. Retrying with the same expired token achieves nothing and looks like an attack pattern in the audit log. |

## Red Flags

Observable signs the skill is being violated:

- Any `import requests` or `import splunklib` in `packages/connectors/splunk-mcp/` outside an explicit, documented REST-fallback file
- A function in the adapter that returns a plain `dict` or `list` instead of a Pydantic model or `PartialResult`
- A `try/except Exception` block in the adapter that returns a non-exception value
- An SPL string that uses `search` over raw events when `tstats` would do
- A normalizer that silently drops rows it doesn't recognize (`continue` inside a loop without raising)
- An adapter method without a corresponding contract test
- An adapter method without an entry in `CONTRACT.md`
- The string `"sample"`, `"dummy"`, `"FALLBACK"`, or `load_fixture` anywhere in `packages/connectors/`
- `time.sleep` in the adapter without a documented retry policy and budget

## Verification

Before declaring the slice done, confirm:

- [ ] Every new adapter method has a Pydantic return type (or `PartialResult[T]`)
- [ ] Every new adapter method documents which exceptions it raises in its docstring
- [ ] Every error path has a contract test in `tests/contract/splunk-mcp/`
- [ ] The MCP tool used is namespaced `splunk_*` or `saia_*` (or REST is justified in code comments)
- [ ] The SPL is `tstats`-shaped where possible
- [ ] The semantic object lives in `packages/shared/schemas/telemetry/` with `model_config = ConfigDict(frozen=True, extra="forbid")`
- [ ] `CONTRACT.md` is updated in the same diff
- [ ] `make check-fallbacks` passes (no `load_fixture`, `SAMPLE_`, `DUMMY_` outside tests)
- [ ] `make test` runs the new contract tests; all pass without a live Splunk connection
- [ ] OTel span emitted: name `connector.splunk_mcp.<method>`, attributes `correlation_id`, `tool_called`, `rows_returned`, `truncated`

Cross-references: `zero-fallback-error-handling` for the typed error hierarchy. `semantic-telemetry-objects` for what the LLM is allowed to see downstream. `langgraph-node-authoring` for how a node consumes adapter output.
