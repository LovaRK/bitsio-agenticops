---
name: using-bitsio-skills
description: Meta-skill that explains how the BitsIO skill pack works, when each skill activates, and how it composes with the addyosmani agent-skills generic pack. Use when starting a new session, when an agent is uncertain which skill applies, when adding a new BitsIO-specific skill, or when reviewing whether a slice loaded the right skills before producing code. Read this first if you are new to the repo.
---

# Using BitsIO Skills

## Overview

This repo ships two layers of skills:

1. **The addyosmani `agent-skills` generic pack** — twenty production-engineering skills (spec, plan, build, test, review, ship). Installed via OpenCode's marketplace; not vendored into this repo.
2. **The BitsIO-specific pack** — eight skills that encode the architectural laws, the local-first product shape, and the BitsIO-only patterns. Lives under `.opencode/skills/`.

Both layers follow the same anatomy (frontmatter → overview → when to use → core process → rationalizations → red flags → verification). They compose: addyosmani's `test-driven-development` tells you *how* to write tests; BitsIO's `langgraph-node-authoring` tells you *what* the test must cover for a graph node specifically.

## When to Use

**Use this skill when:**
- Starting a new OpenCode or Antigravity session in this repo
- An agent (or a developer) asks "which skill applies here?"
- Adding a new BitsIO-specific skill
- Reviewing a PR where the agent produced code without loading the right skills
- Onboarding someone new to the project

**Do NOT use this skill for:**
- Day-to-day implementation — load the specific skill for the task

## Core Process

### Step 1 — Read AGENTS.md first, always

`AGENTS.md` is the always-loaded master prompt. It contains the four laws, the ten rules, the locked stack, the phased build plan. Every session starts there. Do not deviate from `AGENTS.md` based on a skill — skills *implement* `AGENTS.md`, they don't override it.

### Step 2 — Identify the slice's surface area

Look at the request. What files will it touch? What systems does it cross? Use this map:

| Surface area | BitsIO skill to load | Generic addyosmani skill to load |
|---|---|---|
| `packages/connectors/splunk-mcp/` | `splunk-mcp-adapter` | `api-and-interface-design`, `test-driven-development` |
| `packages/agent-core/nodes/` | `langgraph-node-authoring` | `incremental-implementation`, `test-driven-development` |
| `packages/agent-core/state/` | `langgraph-node-authoring`, `semantic-telemetry-objects` | `api-and-interface-design` |
| `packages/decision-tracing/` | `decision-trace-writing` | `documentation-and-adrs`, `security-and-hardening` |
| `packages/agent-core/models/` | `local-first-runtime-inference` | `api-and-interface-design` |
| `packages/agent-core/guardian/` | `guardian-agent-checks` | `security-and-hardening` |
| `packages/shared/schemas/telemetry/` | `semantic-telemetry-objects` | `api-and-interface-design` |
| `prompts/graph-nodes/` | `langgraph-node-authoring` | (none generic) |
| `apps/web/` | (none BitsIO-specific) | `frontend-ui-engineering`, `test-driven-development` |
| `apps/api/` | `decision-trace-writing` (when touching trace endpoints), `local-first-runtime-inference` (when touching settings) | `api-and-interface-design`, `security-and-hardening` |
| `infra/docker/`, bootstrap scripts | `dev-runtime-ai-separation`, `local-first-runtime-inference` | `ci-cd-and-automation`, `shipping-and-launch` |
| `.opencode/`, project `opencode.json` | `dev-runtime-ai-separation` | (none) |
| Anything that catches an exception, calls an external system, or returns partial data | `zero-fallback-error-handling` | `debugging-and-error-recovery` |

### Step 3 — Load skills lazily, never speculatively

Use `skill <name>` only when the task touches that area. Don't preload everything "just in case." Each skill is 200–500 lines of context budget; loading three when one applies wastes tokens and dilutes attention.

If you're not sure which skill applies, load `using-bitsio-skills` (this one) and walk the table.

### Step 4 — Slash commands chain skills automatically

The seven slash commands in `.opencode/commands/` invoke the right skills for their phase:

| Command | Skills it loads |
|---|---|
| `/spec` | `spec-driven-development`, `documentation-and-adrs` |
| `/plan` | `planning-and-task-breakdown`, BitsIO-specific based on slice surface |
| `/build` | `incremental-implementation`, `test-driven-development`, plus BitsIO skills inferred from files touched |
| `/test` | `test-driven-development`, `debugging-and-error-recovery`, plus `zero-fallback-error-handling` |
| `/review` | `code-review-and-quality`, `security-and-hardening`, plus the architectural-law audit from the validator subagent |
| `/code-simplify` | `code-simplification` |
| `/ship` | `shipping-and-launch`, `ci-cd-and-automation`, plus `dev-runtime-ai-separation` for any image-build slice |

Use `/build` for the common case; use the others when the phase calls for them.

### Step 5 — When skills disagree, the BitsIO skill wins

Two examples:

**addyosmani `debugging-and-error-recovery`** suggests "use safe fallbacks where possible to avoid breaking the user experience." That's good general advice. **BitsIO `zero-fallback-error-handling`** says "never use canned data fallbacks; surface real errors." When they conflict, the BitsIO skill wins because we have explicit Rule 9.

**addyosmani `incremental-implementation`** suggests feature flags for partial rollouts. **BitsIO `decision-trace-writing`** prohibits in-place mutation of trace rows. They don't actually conflict — feature flags live in `customer_settings`, not in the trace tables.

The pattern: BitsIO skills are domain-specific specializations, not contradictions. Where they look like contradictions, the BitsIO skill is enforcing an architectural law and you go with it.

### Step 6 — Adding a new BitsIO skill

A new skill earns its place if **all three** are true:

1. It encodes a pattern that recurs in this codebase
2. It's specific enough that a generic skill can't cover it
3. Without it, agents will plausibly violate a law or rule

Format: same anatomy as the existing eight. Keep it under 500 lines. Cross-reference related skills. Add it to the table in §Step 2.

Don't create a skill for a one-off concern; put one-off guidance in the slice's PR description or in an ADR.

### Step 7 — Skills are workflows, not reference docs

Every BitsIO skill follows addyosmani's "process over prose" rule. If a section becomes a list of facts to know, move those facts to `references/` (project root) and link to them. Skills tell you *what to do step-by-step*, not *what is true in general*.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll just read the code and figure it out — skills are extra context." | Skills are how senior engineers transfer judgment to agents. Skipping them means re-deriving the design intent every session. Load the skill; the budget is small. |
| "I already know LangGraph — I don't need `langgraph-node-authoring`." | The skill encodes BitsIO's specific contract: pure functions, fixture pairs, prompt-loading discipline, OTel + decision-trace requirements. Generic LangGraph knowledge gets you to a working graph; the skill gets you to a shippable one. |
| "I'll write the new skill after I finish the slice — quicker that way." | New skills are evidence of new patterns. Writing them while the pattern is fresh prevents the next agent from rediscovering the lesson. Write the skill in the same PR. |
| "addyosmani's pack is enough — we don't need our own." | addyosmani covers software-engineering practice. It says nothing about Splunk MCP, semantic telemetry objects, decision-trace immutability, or the dev/runtime AI separation. Those are BitsIO-specific. Both packs together is the right amount. |
| "I'll skip the meta-skill — agents can figure out which skills to load." | Without this meta-skill, every new agent walks `.opencode/skills/` and guesses. The table here is the answer; load it once at session start. |

## Red Flags

- A slice that produces code without loading any BitsIO skill, despite touching `packages/agent-core/`, `packages/connectors/`, or `packages/decision-tracing/`
- A skill file longer than ~500 lines (decompose; reference material to `references/` if needed)
- A new skill duplicating ~40% of an existing skill (merge or cross-reference instead)
- Frontmatter `name` not matching the directory name
- A skill `description` that summarizes the workflow rather than stating *what* and *when*
- Skills loaded preemptively at session start (lazy-load only)
- A BitsIO skill that says the opposite of an architectural law (skill is wrong; fix it)

## Verification

Before declaring the slice done, confirm:

- [ ] AGENTS.md was respected — laws and rules referenced in the response
- [ ] Every BitsIO skill that the surface area indicated was loaded before code was written
- [ ] Generic addyosmani skills were loaded for cross-cutting concerns (testing, security, etc.)
- [ ] No skill was loaded that did not apply to the slice
- [ ] If a new pattern emerged, it's either: (a) already covered, (b) added as a new skill in this PR, or (c) explicitly noted as a one-off in the PR description
- [ ] Cross-references in any new skill point to existing skills by name (not by absolute path)
- [ ] Skill frontmatter `description` describes *what* and *when*, not *how*

Cross-references: every other skill in `.opencode/skills/` and the addyosmani pack at `https://github.com/addyosmani/agent-skills`.
