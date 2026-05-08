"""
Node 1 — waste_ingest

Parses raw Splunk index profiles (from list_indexes + search activity queries)
into structured SourceTypeProfile objects. Flags sources with missing data.
"""

from __future__ import annotations

from agent_core.state.waste_state import SourceTypeProfile, TelemetryWasteAgentState

# Splunk license cost assumption: ~$150/GB/year (adjust per customer contract)
_LICENSE_COST_PER_GB_YEAR = 150.0
_DAYS_PER_YEAR = 365


def _norm_source_type(value: str) -> str:
    return value.strip().strip('"').strip("'").lower()


def waste_ingest(state: TelemetryWasteAgentState) -> TelemetryWasteAgentState:
    """
    Parse raw index profiles and search activity into SourceTypeProfile objects.

    Inputs used from state:
        raw_index_profiles  — list of dicts with keys: source_type, index,
                              daily_ingest_gb, retention_days
        raw_search_activity — list of dicts with keys: source_type,
                              search_count_90d, dashboard_references,
                              alert_references
        raw_field_stats     — list of dicts with keys: source_type,
                              unused_fields, used_fields
    """
    next_state = state.model_copy(deep=True)

    if not next_state.raw_index_profiles:
        next_state.missing_evidence.append("missing:raw_index_profiles")

    # Build lookup maps
    search_map: dict[str, dict] = {
        _norm_source_type(str(row.get("source_type", ""))): row
        for row in next_state.raw_search_activity
    }
    search_map_by_index: dict[str, dict] = {
        _norm_source_type(str(row.get("index", ""))): row for row in next_state.raw_search_activity
    }
    field_map: dict[str, dict] = {
        _norm_source_type(str(row.get("source_type", ""))): row
        for row in next_state.raw_field_stats
    }

    profiles: list[SourceTypeProfile] = []
    for raw in next_state.raw_index_profiles:
        st = _norm_source_type(str(raw.get("source_type", "unknown")))
        daily_gb = float(raw.get("daily_ingest_gb", 0.0))
        retention = int(raw.get("retention_days", 90))

        idx = _norm_source_type(str(raw.get("index", "main")))
        search_data = search_map.get(st) or search_map_by_index.get(idx, {})
        field_data = field_map.get(st, {})

        monthly_cost = (daily_gb * 30 * _LICENSE_COST_PER_GB_YEAR) / _DAYS_PER_YEAR

        profiles.append(
            SourceTypeProfile(
                source_type=st,
                index=str(raw.get("index", "main")),
                daily_ingest_gb=daily_gb,
                search_count_90d=int(search_data.get("search_count_90d", 0)),
                dashboard_references=int(search_data.get("dashboard_references", 0)),
                alert_references=int(search_data.get("alert_references", 0)),
                unused_fields=list(field_data.get("unused_fields", [])),
                used_fields=list(field_data.get("used_fields", [])),
                retention_days=retention,
                estimated_monthly_cost_usd=round(monthly_cost, 2),
            )
        )

    next_state.source_profiles = profiles

    if not profiles:
        next_state.missing_evidence.append("missing:no_source_profiles_parsed")

    return next_state
