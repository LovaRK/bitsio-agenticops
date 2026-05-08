from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from opentelemetry import trace


@contextmanager
def node_span(
    node_name: str,
    workflow_id: str,
    graph_name: str,
    graph_version: str,
    env: str,
    model_provider: str | None = None,
    model_mode: str | None = None,
    model_user_opt_in: bool | None = None,
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
        if model_provider:
            span.set_attribute("model.provider", model_provider)
        if model_mode:
            span.set_attribute("model.mode", model_mode)
        if model_user_opt_in is not None:
            span.set_attribute("model.user_opt_in", model_user_opt_in)
        yield
