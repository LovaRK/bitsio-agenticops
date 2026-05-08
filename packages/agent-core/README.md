# Agent Core

Telemetry Value Agent graph flow:

```text
incident_ingest -> evidence_retrieval -> correlation ->
reasoning_draft -> confidence_score -> approval_check -> final_response
```

Run tests:

```bash
uv run pytest tests/unit/test_telemetry_nodes.py -q
```
