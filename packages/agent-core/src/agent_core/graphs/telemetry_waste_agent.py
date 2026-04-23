"""
TelemetryWasteAgentGraph
========================
Detects and quantifies wasted Splunk data ingestion.

Graph: 6 nodes (all OTel-instrumented)
  1. waste_ingest        — parse raw index profiles into SourceTypeProfile objects
  2. waste_detection     — identify wasteful sources (zero search + high ingest)
  3. reasoning_draft     — LLM generates narrative from findings
  4. waste_cost_score    — confidence score + WasteRecommendation list
  5. approval_check      — policy gate (same rules as incident triage)
  6. waste_final_response — assemble TelemetryWasteFinalOutput

Usage:
    graph = TelemetryWasteAgentGraph(splunk_adapter=adapter, model_adapter=model)
    state = TelemetryWasteAgentState(workflow_id="wf_waste_001", tenant_id="acme_corp")
    state.raw_index_profiles = [...]
    state.raw_search_activity = [...]
    state.raw_field_stats = [...]
    result = graph.run(state)
    print(result.final_output.estimated_annual_savings_usd)
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from agent_core.models.adapter import ModelAdapter, StubModelAdapter
from agent_core.nodes.waste_cost_score import waste_cost_score
from agent_core.nodes.waste_detection import waste_detection
from agent_core.nodes.waste_final_response import waste_final_response
from agent_core.nodes.waste_ingest import waste_ingest
from agent_core.policies.evaluator import PolicyEvaluator
from agent_core.state.waste_state import TelemetryWasteAgentState
from agent_core.telemetry import node_span
from splunk_mcp.adapter import SplunkMCPAdapter

_GRAPH_NAME = "telemetry_waste_agent"
_GRAPH_VERSION = "v1.0.0"
_RULES_DIR = Path("packages/agent-core/src/agent_core/policies/rules")
_PROMPT_PATH = Path("packages/prompts/graph-nodes/waste_reasoning.txt")

# Splunk queries for waste analysis (run against live or mock Splunk)
_SEARCH_FIELD_STATS = (
    "search index=* earliest=-90d latest=now "
    "| eval event_bytes=len(_raw) "
    "| stats count AS total_events sum(event_bytes) AS total_bytes min(_time) AS first_seen max(_time) AS last_seen BY index, sourcetype "
    "| eval observed_days=if(last_seen>first_seen, max(1, round((last_seen-first_seen)/86400,2)), 1) "
    "| eval daily_ingest_gb=round((total_bytes/1024/1024/1024)/observed_days,6) "
    "| rename sourcetype AS source_type "
    "| fields index, source_type, daily_ingest_gb, total_events, total_bytes, observed_days"
)
_SEARCH_USAGE_ACTIVITY = (
    "index=_audit action=search earliest=-90d latest=now "
    '| rex field=search "sourcetype=(?<source_type>[^\\s|]+)" '
    "| stats count AS search_count_90d BY source_type "
    "| where isnotnull(source_type)"
)
_SEARCH_USAGE_BY_INDEX = (
    "index=_audit action=search earliest=-90d latest=now "
    '| rex field=search "index=(?<index_name>[^\\s|]+)" '
    "| stats count AS search_count_90d BY index_name "
    "| where isnotnull(index_name)"
)


@dataclass
class TelemetryWasteAgentGraph:
    """
    Agent graph for Splunk telemetry waste detection.

    Can operate in two modes:
      - live:  queries Splunk directly via splunk_adapter (set fetch_from_splunk=True)
      - batch: caller pre-populates state.raw_* fields (default, good for tests)
    """

    splunk_adapter: SplunkMCPAdapter
    model_adapter: ModelAdapter = field(default_factory=StubModelAdapter)
    policy_evaluator: PolicyEvaluator | None = None
    search_window_days: int = 90
    fetch_from_splunk: bool = False

    def run(
        self,
        state: TelemetryWasteAgentState,
        *,
        environment: str = "dev",
        action_type: str = "read",
    ) -> TelemetryWasteAgentState:
        env = environment or os.getenv("ENV", "dev")
        wf_id = state.workflow_id

        span_kwargs = dict(
            workflow_id=wf_id,
            graph_name=_GRAPH_NAME,
            graph_version=_GRAPH_VERSION,
            env=env,
        )

        # ── Optional: hydrate raw profiles from live Splunk ────────────────
        if self.fetch_from_splunk:
            with node_span("splunk_index_scan", **span_kwargs):
                state = self._fetch_from_splunk(state)

        # ── Node 1: parse profiles ─────────────────────────────────────────
        with node_span("waste_ingest", **span_kwargs):
            current = waste_ingest(state)

        # ── Node 2: identify wasteful sources ─────────────────────────────
        with node_span("waste_detection", **span_kwargs):
            current = waste_detection(current)

        # ── Node 3: LLM reasoning draft ────────────────────────────────────
        with node_span("reasoning_draft", **span_kwargs):
            current = self._reasoning_draft(current)

        # ── Node 4: cost scoring + recommendations ─────────────────────────
        with node_span("waste_cost_score", **span_kwargs):
            current = waste_cost_score(current)

        # ── Node 5: approval gate ──────────────────────────────────────────
        with node_span("approval_check", **span_kwargs):
            # Reuse the incident approval_check node — same policy rules apply
            # Bridge: create a minimal proxy state compatible with approval_check
            current = self._run_approval_check(current, environment=env, action_type=action_type)

        # ── Node 6: final response ─────────────────────────────────────────
        with node_span("waste_final_response", **span_kwargs):
            current = waste_final_response(current)

        return current

    # ── Private helpers ────────────────────────────────────────────────────

    def _fetch_from_splunk(self, state: TelemetryWasteAgentState) -> TelemetryWasteAgentState:
        """Query Splunk for index stats and search activity."""
        next_state = state.model_copy(deep=True)
        try:
            window_days = max(1, int(self.search_window_days))
            earliest = f"-{window_days}d"
            index_meta = self.splunk_adapter.list_indexes()
            index_retention_days: dict[str, int] = {}
            index_size_mb: dict[str, float] = {}
            for item in index_meta:
                index_size_mb[item.name] = float(item.size_mb or 0.0)
                # Retention is not always exposed; keep safe default.
                index_retention_days[item.name] = 90

            index_result = self.splunk_adapter.run_search(
                query=_SEARCH_FIELD_STATS, earliest=earliest, latest="now"
            )
            mapped_profiles: list[dict[str, Any]] = []
            for row in index_result.results:
                source_type = str(
                    row.get("source_type")
                    or row.get("sourcetype")
                    or row.get("source")
                    or "unknown"
                )
                index_name = str(row.get("index") or "main")
                query_daily_ingest_gb = float(row.get("daily_ingest_gb") or 0.0)
                size_mb = index_size_mb.get(index_name, 0.0)
                size_daily_ingest_gb = round((size_mb / 1024.0) / 30.0, 6) if size_mb > 0 else 0.0
                daily_ingest_gb = max(query_daily_ingest_gb, size_daily_ingest_gb)

                # If query returns no daily estimate, derive a rough baseline from index size.
                if daily_ingest_gb <= 0:
                    daily_ingest_gb = round((size_mb / 1024.0) / 30.0, 6) if size_mb > 0 else 0.0

                mapped_profiles.append(
                    {
                        "source_type": source_type if source_type != "unknown" else index_name,
                        "index": index_name,
                        "daily_ingest_gb": daily_ingest_gb,
                        "retention_days": index_retention_days.get(index_name, 90),
                    }
                )

            # Fallback: if Splunk search returned nothing, still build profiles from index metadata.
            if not mapped_profiles:
                mapped_profiles = [
                    {
                        "source_type": item.name,
                        "index": item.name,
                        "daily_ingest_gb": round((float(item.size_mb or 0.0) / 1024.0) / 30.0, 6),
                        "retention_days": 90,
                    }
                    for item in index_meta
                ]

            next_state.raw_index_profiles = mapped_profiles

            activity_result = self.splunk_adapter.run_search(
                query=_SEARCH_USAGE_ACTIVITY, earliest=earliest, latest="now"
            )
            activity_by_sourcetype = [
                {
                    "source_type": str(
                        row.get("source_type") or row.get("sourcetype") or "unknown"
                    ),
                    "search_count_90d": int(
                        row.get("search_count_90d") or row.get("search_count") or 0
                    ),
                    "dashboard_references": int(row.get("dashboard_references") or 0),
                    "alert_references": int(row.get("alert_references") or 0),
                }
                for row in activity_result.results
            ]

            activity_index_result = self.splunk_adapter.run_search(
                query=_SEARCH_USAGE_BY_INDEX, earliest=earliest, latest="now"
            )
            activity_by_index = [
                {
                    "index": str(row.get("index_name") or row.get("index") or "unknown"),
                    "search_count_90d": int(
                        row.get("search_count_90d") or row.get("search_count") or 0
                    ),
                    "dashboard_references": 0,
                    "alert_references": 0,
                }
                for row in activity_index_result.results
            ]

            next_state.raw_search_activity = [*activity_by_sourcetype, *activity_by_index]
        except Exception as exc:
            next_state.missing_evidence.append(f"splunk_query_error:{exc}")
        return next_state

    def _reasoning_draft(self, state: TelemetryWasteAgentState) -> TelemetryWasteAgentState:
        """Load waste reasoning prompt and call model adapter."""
        next_state = state.model_copy(deep=True)
        try:
            template = _PROMPT_PATH.read_text(encoding="utf-8")
        except FileNotFoundError:
            template = (
                "Analyze Splunk telemetry waste:\n"
                "Wasteful sources: {wasteful_count}\n"
                "Top offender: {top_source} at {top_gb} GB/day\n"
                "Total daily waste: {total_wasted_gb} GB\n"
                "Findings: {findings}\n"
                "Provide concise cost-reduction analysis."
            )

        top = state.wasteful_sources[0] if state.wasteful_sources else None
        prompt = template.format(
            wasteful_count=len(state.wasteful_sources),
            top_source=top.source_type if top else "none",
            top_gb=f"{top.daily_ingest_gb:.1f}" if top else "0",
            total_wasted_gb=f"{sum(p.daily_ingest_gb for p in state.wasteful_sources):.1f}",
            findings="; ".join(state.correlation_findings) or "none",
            tenant_id=state.tenant_id,
        )

        next_state.reasoning_draft = self.model_adapter.generate(prompt)
        return next_state

    def _run_approval_check(
        self,
        state: TelemetryWasteAgentState,
        environment: str,
        action_type: str,
    ) -> TelemetryWasteAgentState:
        """
        Apply approval policy. We proxy through the standard approval_check node
        by temporarily adapting waste state fields.
        """
        next_state = state.model_copy(deep=True)
        evaluator = self.policy_evaluator or PolicyEvaluator(_RULES_DIR)

        checks = evaluator.evaluate(
            {
                "environment": environment,
                "confidence": next_state.confidence,
                "action_type": action_type,
            }
        )
        matched = [c for c in checks if c.matched and c.action == "require_approval"]
        next_state.approval_required = len(matched) > 0
        next_state.guardrail_notes = [f"{c.rule_id}:{c.note}" for c in matched]
        next_state.policy_checks = [c.model_dump() for c in checks]
        return next_state
