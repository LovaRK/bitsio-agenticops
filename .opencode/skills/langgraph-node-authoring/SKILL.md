---
name: langgraph-node-authoring
description: Guides agents through writing or modifying any LangGraph node in packages/agent-core/. Use when adding a new node to a graph, changing the state shape, modifying the prompt for an LLM-calling node, or writing the fixture-based unit test that ships with every node. Covers the (state) -> state purity rule, the prompt-loading contract, the model-adapter abstraction, the fixture pair convention, and the OpenTelemetry / decision-trace requirements that every node must satisfy.
---

# LangGraph Node Authoring

## Overview

Every node in a BitsIO LangGraph graph is a pure function `(state) -> state` that is independently unit-testable with fixture inputs. Only one node per agent calls the LLM (in the Telemetry Value Agent it is `ai_recommendation_draft`). Every other node is deterministic. This contract is what makes the agent auditable, replayable, and cheap to test.

## When to Use

**Use this skill when:**
- Adding a new node to `packages/agent-core/graphs/<graph>.py`
- Modifying an existing node in `packages/agent-core/nodes/<graph>/<node>.py`
- Changing the Pydantic state model in `packages/agent-core/state/<graph>_state.py`
- Authoring or revising the prompt for an LLM-calling node
- Writing the fixture pair (`input.json`, `expected.json`, optional `llm_mock.json`) for a node

**Do NOT use this skill for:**
- Changes to the connector layer (use `splunk-mcp-adapter`)
- Changes to the decision-trace persistence layer (use `decision-trace-writing`)
- Defining new public schemas across packages (use the `pydantic-contracts` rules in `AGENTS.md`)

## Core Process

### Step 1 — Confirm the node fits the canonical graph

The Telemetry Value Agent has eleven nodes:

```
scope_ingest → ingest_volume_retrieval → usage_retrieval → dependency_mapping
  → cost_computation → value_scoring → waste_classification
  → ai_recommendation_draft → confidence_score → approval_check → final_response
```

Adding a node outside this list requires an ADR amendment. Modifying the order requires an ADR amendment. Renaming requires a migration of all fixtures. None of these are casual changes.

### Step 2 — Decide whether the node calls the LLM

Default answer: no. In the canonical graph, only `ai_recommendation_draft` calls the LLM. Other nodes are deterministic — they aggregate, filter, score, or assemble. If your candidate node would call the LLM, prove the deterministic alternative is impossible before proceeding.

If the node is deterministic (the common case), skip Step 5 entirely.

### Step 3 — Update the state model

Open `packages/agent-core/state/<graph>_state.py`. Add only the fields the new node needs as inputs/outputs. Keep the model:
- Pydantic v2
- `model_config = ConfigDict(frozen=True, extra="forbid", strict=True)`
- Every field typed; no bare `Optional` without a default
- Use `Annotated[T, Field(...)]` for constraints (min/max, regex, ge/le)

Frozen state means nodes return a new state via `state.model_copy(update={...})`. Tests assert the input state was not mutated.

### Step 4 — Write the node

```python
# packages/agent-core/nodes/telemetry_value_agent/cost_computation.py
from agent_core.state.telemetry_state import TelemetryAgentState

def cost_computation(state: TelemetryAgentState) -> TelemetryAgentState:
    """
    Compute estimated annual cost per index from ingest volume and customer license rate.
    Pure function. No I/O. No LLM call.
    """
    license_rate = state.customer_settings.license_rate_usd_per_gb
    annual_costs = {
        v.index_name: round(v.avg_daily_gb * 365 * license_rate, 2)
        for v in state.ingest_volumes
    }
    return state.model_copy(update={"annual_costs_usd": annual_costs})
```

Properties checklist:
- **Pure** — same input, same output
- **Total** — handles every reachable state shape; no `KeyError`
- **Idempotent** — running twice yields the same result
- **No print** — use the OTel-aware logger if needed; preferred is no logging from a deterministic node
- **No I/O** — file system, network, DB are forbidden inside the node body

If the node needs external data, it does not call the connector itself — its inputs already contain that data, populated by an earlier node (e.g. `ingest_volume_retrieval`). Earlier nodes that *do* call connectors live in their own files and load this skill plus `splunk-mcp-adapter`.

### Step 5 — (LLM-calling nodes only) Author the prompt and adapter call

Prompts live in `prompts/graph-nodes/<graph>/<node>.txt` — never inline (Rule 7). Use `{placeholder}` syntax for inputs.

```python
# packages/agent-core/nodes/telemetry_value_agent/ai_recommendation_draft.py
from agent_core.models import get_model_adapter
from agent_core.prompts import load_prompt
from agent_core.state.telemetry_state import TelemetryAgentState

def ai_recommendation_draft(state: TelemetryAgentState) -> TelemetryAgentState:
    """
    LLM-calling node. Sends ONLY normalized semantic objects to the model.
    """
    template = load_prompt("telemetry_value_agent/ai_recommendation_draft.txt")
    prompt = template.format(
        waste_classifications=state.waste_classifications.model_dump_json(),
        cost_summary=state.cost_summary.model_dump_json(),
        compliance_gaps=state.compliance_gaps.model_dump_json(),
    )
    adapter = get_model_adapter(state.customer_settings)
    response = adapter.invoke(LLMRequest(
        prompt=prompt,
        max_tokens=2048,
        temperature=0.0,
        correlation_id=state.workflow_id,
    ))
    return state.model_copy(update={
        "recommendation_draft": response.text,
        "model_provenance": ModelProvenance(
            provider=response.provider,
            model_id=response.model_id,
            inference_locale="local" if response.provider == "ollama" else "cloud",
            tokens_in=response.tokens_in,
            tokens_out=response.tokens_out,
        ),
    })
```

Notice what is **not** in the prompt: raw SPL output, raw events, anything resembling a log line. Only Pydantic semantic objects serialized to JSON. That's Law 2.

### Step 6 — Write the fixture pair

Every node ships with fixtures under `tests/fixtures/<graph>/<node>/`:

```
tests/fixtures/telemetry_value_agent/cost_computation/
├── input.json       # serialized TelemetryAgentState (the node's input)
├── expected.json    # serialized TelemetryAgentState (after the node runs)
└── llm_mock.json    # ONLY for LLM-calling nodes — the mocked response
```

`input.json` should be the minimum-realistic state for this node (don't carry irrelevant fields that drift over time). `expected.json` is byte-equal to what the node returns when given `input.json`.

### Step 7 — Write the unit test

```python
# tests/unit/test_cost_computation.py
import json
from pathlib import Path
from agent_core.state.telemetry_state import TelemetryAgentState
from agent_core.nodes.telemetry_value_agent.cost_computation import cost_computation

FIXTURE_DIR = Path("tests/fixtures/telemetry_value_agent/cost_computation")

def test_cost_computation_happy_path():
    input_state = TelemetryAgentState.model_validate_json(
        (FIXTURE_DIR / "input.json").read_text()
    )
    expected = TelemetryAgentState.model_validate_json(
        (FIXTURE_DIR / "expected.json").read_text()
    )
    result = cost_computation(input_state)
    assert result == expected

def test_cost_computation_does_not_mutate_input():
    input_state = TelemetryAgentState.model_validate_json(
        (FIXTURE_DIR / "input.json").read_text()
    )
    snapshot = input_state.model_dump_json()
    cost_computation(input_state)
    assert input_state.model_dump_json() == snapshot
```

For LLM-calling nodes, mock the model adapter:

```python
def test_ai_recommendation_draft_with_mocked_llm(monkeypatch):
    mock_response = LLMResponse.model_validate_json(
        (FIXTURE_DIR / "llm_mock.json").read_text()
    )
    monkeypatch.setattr(
        "agent_core.models.get_model_adapter",
        lambda _: MockAdapter(response=mock_response),
    )
    # ... run node, assert state ...
```

The test runs **without** a live Ollama or cloud LLM. That's Rule 2.

### Step 8 — Wire the node into the graph

```python
# packages/agent-core/graphs/telemetry_value_agent.py
from langgraph.graph import StateGraph

def build_telemetry_value_agent() -> StateGraph:
    g = StateGraph(TelemetryAgentState)
    g.add_node("cost_computation", cost_computation)
    g.add_edge("value_scoring", "cost_computation")
    g.add_edge("cost_computation", "waste_classification")
    return g
```

### Step 9 — Confirm OTel and decision-trace coverage

Every node run emits exactly one span:
- name: `node.<node_name>` (e.g. `node.cost_computation`)
- attributes (always): `service.name`, `graph.name`, `graph.version`, `node.name`, `workflow_id`, `tenant.safe_id`, `env`
- attributes (LLM nodes only): `model.provider`, `model.id`, `model.inference_locale`, `tokens.in`, `tokens.out`

Every node run writes one `node_runs` row with `state_hash_in`, `state_hash_out`, `tool_calls[]`, `policy_checks[]`, plus model provenance for LLM nodes. The persistence wrapper handles this; nodes don't write traces themselves.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll add the test later — the logic is simple." | Rule 5 says no node ships without its fixture-based test. "Later" never happens once the slice merges. Five minutes of test now beats five hours of regression debugging in three months. |
| "I'll mutate state in place — it's faster." | LangGraph state is shared across replay, audit, and approval-resume paths. In-place mutation breaks the immutability contract that makes those paths safe. The performance cost of `model_copy` is irrelevant at our scale. |
| "Let me put the prompt inline as a string — it's a one-liner." | Rule 7. Prompt strings are versioned artifacts, IP, and audit material. They live in `prompts/`. No exception for "small" prompts. |
| "This node really needs to call Splunk directly — bridging through state would be ugly." | Then the design is wrong. Earlier nodes call the connector and put results in state. Later nodes consume state. A node that calls Splunk directly cannot be unit-tested without a live MCP server (Rule 2 violation) and bloats the node's responsibility. |
| "I'll let the node return `None` if the upstream data is missing." | Nodes return state, not Optional[state]. Missing upstream data is either a typed error from the upstream node, or the node skips its work and copies state through unchanged with a logged reason. |
| "I'll add the LLM call here too — it'll save a node." | The single-LLM-call rule keeps the agent auditable. Two LLM nodes means two prompts, two cost lines, two failure modes, two model_provenance records. If you genuinely need a second LLM step, write an ADR. |
| "The node tests are duplicates of the contract tests." | They're not. Contract tests verify the connector talks to MCP correctly. Node tests verify the node transforms state correctly. They cover different layers and both must pass. |

## Red Flags

- A node that imports `requests`, `httpx`, `psycopg`, `redis`, `splunklib`, or any I/O library
- A node body longer than ~50 lines (decompose into helpers in `packages/shared/`)
- A node that sets a state field outside the typed `TelemetryAgentState` shape (`extra="forbid"` will catch this at runtime, but the diff should never propose it)
- A node without a sibling `tests/unit/test_<node>.py`
- A node without `tests/fixtures/<graph>/<node>/{input,expected}.json`
- A prompt string inside `.py` source — search for `"""` followed by lines of system-prompt-like text
- A node that calls `get_model_adapter()` and is named anything other than `ai_recommendation_draft` (Telemetry Value Agent), or the equivalent canonical LLM node for other agents
- An LLM node that includes raw Splunk payloads in its prompt — search for `IngestVolumeRaw`, `dict[str, Any]`, etc. crossing the prompt boundary

## Verification

Before declaring the slice done:

- [ ] State model unchanged or extended additively (no field removed without migration plan)
- [ ] Node is `(state) -> state`, pure, no I/O, no `print`
- [ ] Prompt (if any) is in `prompts/graph-nodes/<graph>/<node>.txt`, loaded by name
- [ ] Fixture pair exists at `tests/fixtures/<graph>/<node>/{input,expected}.json`
- [ ] LLM-calling nodes additionally have `llm_mock.json` and a mock adapter in the test
- [ ] Test asserts both correctness and input-immutability
- [ ] Test runs without a live LLM, live Splunk, or live DB — confirmed by `make test` without env vars
- [ ] Node added to the graph in `packages/agent-core/graphs/<graph>.py` with explicit edges
- [ ] OTel span name and attributes match the §Step 9 contract
- [ ] No new `Dict[str, Any]` or `Optional` without default introduced
- [ ] `make check-fallbacks` passes
- [ ] `make check-cloud-defaults` passes (LLM nodes default to Ollama via the adapter, not direct cloud calls)

Cross-references: `splunk-mcp-adapter` for connector calls. `decision-trace-writing` for the trace wrapper. `zero-fallback-error-handling` for how nodes propagate connector errors. `semantic-telemetry-objects` for what counts as a valid LLM input.
