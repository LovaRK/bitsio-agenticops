# OTel Tag Matrix

All spans must include:

- `service.name`
- `graph.name`
- `graph.version`
- `node.name` (node-level spans)
- `workflow_id`
- `tenant.safe_id`
- `env`
- `model.provider` (LLM nodes only)

## Example Span Attributes

```json
{
  "service.name": "agent-runtime",
  "graph.name": "telemetry_value_agent",
  "graph.version": "v1.0.0",
  "node.name": "reasoning_draft",
  "workflow_id": "wf_20260408_0001",
  "tenant.safe_id": "tenant_demo",
  "env": "dev",
  "model.provider": "anthropic"
}
```
