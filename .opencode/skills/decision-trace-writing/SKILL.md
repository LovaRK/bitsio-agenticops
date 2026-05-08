---
name: decision-trace-writing
description: Guides agents through any code that writes to decision_traces, node_runs, or approval_events. Use when adding the trace-write wrapper around a new node, when extending the trace schema, when implementing the approval-resume API, when computing or verifying workflow_hash, or when reviewing a slice for audit-trail integrity. Covers the append-only enforcement, the no-self-approval invariant, the synchronous-write rule, the model-provenance fields required by Rule 10, and the retention partitioning model.
---

# Decision-Trace Writing

## Overview

The decision-trace tables are the audit substrate of the entire product. They are append-only at the database level (the application role lacks `UPDATE` and `DELETE` privileges), they are written synchronously during workflow execution, and they record enough detail to replay any past decision and explain it to an auditor.

If the trace tables are inaccurate or incomplete, every recommendation the agent has ever produced becomes legally suspect. Get this layer right.

## When to Use

**Use this skill when:**
- Wrapping a new node with the trace-writing decorator/middleware
- Extending the schema of `decision_traces`, `node_runs`, or `approval_events`
- Implementing the `POST /api/v1/decision-traces/{workflow_id}/approvals` endpoint
- Computing, storing, or verifying `workflow_hash`
- Writing or reviewing migrations that touch any of the three trace tables
- Adding a new model-provenance field (Rule 10 visibility)

**Do NOT use this skill for:**
- Reading the trace tables for the analyst UI (use the read-only query layer in `apps/api/`)
- Operational concerns like backups or retention policy execution (see `docs/runbooks/retention.md`)

## Core Process

### Step 1 — Confirm the schema is unchanged or extended additively

ADR-003 defines three tables. Schema changes require:
- An Alembic migration in `packages/decision-tracing/migrations/`
- A new ADR (or an amendment to ADR-003) if the change is non-additive
- An update to the read query layer to preserve backward compatibility

Forbidden migrations:
- `DROP COLUMN` on any of the three tables
- `ALTER COLUMN ... NOT NULL` on existing data without a backfill
- Removing a `CHECK` constraint
- Removing the database role privilege model (the `bitsio_app` role must keep only `INSERT, SELECT`)

### Step 2 — Use the trace wrapper, never write rows directly from a node

Nodes do not call `INSERT INTO node_runs`. They are pure `(state) -> state`. The trace wrapper sits around the node:

```python
# packages/decision-tracing/wrapper.py
from datetime import datetime, timezone
import uuid
from typing import Callable
from agent_core.state.telemetry_state import TelemetryAgentState
from decision_tracing.repository import NodeRunRepository
from decision_tracing.hashing import canonical_state_hash

def traced(node: Callable[[TelemetryAgentState], TelemetryAgentState]):
    def wrapped(state: TelemetryAgentState) -> TelemetryAgentState:
        node_run_id = uuid.uuid4()
        started_at = datetime.now(timezone.utc)
        state_hash_in = canonical_state_hash(state)
        try:
            new_state = node(state)
            ended_at = datetime.now(timezone.utc)
            NodeRunRepository.insert(NodeRunRow(
                node_run_id=node_run_id,
                workflow_id=state.workflow_id,
                node_name=node.__name__,
                started_at=started_at,
                ended_at=ended_at,
                status="succeeded",
                state_hash_in=state_hash_in,
                state_hash_out=canonical_state_hash(new_state),
                tool_calls=new_state._pending_tool_calls,
                policy_checks=new_state._pending_policy_checks,
                model_provider=new_state.model_provenance.provider if new_state.model_provenance else None,
                model_id=new_state.model_provenance.model_id if new_state.model_provenance else None,
                inference_locale=new_state.model_provenance.inference_locale if new_state.model_provenance else None,
                tokens_in=new_state.model_provenance.tokens_in if new_state.model_provenance else None,
                tokens_out=new_state.model_provenance.tokens_out if new_state.model_provenance else None,
            ))
            return new_state
        except Exception as e:
            ended_at = datetime.now(timezone.utc)
            NodeRunRepository.insert(NodeRunRow(
                node_run_id=node_run_id,
                workflow_id=state.workflow_id,
                node_name=node.__name__,
                started_at=started_at,
                ended_at=ended_at,
                status="errored",
                state_hash_in=state_hash_in,
                state_hash_out=state_hash_in,  # state didn't change
                error_class=type(e).__name__,
                error_detail=structured_error_detail(e),
            ))
            raise  # propagate; let the workflow record status='errored'
    return wrapped
```

Every node in the graph is wrapped: `g.add_node("cost_computation", traced(cost_computation))`.

### Step 3 — Compute `workflow_hash` after the workflow commits

The hash is deterministic and verifiable on replay:

```python
# packages/decision-tracing/hashing.py
import hashlib
import json

def canonical_state_hash(state) -> str:
    canonical = json.dumps(
        state.model_dump(mode="json"),
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode()).hexdigest()

def workflow_hash(workflow_id: str, final_state, node_run_hashes: list[str]) -> str:
    h = hashlib.sha256()
    h.update(workflow_id.encode())
    h.update(canonical_state_hash(final_state).encode())
    for nrh in node_run_hashes:
        h.update(nrh.encode())
    return h.hexdigest()
```

The workflow finalization step writes `decision_traces.workflow_hash` after all `node_runs` are committed, in a separate transaction so concurrent reads see the row complete.

### Step 4 — Approval endpoint never trusts request-body identity

`POST /api/v1/decision-traces/{workflow_id}/approvals`:

```python
# apps/api/routes/approvals.py
from fastapi import APIRouter, Depends, HTTPException
from apps.api.auth import get_authenticated_principal

router = APIRouter()

@router.post("/decision-traces/{workflow_id}/approvals")
async def submit_approval(
    workflow_id: str,
    body: ApprovalRequest,
    principal: AuthenticatedPrincipal = Depends(get_authenticated_principal),
):
    trace = await DecisionTraceRepository.get(workflow_id)
    if trace is None:
        raise HTTPException(404, "workflow not found")

    # ENFORCED: approver_id comes from auth context, NEVER from body
    if principal.user_id == trace.initiator_id:
        raise HTTPException(403, "self-approval is forbidden")

    await ApprovalEventRepository.insert(ApprovalEventRow(
        approval_id=uuid.uuid4(),
        workflow_id=workflow_id,
        approver_id=principal.user_id,  # from JWT, not from body
        decision=body.decision,
        reason=body.reason,
        decided_at=datetime.now(timezone.utc),
    ))

    if body.decision == "approved":
        await GraphRunner.resume(workflow_id)
    elif body.decision == "rejected":
        await DecisionTraceRepository.set_status(workflow_id, "cancelled")

    return {"status": "recorded"}
```

The `ApprovalRequest` Pydantic model contains `decision` and `reason` only. It does NOT contain `approver_id`. Reviewers reject any diff where the body schema has an `approver_id` field.

### Step 5 — Database role privileges are the enforcement layer

In `packages/decision-tracing/migrations/000_role_privileges.sql`:

```sql
-- Application role: insert and read only
GRANT SELECT, INSERT ON decision_traces TO bitsio_app;
GRANT SELECT, INSERT ON node_runs TO bitsio_app;
GRANT SELECT, INSERT ON approval_events TO bitsio_app;
REVOKE UPDATE, DELETE ON decision_traces FROM bitsio_app;
REVOKE UPDATE, DELETE ON node_runs FROM bitsio_app;
REVOKE UPDATE, DELETE ON approval_events FROM bitsio_app;

-- Retention role: delete only on partitions older than the regulatory window
CREATE ROLE bitsio_retention NOINHERIT;
GRANT SELECT, DELETE ON decision_traces TO bitsio_retention;
-- (similar for node_runs, approval_events)
-- Application code never connects as bitsio_retention.
```

This is enforcement, not documentation. A bug in application code that tries to UPDATE will fail at the SQL boundary.

### Step 6 — Reversal is an append, not an edit

If an approval needs to be reversed (e.g., approver changes their mind, or admin override):

```python
# Correct: append a new event with decision='reverted'
await ApprovalEventRepository.insert(ApprovalEventRow(
    approval_id=uuid.uuid4(),
    workflow_id=workflow_id,
    approver_id=principal.user_id,
    decision="reverted",
    reason=f"reverts {previous_approval_id}: {reason}",
    decided_at=datetime.now(timezone.utc),
))
```

The original `approved` row is untouched. The audit trail shows both events with their timestamps.

### Step 7 — Errored workflows still write a complete trace

If a node raises, the `traced` wrapper writes the `node_runs` row with `status='errored'` and `error_detail` populated. Then the workflow finalizer writes `decision_traces.status='errored'`. We never have a workflow row without its node history, and we never have node history without a parent workflow row.

This is Rule 9 (zero-fallback) applied to the audit trail: a failed workflow is recorded as failed, not silently dropped.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll log the trace asynchronously to avoid latency." | Asynchronous trace writes mean an in-flight workflow can complete before its trace is durable. If the process dies between completion and trace flush, the audit trail is corrupt. The latency budget for synchronous writes is acceptable; node runs are seconds, not microseconds. |
| "Let the API accept `approver_id` in the body for testing." | Test fixtures provide test JWTs; tests authenticate properly. Accepting `approver_id` from the body in any code path opens a self-approval bypass that auditors will find. Rule 10 plus Law 4. |
| "I'll add an UPDATE to fix a typo in the reason field." | No UPDATE on these tables, ever. If a reason has a typo, append a new event with `decision='reverted'` and the correct reason. Reviewers and auditors see the history; that's the point. |
| "The hash function is too slow, let me memoize across requests." | The hash is deterministic and per-state. Memoization across requests means returning a hash for state X when called with state Y if there's any cache-key bug. Compute fresh; the cost is negligible. |
| "I'll skip writing a node_run if the node was a no-op." | "No-op" is not a property of a node; it's a property of a state transition. `state_hash_in == state_hash_out` is fine to record — the auditor wants to see "node ran, made no changes" not "node missing from trace, was something skipped?" |
| "Migrations should drop unused columns to keep the schema clean." | Append-only applies to schema too. A dropped column means historical traces lose interpretability. Add a deprecation note, leave the column, ignore it on new rows. After 7+ years past the regulatory horizon, an ADR can authorize cleanup. |

## Red Flags

- Any code in `packages/agent-core/nodes/` that imports `decision_tracing.repository` directly (nodes never write traces themselves)
- An UPDATE or DELETE statement targeting `decision_traces`, `node_runs`, or `approval_events` in any application code
- An `ApprovalRequest` Pydantic model with an `approver_id` or `user_id` field
- An `await` on the trace write that is not in a `try/finally` or `with` block — the trace must be durable before the response returns
- A `node_runs` row written without `correlation_id`, `workflow_id`, or `state_hash_in/out`
- An LLM-calling node where the trace lacks `model_provider`, `model_id`, or `inference_locale`
- A `workflow_hash` recomputed at read time rather than written once at workflow finalization
- A migration that DROPs a column or REVOKES the immutability privileges

## Verification

Before declaring the slice done:

- [ ] Every node in the graph is wrapped with `traced(...)`
- [ ] Every successful node run writes a `node_runs` row with `status='succeeded'`
- [ ] Every errored node writes a `node_runs` row with `status='errored'` and structured `error_detail`
- [ ] Every workflow gets a `decision_traces` row with `status` reflecting its final state
- [ ] LLM-calling nodes populate `model_provider`, `model_id`, `inference_locale`, `tokens_in`, `tokens_out`
- [ ] `workflow_hash` is computed and stored after node runs commit
- [ ] Approval endpoint extracts `approver_id` from auth context, never from request body
- [ ] DB CHECK constraint `approver_id != initiator_id` is in place (or an equivalent app-level check covers it)
- [ ] Migrations grant `SELECT, INSERT` only to the application role; `UPDATE` and `DELETE` are revoked
- [ ] No code path writes to these tables without the wrapper or the approval endpoint
- [ ] `make test` includes a test that asserts the wrapper writes both the success and the failure paths
- [ ] Replay test: take a fixture state, run the workflow, recompute `workflow_hash`, assert equality

Cross-references: `langgraph-node-authoring` for the node side. `local-first-runtime-inference` for the model-provenance fields. `zero-fallback-error-handling` for the structured error detail format.
