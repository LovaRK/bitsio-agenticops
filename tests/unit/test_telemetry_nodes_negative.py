"""
Negative test cases for TelemetryValueAgent nodes.

Tests cover: missing required fields, empty evidence, zero-evidence confidence,
low-confidence approval gate, write-action approval gate, and empty-host
correlation fallback.
"""

from __future__ import annotations

from agent_core.models.adapter import StubModelAdapter
from agent_core.nodes.approval_check import approval_check
from agent_core.nodes.confidence_score import confidence_score
from agent_core.nodes.correlation import correlation
from agent_core.nodes.evidence_retrieval import evidence_retrieval
from agent_core.nodes.final_response import final_response
from agent_core.nodes.incident_ingest import incident_ingest
from agent_core.nodes.reasoning_draft import reasoning_draft
from agent_core.state.telemetry_state import EvidenceItem, TelemetryAgentState
from splunk_mcp.dtos import SearchResultDTO

# ── incident_ingest ───────────────────────────────────────────────────────────


def test_incident_ingest_missing_all_required_fields() -> None:
    """An empty raw_incident should flag all 4 required fields as missing."""
    state = TelemetryAgentState(workflow_id="wf-neg-1", raw_incident={})
    result = incident_ingest(state)
    missing = result.missing_evidence
    assert "missing_field:incident_id" in missing
    assert "missing_field:title" in missing
    assert "missing_field:severity" in missing
    assert "missing_field:timestamp" in missing


def test_incident_ingest_partial_missing_fields() -> None:
    """Only absent fields should be flagged."""
    state = TelemetryAgentState(
        workflow_id="wf-neg-2",
        raw_incident={"incident_id": "inc-x", "title": "disk full"},
    )
    result = incident_ingest(state)
    assert "missing_field:incident_id" not in result.missing_evidence
    assert "missing_field:title" not in result.missing_evidence
    assert "missing_field:severity" in result.missing_evidence
    assert "missing_field:timestamp" in result.missing_evidence


def test_incident_ingest_falls_back_to_workflow_id() -> None:
    """When incident_id is absent, it should fall back to workflow_id."""
    state = TelemetryAgentState(workflow_id="wf-fallback", raw_incident={})
    result = incident_ingest(state)
    assert result.incident_id == "wf-fallback"


# ── evidence_retrieval ────────────────────────────────────────────────────────


def test_evidence_retrieval_empty_results() -> None:
    """Empty Splunk results should set missing_evidence flag."""
    state = TelemetryAgentState(workflow_id="wf-neg-3", incident_id="inc-3")
    search = SearchResultDTO(results=[], total=0, query="test", done=True)
    result = evidence_retrieval(state, search)
    assert result.evidence == []
    assert "splunk:no_results" in result.missing_evidence


def test_evidence_retrieval_indexes_references() -> None:
    """Each result row should get a unique splunk:// reference."""
    state = TelemetryAgentState(workflow_id="wf-neg-4", incident_id="inc-4")
    search = SearchResultDTO(
        results=[{"host": "h1"}, {"host": "h2"}], total=2, query="test", done=True
    )
    result = evidence_retrieval(state, search)
    refs = [item.reference for item in result.evidence]
    assert refs == ["splunk://result/0", "splunk://result/1"]


# ── correlation ───────────────────────────────────────────────────────────────


def test_correlation_no_evidence() -> None:
    """With no evidence, correlation should return a single fallback finding."""
    state = TelemetryAgentState(workflow_id="wf-neg-5", incident_id="inc-5")
    result = correlation(state)
    assert len(result.correlation_findings) == 1
    assert "No evidence" in result.correlation_findings[0]


def test_correlation_unknown_host_fallback() -> None:
    """Evidence rows without a 'host' key should map to 'unknown'."""
    state = TelemetryAgentState(
        workflow_id="wf-neg-6",
        incident_id="inc-6",
        evidence=[
            EvidenceItem(source="splunk", reference="splunk://result/0", content={}),
            EvidenceItem(source="splunk", reference="splunk://result/1", content={}),
        ],
    )
    result = correlation(state)
    assert any("unknown" in f for f in result.correlation_findings)


# ── confidence_score ──────────────────────────────────────────────────────────


def test_confidence_is_zero_with_no_evidence_and_missing() -> None:
    """Max missing-evidence penalty with no evidence should drive confidence to 0."""
    state = TelemetryAgentState(
        workflow_id="wf-neg-7",
        incident_id="inc-7",
        evidence=[],
        missing_evidence=["a", "b", "c", "d"],  # 4 × 0.15 = 0.60 penalty
        correlation_findings=[],
    )
    result = confidence_score(state)
    assert result.confidence == 0.0


def test_confidence_clamped_to_one() -> None:
    """Even with maximum evidence + findings, score must not exceed 1.0."""
    evidence = [
        EvidenceItem(source="splunk", reference=f"splunk://result/{i}", content={"host": "h"})
        for i in range(10)
    ]
    state = TelemetryAgentState(
        workflow_id="wf-neg-8",
        incident_id="inc-8",
        evidence=evidence,
        correlation_findings=["x", "y", "z"],
    )
    result = confidence_score(state)
    assert result.confidence <= 1.0


# ── approval_check ────────────────────────────────────────────────────────────


def test_approval_required_for_low_confidence() -> None:
    """Confidence below 0.60 should always require approval."""
    state = TelemetryAgentState(
        workflow_id="wf-neg-9",
        incident_id="inc-9",
        confidence=0.35,
    )
    result = approval_check(state, environment="dev", action_type="read")
    assert result.approval_required is True


def test_approval_required_for_write_action() -> None:
    """Write actions must require approval regardless of environment."""
    state = TelemetryAgentState(
        workflow_id="wf-neg-10",
        incident_id="inc-10",
        confidence=0.95,
    )
    result = approval_check(state, environment="dev", action_type="write")
    assert result.approval_required is True


def test_no_approval_for_high_confidence_dev_read() -> None:
    """High-confidence read in dev should not require approval."""
    state = TelemetryAgentState(
        workflow_id="wf-neg-11",
        incident_id="inc-11",
        confidence=0.85,
    )
    result = approval_check(state, environment="dev", action_type="read")
    assert result.approval_required is False


# ── final_response ────────────────────────────────────────────────────────────


def test_final_response_none_when_approval_required() -> None:
    """final_response must return None output when approval is pending."""
    state = TelemetryAgentState(
        workflow_id="wf-neg-12",
        incident_id="inc-12",
        approval_required=True,
        reasoning_draft="some reasoning",
        confidence=0.4,
    )
    result = final_response(state)
    assert result.final_output is None


def test_final_response_uses_first_correlation_finding_as_cause() -> None:
    """probable_cause should be the first correlation finding."""
    state = TelemetryAgentState(
        workflow_id="wf-neg-13",
        incident_id="inc-13",
        approval_required=False,
        reasoning_draft="all good",
        correlation_findings=["host=db-1 events=10", "host=api-1 events=3"],
        confidence=0.75,
    )
    result = final_response(state)
    assert result.final_output is not None
    assert result.final_output.probable_cause == "host=db-1 events=10"


def test_final_response_insufficient_evidence_cause() -> None:
    """With no correlation findings, probable_cause should say 'Insufficient evidence'."""
    state = TelemetryAgentState(
        workflow_id="wf-neg-14",
        incident_id="inc-14",
        approval_required=False,
        reasoning_draft="inconclusive",
        correlation_findings=[],
        confidence=0.55,
    )
    result = final_response(state)
    assert result.final_output is not None
    assert "Insufficient evidence" in result.final_output.probable_cause


# ── reasoning_draft ───────────────────────────────────────────────────────────


def test_reasoning_draft_uses_stub_adapter() -> None:
    """StubModelAdapter output should start with 'stub:'."""
    state = TelemetryAgentState(
        workflow_id="wf-neg-15",
        incident_id="inc-15",
        correlation_findings=["host=x events=2"],
    )
    result = reasoning_draft(state, StubModelAdapter())
    assert result.reasoning_draft.startswith("stub:")
