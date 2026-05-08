"""
Node 2 — waste_detection

Identifies wasteful sources by applying threshold rules:
  - Zero search activity for 90+ days (primary signal)
  - No dashboard or alert references
  - High ingest volume (> 1 GB/day)
  - Long retention relative to activity

Produces a filtered list of wasteful sources for downstream scoring.
"""

from __future__ import annotations

from agent_core.state.waste_state import SourceTypeProfile, TelemetryWasteAgentState

# Thresholds (tuneable)
_MIN_INGEST_GB_TO_FLAG = 0.0001  # keep very low for small-but-real demo datasets
_MAX_SEARCH_COUNT_FOR_WASTE = 5  # ≤5 searches in 90 days = effectively unused
_RETENTION_WASTE_DAYS = 30  # retention > this with zero activity = waste


def _is_wasteful(profile: SourceTypeProfile) -> bool:
    """Return True if this source type is a waste candidate."""
    if profile.daily_ingest_gb < _MIN_INGEST_GB_TO_FLAG:
        return False

    has_search_activity = (
        profile.search_count_90d > _MAX_SEARCH_COUNT_FOR_WASTE
        or profile.dashboard_references > 0
        or profile.alert_references > 0
    )

    if has_search_activity:
        return False

    return True


def waste_detection(state: TelemetryWasteAgentState) -> TelemetryWasteAgentState:
    """
    Filter source profiles to those meeting the waste criteria.
    Produces state.wasteful_sources and state.correlation_findings.
    """
    next_state = state.model_copy(deep=True)

    wasteful: list[SourceTypeProfile] = []
    for profile in next_state.source_profiles:
        if _is_wasteful(profile):
            wasteful.append(profile)

    next_state.wasteful_sources = sorted(wasteful, key=lambda p: p.daily_ingest_gb, reverse=True)

    if not wasteful:
        next_state.correlation_findings = ["No wasteful sources detected above thresholds."]
        return next_state

    total_wasted_gb = sum(p.daily_ingest_gb for p in wasteful)
    top = wasteful[0]

    findings = [
        f"top_offender={top.source_type} daily_gb={top.daily_ingest_gb:.1f} "
        f"search_90d={top.search_count_90d}",
        f"total_wasteful_sources={len(wasteful)} total_wasted_gb_day={total_wasted_gb:.1f}",
    ]

    for p in wasteful[:3]:
        annual_waste = p.daily_ingest_gb * 365 * 150  # $150/GB/year
        findings.append(
            f"{p.source_type}: retention={p.retention_days}d "
            f"unused_fields={len(p.unused_fields)} "
            f"est_annual_waste_usd={annual_waste:,.0f}"
        )

    next_state.correlation_findings = findings
    return next_state
