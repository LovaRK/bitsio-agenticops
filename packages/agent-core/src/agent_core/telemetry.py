from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from opentelemetry import trace


@contextmanager
def node_span(
    node_name: str, workflow_id: str, graph_name: str, graph_version: str, env: str
) -> Iterator[None]:
    tracer = trace.get_tracer("agent-core")
    with tracer.start_as_current_span(f"node:{node_name}") as span:
        span.set_attribute("service.name", "agent-runtime")
        span.set_attribute("graph.name", graph_name)
        span.set_attribute("graph.version", graph_version)
        span.set_attribute("node.name", node_name)
        span.set_attribute("workflow_id", workflow_id)
        span.set_attribute("tenant.safe_id", "tenant_demo")
        span.set_attribute("env", env)
        yield
