from __future__ import annotations

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor


def test_otel_smoke() -> None:
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)

    tracer = trace.get_tracer("bitsio-smoke")
    with tracer.start_as_current_span("smoke") as span:
        span.set_attribute("service.name", "agent-runtime")
        span.set_attribute("graph.name", "telemetry_value_agent")
        span.set_attribute("graph.version", "v1.0.0")
        span.set_attribute("node.name", "smoke")
        span.set_attribute("workflow_id", "wf_smoke")
        span.set_attribute("tenant.safe_id", "tenant_demo")
        span.set_attribute("env", "dev")

    assert True
