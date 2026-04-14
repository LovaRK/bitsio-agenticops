"""
Node 3 — waste_cost_score

Calculates confidence score and builds WasteRecommendation objects.

Confidence formula for waste detection (different from incident triage):
  - Base:          0.50  (always have some signal if we reach this node)
  - Evidence vol:  +0.20 if >= 5 wasteful sources identified
  - No-search 90d: +0.15 if top offender has 0 searches in 90d
  - High ingest:   +0.10 if top offender > 5 GB/day
  - Field waste:   +0.05 if > 50% fields unused in any source
  - Missing data:  -0.10 per missing evidence item (max -0.40)
  - Clamped to [0.0, 1.0]

Savings formula (per source):
  - Field savings:     daily_ingest_gb * field_waste_pct * 365 * $150/GB
  - Retention savings: if retention > recommended, proportional reduction
  - Total annual savings = sum across all wasteful sources
"""

from __future__ import annotations

from agent_core.state.waste_state import (
    SourceTypeProfile,
    TelemetryWasteAgentState,
    WasteRecommendation,
)

_LICENSE_COST_PER_GB_YEAR = 150.0  # $USD per GB per year — adjust per contract
_RECOMMENDED_RETENTION_NO_ACTIVITY = 7  # days
_DEFAULT_FIELD_WASTE_PCT = 0.35


def _field_waste_pct(profile: SourceTypeProfile) -> float:
    total = len(profile.unused_fields) + len(profile.used_fields)
    if total == 0:
        # Live environments often lack field-level profiles in first pass.
        # Use conservative estimate so waste KPI is non-zero but not exaggerated.
        return _DEFAULT_FIELD_WASTE_PCT
    return len(profile.unused_fields) / total


def _build_recommendation(profile: SourceTypeProfile) -> WasteRecommendation:
    """Build a concrete WasteRecommendation for a wasteful source."""
    field_pct = _field_waste_pct(profile)
    daily_gb_saved = profile.daily_ingest_gb * field_pct
    annual_savings = daily_gb_saved * 365 * _LICENSE_COST_PER_GB_YEAR

    # Add retention savings on top of field savings
    if profile.retention_days > _RECOMMENDED_RETENTION_NO_ACTIVITY:
        # Reducing retention frees storage proportionally
        retention_reduction_pct = 1.0 - _RECOMMENDED_RETENTION_NO_ACTIVITY / profile.retention_days
        storage_savings = (
            profile.daily_ingest_gb
            * profile.retention_days
            * retention_reduction_pct
            * _LICENSE_COST_PER_GB_YEAR
            / 365
        )
        annual_savings += storage_savings

    actions = []
    if profile.search_count_90d == 0 and profile.dashboard_references == 0:
        actions.append("route_to_cold_storage")
    if len(profile.unused_fields) > 0:
        actions.append("filter_fields")
    if profile.retention_days > _RECOMMENDED_RETENTION_NO_ACTIVITY:
        actions.append("reduce_retention")
    action = " + ".join(actions) if actions else "review"

    rationale_parts = []
    if profile.search_count_90d == 0:
        rationale_parts.append("zero search activity in 90 days")
    if len(profile.unused_fields) > 0:
        rationale_parts.append(
            f"{len(profile.unused_fields)} unused fields "
            f"({field_pct:.0%} of total) eligible for index-time filtering"
        )
    if profile.retention_days > _RECOMMENDED_RETENTION_NO_ACTIVITY:
        rationale_parts.append(
            f"retention {profile.retention_days}d → reduce to "
            f"{_RECOMMENDED_RETENTION_NO_ACTIVITY}d (data is unsearched)"
        )

    return WasteRecommendation(
        source_type=profile.source_type,
        action=action,
        current_retention_days=profile.retention_days,
        recommended_retention_days=_RECOMMENDED_RETENTION_NO_ACTIVITY,
        field_savings_pct=round(field_pct, 3),
        estimated_daily_gb_saved=round(daily_gb_saved, 2),
        estimated_annual_savings_usd=round(annual_savings, 2),
        rationale="; ".join(rationale_parts) or "High ingest with no utilisation detected.",
    )


def waste_cost_score(state: TelemetryWasteAgentState) -> TelemetryWasteAgentState:
    """Score confidence and build recommendations for all wasteful sources."""
    next_state = state.model_copy(deep=True)

    wasteful = next_state.wasteful_sources
    missing_count = len(next_state.missing_evidence)

    # ── Confidence ─────────────────────────────────────────────────────────
    score = 0.50

    if len(wasteful) >= 5:
        score += 0.20
    elif len(wasteful) >= 1:
        score += 0.10

    if wasteful:
        top = wasteful[0]
        if top.search_count_90d == 0:
            score += 0.15
        if top.daily_ingest_gb > 5.0:
            score += 0.10
        max_field_waste = max(_field_waste_pct(p) for p in wasteful)
        if max_field_waste > 0.50:
            score += 0.05

    score -= min(missing_count * 0.10, 0.40)
    next_state.confidence = round(max(0.0, min(1.0, score)), 2)

    # ── Recommendations ────────────────────────────────────────────────────
    recommendations = [_build_recommendation(p) for p in wasteful]
    # Sort by savings descending
    recommendations.sort(key=lambda r: r.estimated_annual_savings_usd, reverse=True)
    next_state.recommendations = recommendations

    return next_state
