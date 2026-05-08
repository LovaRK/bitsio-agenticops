---
name: semantic-telemetry-objects
description: Guides agents through defining the typed Pydantic objects that flow between Splunk, the agent-core layer, and the LLM. Use when defining a new schema in packages/shared/schemas/telemetry/, when changing what data the LLM sees in any prompt, when adding a new normalizer that produces these objects, or when reviewing whether an LLM input qualifies as a semantic object. Encodes Law 2 — the LLM sees compressed semantic objects, never raw logs or raw SPL output.
---

# Semantic Telemetry Objects

## Overview

A semantic telemetry object is a Pydantic model that captures the meaning of a Splunk reading without including the Splunk reading itself. It is the only kind of payload allowed inside an LLM prompt. Raw events, raw SPL rows, raw payloads — none of them ever cross the LLM boundary. This is what keeps token counts predictable, audit reasoning verifiable, and PII safely contained.

## When to Use

**Use this skill when:**
- Defining a new model in `packages/shared/schemas/telemetry/`
- Adding fields to an existing model (additive only without an ADR)
- Writing a new normalizer in `packages/connectors/<system>/normalize/`
- Authoring a prompt template that interpolates state fields
- Reviewing what data appears between `{` and `}` in a prompt template

**Do NOT use this skill for:**
- Raw connector payload shapes (those are internal to the adapter, not shared schemas)
- UI-only types (those are TypeScript types, generated from these Pydantic models)

## Core Process

### Step 1 — A semantic object captures meaning, not data

Bad — leaks data into the LLM:

```python
class IndexUsageRaw(BaseModel):
    index_name: str
    raw_search_logs: list[dict]    # ← raw data; LAW 2 violation
    last_100_events: list[dict]    # ← raw events; LAW 2 violation
```

Good — captures meaning only:

```python
class IndexUsageDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    schema_version: Literal["v1"] = "v1"
    index_name: str
    search_count_30d: int
    distinct_users_30d: int
    last_search_age_days: int | None
    avg_search_duration_seconds: float | None
```

The model captures *how the index is used*, not *what it contains*. The LLM gets the meaning; raw events stay in Splunk.

### Step 2 — Models live in `packages/shared/schemas/telemetry/`

Every shared semantic model has its own file:

```
packages/shared/schemas/telemetry/
├── __init__.py                  # public exports
├── ingest_volume.py             # IngestVolumeDTO
├── usage.py                     # IndexUsageDTO
├── dependency_map.py            # DashboardDependencyDTO, AlertDependencyDTO
├── cost.py                      # AnnualCostDTO
├── value_score.py               # ValueScoreDTO
├── waste_classification.py      # WasteClassificationDTO
├── compliance.py                # ComplianceCoverageDTO
└── recommendation.py            # RecommendationDTO
```

Each file exports exactly one model class plus its enum / value-object dependencies.

### Step 3 — Standard model conventions (every model)

```python
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field

class WasteCategory(str, Enum):
    PURE_WASTE = "pure_waste"
    OVER_RETAINED = "over_retained"
    OVER_INGESTED = "over_ingested"
    DUPLICATE = "duplicate"
    NONE = "none"

class WasteClassificationDTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    schema_version: Literal["v1"] = "v1"
    index_name: str
    category: WasteCategory
    confidence: Annotated[float, Field(ge=0.0, le=1.0)]
    estimated_annual_cost_usd: Decimal
    evidence_summary: Annotated[str, Field(max_length=500)]
    affected_dashboards: tuple[str, ...] = ()
    affected_alerts: tuple[str, ...] = ()
    classified_at: datetime
```

Conventions enforced for every model:

- `model_config = ConfigDict(frozen=True, extra="forbid", strict=True)` — immutable, schema-strict
- `schema_version: Literal["vN"]` — explicit versioning
- All fields typed; no bare `Optional` without explicit `None` default
- `Annotated[T, Field(...)]` for value constraints (`ge`, `le`, `min_length`, `max_length`, `pattern`)
- Timestamps: `datetime` with `tzinfo=timezone.utc`
- Money: `Decimal`, never `float`
- IDs: `NewType` or branded types (`WorkflowId = NewType('WorkflowId', str)`) — no bare `str`
- Enums for status / category fields
- Collections: `tuple[T, ...]` for read-only collections (works with `frozen=True`)

### Step 4 — Versioning is explicit; breaking changes are new versions

Adding a field with a default — additive, same schema version:

```python
# v1: add an optional new field
class WasteClassificationDTO(BaseModel):
    # ... existing fields ...
    affected_compliance_frameworks: tuple[str, ...] = ()  # additive
```

Removing or changing a field semantics — new version class, both kept until consumers migrate:

```python
# v1: legacy model, kept for back-compat
class WasteClassificationDTOV1(BaseModel):
    schema_version: Literal["v1"] = "v1"
    confidence: Annotated[float, Field(ge=0.0, le=1.0)]
    # ...

# v2: new model with breaking change (confidence becomes a categorical)
class WasteClassificationDTOV2(BaseModel):
    schema_version: Literal["v2"] = "v2"
    confidence_band: Literal["low", "medium", "high"]
    # ...
```

The graph state references whichever version it accepts; migration is a separate, planned slice.

### Step 5 — Generate TypeScript types for the web edge

```bash
make gen-types
```

This runs `pydantic-to-typescript` over `packages/shared/schemas/telemetry/` and emits to `apps/web/types/telemetry.ts`. The generated file has a header banner:

```typescript
// AUTO-GENERATED FROM packages/shared/schemas/telemetry/
// DO NOT EDIT BY HAND. Run `make gen-types` to regenerate.
```

The web edge imports from `apps/web/types/telemetry.ts`. Pydantic remains the source of truth.

### Step 6 — Prompt templates only interpolate semantic objects

A prompt template in `prompts/graph-nodes/<node>.txt` looks like:

```
You are an enterprise FinOps analyst.

Below are the waste classifications for indexes in this Splunk environment, with their estimated annual costs and dependency footprints.

WASTE CLASSIFICATIONS (JSON):
{waste_classifications}

COST SUMMARY (JSON):
{cost_summary}

COMPLIANCE GAPS (JSON):
{compliance_gaps}

Produce a recommendation for each index.
[... output schema instructions ...]
```

The placeholders are filled with `model.model_dump_json()` — Pydantic-validated, schema-bounded strings. Reviewers reject any prompt template that interpolates raw SPL rows, raw event dictionaries, or any `dict[str, Any]`.

### Step 7 — Test that no raw data leaks into prompts

Add a static check that scans all `.py` files for `{...}` template fills with non-Pydantic types:

```python
# tests/unit/test_prompt_payloads.py
import inspect
from agent_core.nodes.telemetry_value_agent import ai_recommendation_draft

def test_ai_recommendation_only_uses_semantic_objects():
    src = inspect.getsource(ai_recommendation_draft)
    # The prompt fill must use model_dump_json on Pydantic models, not raw dicts
    forbidden_patterns = [
        ".raw_rows",
        ".raw_payload",
        ".events",
        "json.dumps(state.",  # bypasses Pydantic
    ]
    for pat in forbidden_patterns:
        assert pat not in src, f"raw data leaking into prompt: {pat}"
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll send the raw rows — the LLM is smart, it'll figure it out." | Raw rows blow context budgets, contain PII you didn't audit, and produce non-deterministic outputs. The semantic object is what was tested; the raw row is what wasn't. |
| "It's simpler to use a `Dict[str, Any]` for now." | Untyped data becomes ambient. `Dict[str, Any]` propagates, and within a month the codebase has no idea what shape any of it is. Pay the schema cost up front. |
| "The model just needs the index name, I don't need a full DTO." | Today it's the index name. Tomorrow it's the index name plus the cost. The DTO is the right granularity; adding fields is cheap, retrofitting types is expensive. |
| "I'll skip the schema_version field — we'll add it when we need it." | You need it the moment the schema changes for the first time. Add it now. |
| "Tests don't need to validate prompt content — that's the LLM's job." | The LLM sees what we send. We control what we send. Tests verify the boundary — that nothing raw crosses into prompts. |
| "I can use `float` for cost — `Decimal` is overkill." | Floating-point money rounds wrong. Customers do not forgive cost calculations that drift by a cent at $13,413/year. Use `Decimal`. |
| "Tuples are awkward — let me use list for the affected_dashboards field." | `frozen=True` requires immutable collection types. `list` is mutable; Pydantic v2 with strict + frozen rejects assignment but doesn't help if a downstream caller mutates the list in place. Use `tuple`. |

## Red Flags

- A field typed `dict`, `Dict[str, Any]`, `list[dict]`, or `Any` in a shared schema
- A model in `packages/shared/schemas/telemetry/` without `schema_version` or `frozen=True`
- A prompt template that contains `state.<something>` outside of `.model_dump_json()`
- A normalizer that returns a plain dict
- A field for a monetary value typed as `float`
- `datetime` without `tzinfo=timezone.utc`
- An enum represented as raw `str` instead of an `Enum` subclass
- An `Optional[T]` without an explicit `None` default
- A model file in `packages/shared/schemas/telemetry/` exporting more than one top-level model
- The TypeScript types file edited by hand (no auto-generation banner, or a divergent type)

## Verification

Before declaring the slice done:

- [ ] Every new shared model lives in `packages/shared/schemas/telemetry/` with one model per file
- [ ] Every model has `frozen=True`, `extra="forbid"`, `strict=True`
- [ ] Every model has `schema_version: Literal["vN"]`
- [ ] Every monetary field uses `Decimal`
- [ ] Every datetime field is timezone-aware
- [ ] Every enum is an `Enum` subclass, not a raw `Literal["a","b"]` (unless the enum is two-valued and never extends)
- [ ] `make gen-types` regenerates `apps/web/types/telemetry.ts` cleanly
- [ ] No prompt template interpolates anything other than `<model>.model_dump_json()` calls
- [ ] `tests/unit/test_prompt_payloads.py` (or equivalent) passes for every LLM-calling node
- [ ] No `Dict[str, Any]` or `Any` introduced in any shared schema
- [ ] Documentation in `packages/shared/schemas/telemetry/__init__.py` lists every public export

Cross-references: `splunk-mcp-adapter` for the normalizer side. `langgraph-node-authoring` for how a prompt template is written. `decision-trace-writing` for what gets logged about the prompt content.
