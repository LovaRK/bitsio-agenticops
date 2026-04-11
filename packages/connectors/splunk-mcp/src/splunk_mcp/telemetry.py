from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from opentelemetry import trace


@contextmanager
def connector_span(name: str, workflow_id: str, graph_name: str, env: str) -> Iterator[None]:
    tracer = trace.get_tracer("splunk-mcp")
    with tracer.start_as_current_span(name) as span:
        span.set_attribute("service.name", "splunk-mcp")
        span.set_attribute("graph.name", graph_name)
        span.set_attribute("workflow_id", workflow_id)
        span.set_attribute("env", env)
        yield
