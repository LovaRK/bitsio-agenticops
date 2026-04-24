"""
Node 4 — waste_final_response

Assembles TelemetryWasteFinalOutput from the scored state.
Halts (returns None output) if approval is required.
"""

from __future__ import annotations

from agent_core.state.waste_state import (
    TelemetryWasteAgentState,
    TelemetryWasteFinalOutput,
    WasteGovernance,
    WasteSecurityPosture,
)


def _derive_governance(state: TelemetryWasteAgentState) -> WasteGovernance:
    policy_check = state.policy_checks[0] if state.policy_checks else {}
    rule_triggered = str(
        policy_check.get("action")
        or ("require_approval" if state.approval_required else "allow")
    )
    approval_reason = str(
        policy_check.get("reason")
        or (
            state.guardrail_notes[0]
            if state.guardrail_notes
            else (
                "Approval required due to policy threshold."
                if state.approval_required
                else "No blocking policy violations."
            )
        )
    )
    return WasteGovernance(
        policy_id=str(policy_check.get("policy_id") or "telemetry-waste-policy"),
        policy_version=str(policy_check.get("policy_version") or "v1.0.0"),
        rule_triggered=rule_triggered,
        approval_reason=approval_reason,
        source="reported" if state.policy_checks else "derived",
    )


def _derive_security_posture(*, waste_pct: float, approval_required: bool) -> WasteSecurityPosture:
    if waste_pct >= 0.50 or approval_required:
        risk_level = "high"
    elif waste_pct >= 0.20:
        risk_level = "medium"
    else:
        risk_level = "low"

    return WasteSecurityPosture(
        data_classification="internal",
        compliance_frameworks=["SOX", "PCI-DSS"],
        encryption_required="in-transit + at-rest",
        risk_level=risk_level,
        source="derived",
    )


def waste_final_response(state: TelemetryWasteAgentState) -> TelemetryWasteAgentState:
    """Build the final structured waste report, or halt if approval is pending."""
    next_state = state.model_copy(deep=True)

    if next_state.approval_required:
        next_state.final_output = None
        return next_state

    wasteful = next_state.wasteful_sources
    total_ingest = sum(p.daily_ingest_gb for p in next_state.source_profiles)
    total_wasted = sum(p.daily_ingest_gb for p in wasteful)
    total_savings = sum(r.estimated_annual_savings_usd for r in next_state.recommendations)
    waste_pct = (total_wasted / total_ingest) if total_ingest > 0 else 0.0

    if not wasteful:
        summary = (
            "No high-volume unused data sources detected above waste thresholds. "
            "All monitored source types show evidence of active utilisation."
        )
    else:
        top = wasteful[0]
        summary = (
            f"Detected {len(wasteful)} wasteful data source(s) ingesting "
            f"{total_wasted:.6f} GB/day with no search activity. "
            f"Top offender: {top.source_type} ({top.daily_ingest_gb:.6f} GB/day, "
            f"0 searches in 90 days). "
            f"Estimated annual Splunk license savings: "
            f"${total_savings:,.0f} across {len(next_state.recommendations)} recommendation(s)."
        )

    governance = _derive_governance(next_state)
    security = _derive_security_posture(
        waste_pct=waste_pct, approval_required=next_state.approval_required
    )

    next_state.final_output = TelemetryWasteFinalOutput(
        summary=summary,
        total_wasteful_sources=len(wasteful),
        total_daily_ingest_gb=round(total_ingest, 6),
        total_daily_wasted_gb=round(total_wasted, 6),
        estimated_annual_savings_usd=round(total_savings, 2),
        waste_pct=round(waste_pct, 3),
        top_offenders=wasteful[:5],
        recommendations=next_state.recommendations,
        confidence=next_state.confidence,
        approval_required=next_state.approval_required,
        guardrail_notes=next_state.guardrail_notes,
        governance=governance,
        security=security,
    )

    return next_state
