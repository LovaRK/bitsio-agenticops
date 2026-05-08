---
name: guardian-agent-checks
description: Guides agents through implementing the runtime Guardian Agent that wraps every workflow execution. Use when adding a new check (prompt-injection, RBAC, outbound-request, unsafe SPL, secret exposure, jailbreak, signed-package verification), when extending the policy YAML rules, or when reviewing whether a Guardian check correctly halts a workflow. The Guardian is the runtime enforcement layer for Architectural Laws 1–4 and Rules 9–10 — it is mandatory on every workflow run and may not be skipped, deferred, or sampled.
---

# Guardian Agent Checks

## Overview

The Guardian Agent is a runtime safety net inside the customer's deployed bundle. It wraps every workflow execution and runs a fixed set of checks before, during, and after the graph executes. It is the runtime equivalent of the validator subagent (which is build-time) — but here, in the customer's environment, the stakes include real telemetry data, real RBAC boundaries, and real audit obligations.

If the Guardian halts a workflow, the workflow is halted. There is no "soft mode" or "warn-only" — if a check fires, the trace records the failure and the workflow does not produce a recommendation.

## When to Use

**Use this skill when:**
- Adding a new check class to `packages/agent-core/guardian/`
- Modifying the guardian wrapper in `packages/agent-core/guardian/wrapper.py`
- Extending policy YAML rules in `packages/agent-core/policies/rules/`
- Reviewing a slice that bypasses or weakens any existing check
- Implementing the signed-skill-pack verification on bundle startup

**Do NOT use this skill for:**
- Build-time validation (use the validator subagent and `make` checks)
- Application-level RBAC for the analyst dashboard (that's auth middleware in `apps/api/`)

## Core Process

### Step 1 — The Guardian wraps the graph, not individual nodes

```python
# packages/agent-core/guardian/wrapper.py
def guarded(graph: StateGraph) -> StateGraph:
    """
    Wrap a graph with Guardian checks. Adds pre, mid, and post hooks.
    """
    return GraphWithGuardian(
        graph,
        pre_checks=[
            SignedSkillPackCheck(),
            SecretExposureCheck(),
            CustomerSettingsIntegrityCheck(),
        ],
        per_node_checks=[
            PromptInjectionCheck(),
            UnsafeSPLCheck(),
            RawDataLeakCheck(),
            RBACCheck(),
            OutboundRequestCheck(),
        ],
        post_checks=[
            DecisionTraceIntegrityCheck(),
            ApprovalGateCheck(),
            ModelProvenanceCheck(),
        ],
    )
```

Every workflow invocation goes through `guarded(...)`. The Guardian runs even when the workflow is a replay; replays must produce identical Guardian outcomes.

### Step 2 — Each check is a class with a fixed contract

```python
# packages/agent-core/guardian/checks/base.py
from abc import ABC, abstractmethod
from typing import Literal
from pydantic import BaseModel

class GuardianCheckResult(BaseModel):
    check_name: str
    outcome: Literal["pass", "halt", "warn"]
    reason: str | None = None
    detected_at: str   # phase: "pre" | "mid:<node>" | "post"
    correlation_id: str

class GuardianCheck(ABC):
    name: str

    @abstractmethod
    def evaluate(self, ctx: GuardianContext) -> GuardianCheckResult: ...
```

**Outcomes:**
- `pass` — proceed
- `halt` — workflow stops; trace records `status='halted_by_guardian'` with the failing check and reason
- `warn` — workflow proceeds but a `node_runs.policy_checks[]` entry records the warning

There is no `disabled` outcome. A check exists or it doesn't.

### Step 3 — The mandatory checks (MVP)

#### 3.1 PromptInjectionCheck
Inspects the rendered prompt right before it goes to `adapter.invoke()`. Detects:
- Strings that match common injection markers (`"ignore previous instructions"`, `"system:"`, `"]]>"`, etc.) appearing in interpolated user data
- Customer-controlled fields (e.g., a Splunk `_raw` field that should never be there) leaking into the prompt
- More than 1 `{` `}` template fill imbalance (truncated template)

Halts if anything matches. Records the offending substring (truncated to 256 chars) for audit.

#### 3.2 UnsafeSPLCheck
Inspects every SPL string the adapter is about to send. Forbids:
- Write commands: `outputlookup`, `outputcsv`, `collect`, `delete`, `kvstore`, `summaryindex`
- Cross-tenant index access: `index=*` or wildcards that span tenants
- Long-running search shapes that bypass `tstats`/`stats` aggregations

Halts if anything matches. The connector layer's static SPL templates are pre-approved; user-influenced SPL (e.g., from a Settings field) is what this check exists for.

#### 3.3 RawDataLeakCheck
Mirrors `semantic-telemetry-objects` Step 7 at runtime. Inspects every prompt about to go to the LLM and asserts the payload was assembled from `.model_dump_json()` of known semantic types — not from `dict`, `Any`, or raw strings.

Implementation: tag every prompt with the source-Pydantic-class; the check verifies the tag is on the allow list.

#### 3.4 RBACCheck
Verifies the calling principal (analyst identity from JWT) has the right capability for the workflow being executed. The capability list is in `packages/agent-core/policies/rules/rbac.yaml`:

```yaml
# packages/agent-core/policies/rules/rbac.yaml
capabilities:
  telemetry_value_agent_run:
    required_roles: [finops_analyst, platform_lead, splunk_admin]
  approval_submit:
    required_roles: [platform_lead, security_lead, splunk_admin]
    forbidden_self_approval: true   # enforced via DB CHECK as well; double-checked here
```

Halts if the principal lacks the required role.

#### 3.5 OutboundRequestCheck
Wraps the HTTP client used by the cloud adapter and the connector retry layer. Verifies every outbound URL against an allow list:

```yaml
# packages/agent-core/policies/rules/outbound.yaml
allowed_hosts:
  - "${SPLUNK_MCP_HOST}"     # customer's Splunk MCP server
  - "api.anthropic.com"      # only when cloud_inference_enabled=True with Anthropic
  - "api.openai.com"         # only when cloud_inference_enabled=True with OpenAI
  - "${OLLAMA_HOST}"         # local
  - "github.com"             # for update pulls
  - "raw.githubusercontent.com"
  - "ghcr.io"

forbidden_hosts_at_runtime:
  - "openrouter.ai"          # dev-only; must never appear in customer runtime
  - "*.litellm.ai"
```

Halts on any unlisted host. The forbidden list catches mis-configurations where a dev-time provider leaks into the runtime.

#### 3.6 SecretExposureCheck
Scans every prompt and every error_detail for patterns that look like credentials:
- AWS access keys (`AKIA[0-9A-Z]{16}`)
- API key shapes (`sk-[a-zA-Z0-9]{40,}`)
- JWT-shaped strings
- Lines that look like `Authorization: Bearer ...`

If found in a prompt: halt. If found in error_detail: redact before persisting to the trace, and `warn`.

#### 3.7 SignedSkillPackCheck
Runs at startup. Verifies the prompts and policy YAMLs have not been tampered with. The packaged bundle ships with:
- A signed manifest of file hashes for `prompts/` and `packages/agent-core/policies/rules/`
- The BitsIO public verification key

If hashes don't match the manifest: refuse to start. The customer cannot edit prompts or policy rules without re-signing — and they don't have the BitsIO private key.

#### 3.8 DecisionTraceIntegrityCheck
Post-workflow check: confirms `workflow_hash` matches the recomputed hash, and that every node in the graph wrote a `node_runs` row.

#### 3.9 ApprovalGateCheck
Post-workflow check: if the workflow's recommendation triggers any policy with `require_approval: true`, the trace must contain a non-self approval event before the workflow status flips to `'succeeded'`. Otherwise: halt and mark `'awaiting_approval'`.

#### 3.10 ModelProvenanceCheck
Post-node check on every LLM-calling node: confirms `inference_locale`, `model_provider`, and `model_id` are populated on the `node_runs` row. Missing fields halt the workflow with a Rule 10 violation reason.

#### 3.11 CustomerSettingsIntegrityCheck
At startup: confirms the `customer_settings` rows are well-formed and the cloud-opt-in invariant holds (if `cloud_inference_enabled=True`, then `cloud_provider_api_key` is non-empty in the secrets store).

#### 3.12 BootstrapValidator (refuse-to-start gate)

Runs **before any service accepts traffic**. Aggregates a fixed set of preconditions and refuses to start the bundle if any fail. This is the single gate that turns "agent silently runs degraded" into "agent reports its actual state."

Checks (each must pass; `warn` not allowed at startup):

- **Hardware**: available RAM ≥ 16 GB; available disk ≥ 100 GB free; if hardware below tier minimum, refuse with the explicit detected number
- **Local model availability**: `ollama list` includes the configured `local_model_id` and `embeddinggemma:300m`; if not, refuse and print the `ollama pull` command the customer must run
- **Splunk MCP reachability**: `splunk_list_indexes` returns successfully within 10 s; if not, refuse and surface the error class (auth / network / unauthorized)
- **Postgres + pgvector**: connection succeeds; `pgvector` extension is present; the `bitsio_app` role's privilege matrix matches the expected `INSERT, SELECT` only on trace tables (no UPDATE, no DELETE)
- **Redis**: `PING` returns `PONG`
- **Signing certificates**: BitsIO public verification key present at the expected path; `prompts/` and `policies/rules/` manifests verify cleanly (delegates to `SignedSkillPackCheck`)
- **Guardian self-check**: every check class in this skill instantiates without error; the per-node check list is non-empty
- **OIDC / auth**: discovery URL reachable when configured; if discovery fails, surface and refuse
- **Decision-trace migration head**: Alembic head matches the bundled head; if a migration is pending, refuse until `make migrate-up` runs

Output on failure is structured and visible:

```
BitsIO bootstrap REFUSED.

  ✗ ollama_model_available     gemma4:26b-a4b not found in local Ollama
       remediation: run `ollama pull gemma4:26b-a4b` and restart
  ✗ splunk_mcp_reachable       401 from MCP at https://...:8089
       remediation: rotate the MCP token; see docs/runbooks/auth.md

10 of 12 checks passed. Bundle did not start.
```

The customer reads what failed and what to do. There is no degraded-mode startup. There is no warning-only mode. The bundle either runs in a known-good state or it does not run.

### Step 4 — Halts produce honest trace rows

When the Guardian halts a workflow:

```sql
INSERT INTO decision_traces (
  workflow_id, status, ...
) VALUES (
  $1, 'halted_by_guardian', ...
);

INSERT INTO node_runs (
  workflow_id, node_name, status, error_class, error_detail
) VALUES (
  $1, 'guardian:<check_name>', 'errored',
  'GuardianCheckFailed',
  '{"check": "<name>", "reason": "<reason>", "phase": "<phase>"}'
);
```

The UI renders the halt with the check name and remediation. The user knows exactly what tripped and how to address it. This is Rule 9 applied to runtime safety.

### Step 5 — Adding a new check follows the canonical shape

```python
# packages/agent-core/guardian/checks/example_check.py
from agent_core.guardian.checks.base import GuardianCheck, GuardianCheckResult, GuardianContext

class ExampleCheck(GuardianCheck):
    name = "example_check"

    def evaluate(self, ctx: GuardianContext) -> GuardianCheckResult:
        if <bad condition>:
            return GuardianCheckResult(
                check_name=self.name,
                outcome="halt",
                reason="explicit description of what was detected",
                detected_at=ctx.phase,
                correlation_id=ctx.correlation_id,
            )
        return GuardianCheckResult(
            check_name=self.name,
            outcome="pass",
            detected_at=ctx.phase,
            correlation_id=ctx.correlation_id,
        )
```

Tests for the new check live in `tests/unit/guardian/test_example_check.py` and cover at minimum: a passing case and every halting case the check claims to catch. No new check ships without tests.

### Step 6 — Policy YAML is signed; runtime customers cannot edit

Customers **must not** edit `packages/agent-core/policies/rules/*.yaml` in their bundle. The signed-skill-pack check refuses to start if any rule file's hash differs from the manifest. Updates flow through GitHub release pulls, which include a new signed manifest. Customer-specific overrides go in `customer_settings` (the editable table), not in the policy files (the IP).

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Some checks are noisy — let me add a flag to disable them in dev." | Build-time tests run in dev; the Guardian runs in customer environments. There is no dev/prod toggle for runtime checks. If a check is noisy, the check is wrong; fix it or remove it. |
| "Let me make halts into warns until the team is comfortable." | "Until comfortable" never ends. A halt that halts wrong is a bug to fix; a halt downgraded to a warn is a security promise broken. Halts halt. |
| "I'll skip OutboundRequestCheck for the LLM client — it's already going through litellm." | litellm can route to any provider configured. The Guardian is the layer that confirms the URL is on the allowed list at the moment of dispatch. Don't skip. |
| "I'll keep the unsigned policy rules editable so customers can tune them." | Tunability lives in `customer_settings`. Policy rules are IP and audit-relevant; they ship signed. Customer changes go through their settings, not by editing files inside the container. |
| "PromptInjectionCheck false-positives sometimes — I'll lower the sensitivity." | Tighten the patterns and add tests for the false positives so they don't regress. Lowering sensitivity opens injection paths. |
| "My new check should run only on production tenants." | The Guardian runs on every workflow. Tenant-specific behavior comes from `customer_settings`, not from selectively running checks. |

## Red Flags

- A check class with an `outcome` other than `pass`, `halt`, or `warn`
- A check with a constructor argument like `enabled=True` or `mode='warn'`
- A graph wired without `guarded(...)` wrapping
- A new outbound HTTP call that doesn't go through the wrapped client
- A prompt fill that bypasses the `RawDataLeakCheck` allow list
- A halt that does not write a corresponding `node_runs` row
- Policy YAML edited without re-signing the manifest
- A new check without tests in `tests/unit/guardian/`
- A check that catches its own exceptions and returns `pass`

## Verification

Before declaring the slice done:

- [ ] Every workflow execution path runs through `guarded(graph)`
- [ ] Each new check has a class in `packages/agent-core/guardian/checks/`
- [ ] Each new check has a unit test in `tests/unit/guardian/` covering pass + every halt path
- [ ] Halts produce both a `decision_traces.status='halted_by_guardian'` row and a `node_runs` row with `error_class='GuardianCheckFailed'`
- [ ] Policy YAML changes are accompanied by a manifest-resign step in the build
- [ ] OutboundRequestCheck's allow list does not contain dev-only hosts (`openrouter.ai`, `*.litellm.ai` if dev-only)
- [ ] PromptInjectionCheck and RawDataLeakCheck run before every LLM dispatch
- [ ] ModelProvenanceCheck runs after every LLM-calling node
- [ ] SignedSkillPackCheck runs at bundle startup; mismatch refuses to start
- [ ] No check has a `enabled` flag; checks exist or they don't
- [ ] UI renders Guardian halts with the check name and remediation text
- [ ] `make test` exercises a full graph run with each Guardian halt path simulated

Cross-references: `decision-trace-writing` for the trace-row shape on halt. `local-first-runtime-inference` for `ModelProvenanceCheck`. `dev-runtime-ai-separation` for the OutboundRequestCheck forbidden-hosts list.
