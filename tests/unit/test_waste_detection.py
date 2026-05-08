"""
Unit tests for the Telemetry Waste Detection agent.

Tests cover:
  - waste_ingest: profile parsing, missing evidence flags, cost calculation
  - waste_detection: threshold logic, sorting by ingest volume, active-source exclusion
  - waste_cost_score: savings calculation, confidence formula, recommendation generation
  - waste_final_response: summary assembly, approval gate halt, zero-waste path
  - TelemetryWasteAgentGraph: happy-path end-to-end with Cisco ASA demo fixture
"""

from __future__ import annotations

import json
from pathlib import Path

from agent_core.graphs.telemetry_waste_agent import TelemetryWasteAgentGraph
from agent_core.models.adapter import StubModelAdapter
from agent_core.nodes.waste_cost_score import waste_cost_score
from agent_core.nodes.waste_detection import waste_detection
from agent_core.nodes.waste_final_response import waste_final_response
from agent_core.nodes.waste_ingest import waste_ingest
from agent_core.state.waste_state import SourceTypeProfile, TelemetryWasteAgentState

FIXTURE_DIR = Path(__file__).parent.parent / "fixtures" / "waste_detection"


def _load_demo() -> dict:
    return json.loads((FIXTURE_DIR / "cisco_asa_demo.json").read_text(encoding="utf-8"))


def _demo_state() -> TelemetryWasteAgentState:
    demo = _load_demo()
    return TelemetryWasteAgentState(
        workflow_id=demo["workflow_id"],
        tenant_id=demo["tenant_id"],
        raw_index_profiles=demo["raw_index_profiles"],
        raw_search_activity=demo["raw_search_activity"],
        raw_field_stats=demo["raw_field_stats"],
    )


# ── waste_ingest ──────────────────────────────────────────────────────────────


def test_waste_ingest_creates_profiles() -> None:
    state = _demo_state()
    result = waste_ingest(state)
    assert len(result.source_profiles) == 7
    source_types = [p.source_type for p in result.source_profiles]
    assert "cisco:asa" in source_types
    assert "windows:security" in source_types


def test_waste_ingest_merges_search_activity() -> None:
    state = _demo_state()
    result = waste_ingest(state)
    asa = next(p for p in result.source_profiles if p.source_type == "cisco:asa")
    assert asa.search_count_90d == 0
    assert asa.daily_ingest_gb == 28.0
    assert asa.retention_days == 90


def test_waste_ingest_merges_field_stats() -> None:
    state = _demo_state()
    result = waste_ingest(state)
    asa = next(p for p in result.source_profiles if p.source_type == "cisco:asa")
    assert "src_port" in asa.unused_fields
    assert "src_ip" in asa.used_fields


def test_waste_ingest_missing_profiles_flagged() -> None:
    state = TelemetryWasteAgentState(workflow_id="wf-empty", raw_index_profiles=[])
    result = waste_ingest(state)
    assert "missing:raw_index_profiles" in result.missing_evidence


def test_waste_ingest_calculates_monthly_cost() -> None:
    state = _demo_state()
    result = waste_ingest(state)
    asa = next(p for p in result.source_profiles if p.source_type == "cisco:asa")
    # 28 GB/day × 30 days × $150/year / 365 days ≈ $345
    assert asa.estimated_monthly_cost_usd > 300


# ── waste_detection ───────────────────────────────────────────────────────────


def test_waste_detection_identifies_cisco_asa() -> None:
    state = waste_ingest(_demo_state())
    result = waste_detection(state)
    wasteful_types = [p.source_type for p in result.wasteful_sources]
    assert "cisco:asa" in wasteful_types


def test_waste_detection_excludes_active_sources() -> None:
    """linux:syslog and windows:security have high search activity — must NOT be flagged."""
    state = waste_ingest(_demo_state())
    result = waste_detection(state)
    wasteful_types = [p.source_type for p in result.wasteful_sources]
    assert "linux:syslog" not in wasteful_types
    assert "windows:security" not in wasteful_types


def test_waste_detection_sorted_by_ingest_desc() -> None:
    state = waste_ingest(_demo_state())
    result = waste_detection(state)
    gbs = [p.daily_ingest_gb for p in result.wasteful_sources]
    assert gbs == sorted(gbs, reverse=True)


def test_waste_detection_findings_not_empty() -> None:
    state = waste_ingest(_demo_state())
    result = waste_detection(state)
    assert len(result.correlation_findings) >= 2
    assert any("cisco:asa" in f for f in result.correlation_findings)


def test_waste_detection_no_wasteful_sources_fallback() -> None:
    """When everything is below threshold, should return a single 'none detected' finding."""
    state = TelemetryWasteAgentState(
        workflow_id="wf-clean",
        source_profiles=[
            SourceTypeProfile(
                source_type="windows:security",
                index="windows",
                daily_ingest_gb=12.0,
                search_count_90d=200,
                dashboard_references=5,
                retention_days=365,
            )
        ],
    )
    result = waste_detection(state)
    assert result.wasteful_sources == []
    assert any("No wasteful" in f for f in result.correlation_findings)


# ── waste_cost_score ──────────────────────────────────────────────────────────


def test_waste_cost_score_produces_recommendations() -> None:
    state = waste_detection(waste_ingest(_demo_state()))
    result = waste_cost_score(state)
    assert len(result.recommendations) >= 1
    assert result.recommendations[0].source_type == "cisco:asa"


def test_waste_cost_score_asa_annual_savings() -> None:
    """Cisco ASA 28 GB/day × 63.6% field waste × 365 × $150 ≈ $97k+"""
    state = waste_detection(waste_ingest(_demo_state()))
    result = waste_cost_score(state)
    asa_rec = next(r for r in result.recommendations if r.source_type == "cisco:asa")
    assert asa_rec.estimated_annual_savings_usd > 90_000


def test_waste_cost_score_sorted_by_savings_desc() -> None:
    state = waste_detection(waste_ingest(_demo_state()))
    result = waste_cost_score(state)
    savings = [r.estimated_annual_savings_usd for r in result.recommendations]
    assert savings == sorted(savings, reverse=True)


def test_waste_cost_score_confidence_high_for_demo() -> None:
    """Demo fixture has 4+ wasteful sources with zero search — expect high confidence."""
    state = waste_detection(waste_ingest(_demo_state()))
    result = waste_cost_score(state)
    assert result.confidence >= 0.70


def test_waste_cost_score_zero_waste_confidence() -> None:
    """No wasteful sources → lower base confidence."""
    state = TelemetryWasteAgentState(workflow_id="wf-clean")
    result = waste_cost_score(state)
    assert result.confidence <= 0.55
    assert result.recommendations == []


# ── waste_final_response ──────────────────────────────────────────────────────


def test_waste_final_response_assembles_output() -> None:
    state = waste_cost_score(waste_detection(waste_ingest(_demo_state())))
    result = waste_final_response(state)
    assert result.final_output is not None
    assert result.final_output.total_wasteful_sources >= 4
    assert result.final_output.estimated_annual_savings_usd > 90_000
    assert "cisco:asa" in result.final_output.summary
    assert result.final_output.governance.policy_id == "telemetry-waste-policy"
    assert result.final_output.governance.source in {"reported", "derived"}
    assert result.final_output.security.risk_level in {"low", "medium", "high"}
    assert result.final_output.security.encryption_required == "in-transit + at-rest"


def test_waste_final_response_halts_on_approval_required() -> None:
    state = TelemetryWasteAgentState(workflow_id="wf-pending", approval_required=True)
    result = waste_final_response(state)
    assert result.final_output is None


def test_waste_final_response_zero_waste_summary() -> None:
    state = TelemetryWasteAgentState(
        workflow_id="wf-clean",
        approval_required=False,
        wasteful_sources=[],
        recommendations=[],
        confidence=0.5,
        source_profiles=[
            SourceTypeProfile(
                source_type="windows:security",
                index="windows",
                daily_ingest_gb=12.0,
                search_count_90d=200,
                retention_days=365,
            )
        ],
    )
    result = waste_final_response(state)
    assert result.final_output is not None
    assert "No high-volume unused" in result.final_output.summary
    assert result.final_output.security.risk_level == "low"
    assert result.final_output.governance.rule_triggered == "allow"


def test_waste_final_response_waste_pct_calculation() -> None:
    state = waste_cost_score(waste_detection(waste_ingest(_demo_state())))
    result = waste_final_response(state)
    output = result.final_output
    assert output is not None
    assert 0.0 < output.waste_pct < 1.0
    # Total ingest = 57.1 GB, wasted ≈ 38.1 GB → ~67% waste
    assert output.waste_pct > 0.50


# ── Full graph happy path ─────────────────────────────────────────────────────


def test_graph_end_to_end_cisco_asa_demo() -> None:
    """Full pipeline with demo fixture — no live network required."""
    from unittest.mock import MagicMock

    mock_splunk = MagicMock()
    graph = TelemetryWasteAgentGraph(
        splunk_adapter=mock_splunk,
        model_adapter=StubModelAdapter(),
        fetch_from_splunk=False,
    )

    state = _demo_state()
    result = graph.run(state, environment="dev", action_type="read")

    assert result.final_output is not None
    assert result.final_output.total_wasteful_sources >= 4
    assert result.final_output.estimated_annual_savings_usd > 90_000
    assert result.confidence > 0.70
    assert result.approval_required is False
    assert len(result.recommendations) >= 4
    # Top recommendation should be Cisco ASA (highest ingest)
    assert result.recommendations[0].source_type == "cisco:asa"
    # Reasoning draft from StubModelAdapter
    assert result.reasoning_draft.startswith("stub:")
