# ADR-004: Agentic Decision Engine

## Status
Accepted

## Date
2026-05-08

## Context
The platform uses LangGraph for agent orchestration. Each agent is a directed graph of nodes that process telemetry data and produce recommendations.

## Decision
1. **LangGraph as Orchestration**: Use LangGraph for state management and workflow
2. **Pure Function Nodes**: Each node is a pure function (state → state)
3. **Testable**: Every node must have fixture-based tests
4. **Versioned Graphs**: Each graph has semantic versioning

## Agent Types
1. **TelemetryValueAgent**: Incident triage (7 nodes)
   - incident_ingest → evidence_retrieval → correlation → reasoning_draft → confidence_score → approval_check → final_response

2. **TelemetryWasteAgent**: Cost optimization (6 nodes)
   - waste_ingest → waste_detection → reasoning_draft → waste_cost_score → approval_check → waste_final_response

## Consequences

### Positive
- Built-in state management
- Natural checkpointing
- Easy to test individual nodes
- Clear reasoning trace

### Negative
- Added orchestration complexity
- Debugging requires understanding graph structure

## Implementation
- Agent graphs in `packages/agent-core/src/graphs/`
- Node implementations in `packages/agent-core/src/nodes/`
- Prompt templates in `packages/prompts/`

## References
- High-Level Design Doc: Agent 1 & Agent 2 node definitions
- AGENTS.md Rule 5: Every LangGraph node has fixture-based tests