"""
datasensAI v3 Executive Telemetry Dashboard — API router.

GET /api/v1/telemetry/executive-summary
    Returns a comprehensive executive-level scoring summary:
    - ROI Score, GainScope, Low-Value License Spend, Savings Potential
    - Tier distribution, savings staircase, quick wins
    - S3 candidates, security gaps, full sourcetype scores

Live mode: runs 5 SPL queries via Splunk native adapter.
Fallback: uses production-representative seed dataset from real customer data.
"""
from __future__ import annotations

import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends
from opentelemetry import trace

from apps.api.app.dependencies import get_splunk_adapter_native_default
from apps.api.app.services.cost_engine import CostEngine
from apps.api.app.services.detection_coverage import get_coverage
from apps.api.app.services.scoring_engine import (
    CompositeScorer,
    SourcetypeRawData,
    SourcetypeScore,
)
from packages.shared.auth import AuthContext, require_analyst
from packages.shared.config.settings import get_settings

router = APIRouter(prefix="/api/v1/telemetry", tags=["telemetry-executive"])
_TRACER = trace.get_tracer("api.routes")

# ── Seed dataset (from real customer scoring table) ───────────────────────────
_SEED_ROWS: list[dict[str, Any]] = [
    {
        "name": "o365:management:activity",
        "index": "o365",
        "composite": 91.7,
        "utilization": 100.0,
        "detection": 79.2,
        "quality": 100.0,
        "gb_per_day": 1.69,
        "annual_cost_usd": 92572.5,
        "retention_days": 90,
        "alert_count": 12,
        "scheduled_search_count": 8,
        "dashboard_ref_count": 5,
        "adhoc_search_count": 50,
        "unique_user_count": 20,
        "mitre_coverage_pct": 79.2,
        "lantern_coverage_pct": 65.0,
        "total_fields": 45,
        "unused_field_pct": 10.0,
    },
    {
        "name": "WinEventLog",
        "index": "windows",
        "composite": 79.7,
        "utilization": 59.0,
        "detection": 85.0,
        "quality": 100.0,
        "gb_per_day": 13.86,
        "annual_cost_usd": 759735.0,
        "retention_days": 90,
        "alert_count": 8,
        "scheduled_search_count": 6,
        "dashboard_ref_count": 3,
        "adhoc_search_count": 30,
        "unique_user_count": 15,
        "mitre_coverage_pct": 85.0,
        "lantern_coverage_pct": 75.0,
        "total_fields": 80,
        "unused_field_pct": 20.0,
    },
    {
        "name": "cisco:ios",
        "index": "network",
        "composite": 68.2,
        "utilization": 81.2,
        "detection": 36.9,
        "quality": 100.0,
        "gb_per_day": 0.01,
        "annual_cost_usd": 547.5,
        "retention_days": 90,
        "alert_count": 10,
        "scheduled_search_count": 5,
        "dashboard_ref_count": 2,
        "adhoc_search_count": 20,
        "unique_user_count": 8,
        "mitre_coverage_pct": 55.0,
        "lantern_coverage_pct": 48.0,
        "total_fields": 30,
        "unused_field_pct": 15.0,
    },
    {
        "name": "json",
        "index": "main",
        "composite": 60.0,
        "utilization": 100.0,
        "detection": 0.0,
        "quality": 100.0,
        "gb_per_day": 0.11,
        "annual_cost_usd": 6022.5,
        "retention_days": 90,
        "alert_count": 10,
        "scheduled_search_count": 5,
        "dashboard_ref_count": 3,
        "adhoc_search_count": 25,
        "unique_user_count": 10,
        "mitre_coverage_pct": 0.0,
        "lantern_coverage_pct": 0.0,
        "total_fields": 20,
        "unused_field_pct": 5.0,
    },
    {
        "name": "sc4s:events",
        "index": "sc4s",
        "composite": 60.0,
        "utilization": 100.0,
        "detection": 0.0,
        "quality": 100.0,
        "gb_per_day": 0.001,
        "annual_cost_usd": 54.75,
        "retention_days": 90,
        "alert_count": 10,
        "scheduled_search_count": 5,
        "dashboard_ref_count": 2,
        "adhoc_search_count": 20,
        "unique_user_count": 8,
        "mitre_coverage_pct": 5.0,
        "lantern_coverage_pct": 4.0,
        "total_fields": 15,
        "unused_field_pct": 5.0,
    },
    {
        "name": "cisco:asa",
        "index": "firewall",
        "composite": 59.9,
        "utilization": 57.6,
        "detection": 36.9,
        "quality": 100.0,
        "gb_per_day": 1.65,
        "annual_cost_usd": 90393.75,
        "retention_days": 90,
        "alert_count": 7,
        "scheduled_search_count": 4,
        "dashboard_ref_count": 2,
        "adhoc_search_count": 18,
        "unique_user_count": 9,
        "mitre_coverage_pct": 58.0,
        "lantern_coverage_pct": 50.0,
        "total_fields": 40,
        "unused_field_pct": 25.0,
    },
    {
        "name": "fortigate_utm",
        "index": "fortigate",
        "composite": 55.6,
        "utilization": 36.0,
        "detection": 45.0,
        "quality": 100.0,
        "gb_per_day": 14.67,
        "annual_cost_usd": 803981.25,
        "retention_days": 90,
        "alert_count": 5,
        "scheduled_search_count": 3,
        "dashboard_ref_count": 1,
        "adhoc_search_count": 10,
        "unique_user_count": 6,
        "mitre_coverage_pct": 60.0,
        "lantern_coverage_pct": 55.0,
        "total_fields": 60,
        "unused_field_pct": 40.0,
    },
    {
        "name": "fortigate_traffic",
        "index": "fortigate",
        "composite": 44.5,
        "utilization": 24.4,
        "detection": 27.5,
        "quality": 100.0,
        "gb_per_day": 24.14,
        "annual_cost_usd": 1323165.0,
        "retention_days": 90,
        "alert_count": 3,
        "scheduled_search_count": 2,
        "dashboard_ref_count": 1,
        "adhoc_search_count": 8,
        "unique_user_count": 5,
        "mitre_coverage_pct": 30.0,
        "lantern_coverage_pct": 25.0,
        "total_fields": 55,
        "unused_field_pct": 50.0,
    },
    {
        "name": "wazuh-alerts",
        "index": "wazuh",
        "composite": 35.8,
        "utilization": 30.86,
        "detection": 0.0,
        "quality": 100.0,
        "gb_per_day": 7.57,
        "annual_cost_usd": 414960.75,
        "retention_days": 90,
        "alert_count": 4,
        "scheduled_search_count": 2,
        "dashboard_ref_count": 1,
        "adhoc_search_count": 12,
        "unique_user_count": 7,
        "mitre_coverage_pct": 80.0,
        "lantern_coverage_pct": 72.0,
        "total_fields": 50,
        "unused_field_pct": 35.0,
    },
    {
        "name": "vmware:perf:cpu",
        "index": "vmware",
        "composite": 35.6,
        "utilization": 13.6,
        "detection": 14.7,
        "quality": 100.0,
        "gb_per_day": 0.25,
        "annual_cost_usd": 13687.5,
        "retention_days": 90,
        "alert_count": 2,
        "scheduled_search_count": 1,
        "dashboard_ref_count": 0,
        "adhoc_search_count": 5,
        "unique_user_count": 3,
        "mitre_coverage_pct": 5.0,
        "lantern_coverage_pct": 4.0,
        "total_fields": 25,
        "unused_field_pct": 60.0,
    },
    {
        "name": "tomcat:runtime.log",
        "index": "app_logs",
        "composite": 27.5,
        "utilization": 7.19,
        "detection": 0.0,
        "quality": 99.99,
        "gb_per_day": 30.10,
        "annual_cost_usd": 1649025.0,
        "retention_days": 90,
        "alert_count": 1,
        "scheduled_search_count": 1,
        "dashboard_ref_count": 0,
        "adhoc_search_count": 5,
        "unique_user_count": 3,
        "mitre_coverage_pct": 5.0,
        "lantern_coverage_pct": 8.0,
        "total_fields": 35,
        "unused_field_pct": 70.0,
    },
    {
        "name": "linux_audit",
        "index": "linux",
        "composite": 33.8,
        "utilization": 14.4,
        "detection": 100.0,
        "quality": 100.0,
        "gb_per_day": 0.53,
        "annual_cost_usd": 29047.5,
        "retention_days": 90,
        "alert_count": 2,
        "scheduled_search_count": 1,
        "dashboard_ref_count": 0,
        "adhoc_search_count": 6,
        "unique_user_count": 4,
        "mitre_coverage_pct": 72.0,
        "lantern_coverage_pct": 62.0,
        "total_fields": 30,
        "unused_field_pct": 25.0,
    },
    {
        "name": "fgt_traffic",
        "index": "fortigate",
        "composite": 29.1,
        "utilization": 11.83,
        "detection": 0.0,
        "quality": 100.0,
        "gb_per_day": 9.88,
        "annual_cost_usd": 541485.0,
        "retention_days": 90,
        "alert_count": 1,
        "scheduled_search_count": 1,
        "dashboard_ref_count": 0,
        "adhoc_search_count": 4,
        "unique_user_count": 3,
        "mitre_coverage_pct": 60.0,
        "lantern_coverage_pct": 55.0,
        "total_fields": 45,
        "unused_field_pct": 55.0,
    },
    {
        "name": "WinRegistry",
        "index": "windows",
        "composite": 26.5,
        "utilization": 4.41,
        "detection": 0.0,
        "quality": 100.0,
        "gb_per_day": 1.36,
        "annual_cost_usd": 74526.0,
        "retention_days": 90,
        "alert_count": 0,
        "scheduled_search_count": 1,
        "dashboard_ref_count": 0,
        "adhoc_search_count": 3,
        "unique_user_count": 2,
        "mitre_coverage_pct": 80.0,
        "lantern_coverage_pct": 70.0,
        "total_fields": 25,
        "unused_field_pct": 80.0,
    },
    {
        "name": "app:car.loyalty.sms:processor",
        "index": "app_loyalty",
        "composite": 25.4,
        "utilization": 1.16,
        "detection": 0.0,
        "quality": 99.94,
        "gb_per_day": 17.26,
        "annual_cost_usd": 945787.5,
        "retention_days": 90,
        "alert_count": 0,
        "scheduled_search_count": 0,
        "dashboard_ref_count": 0,
        "adhoc_search_count": 2,
        "unique_user_count": 2,
        "mitre_coverage_pct": 8.0,
        "lantern_coverage_pct": 6.0,
        "total_fields": 40,
        "unused_field_pct": 85.0,
    },
    {
        "name": "engine:processors",
        "index": "app_engine",
        "composite": 27.5,
        "utilization": 7.19,
        "detection": 0.0,
        "quality": 100.0,
        "gb_per_day": 4.97,
        "annual_cost_usd": 272317.5,
        "retention_days": 90,
        "alert_count": 1,
        "scheduled_search_count": 1,
        "dashboard_ref_count": 0,
        "adhoc_search_count": 5,
        "unique_user_count": 3,
        "mitre_coverage_pct": 5.0,
        "lantern_coverage_pct": 4.0,
        "total_fields": 30,
        "unused_field_pct": 65.0,
    },
    {
        "name": "cisco:nexus",
        "index": "network",
        "composite": 28.0,
        "utilization": 10.0,
        "detection": 0.0,
        "quality": 100.0,
        "gb_per_day": 0.50,
        "annual_cost_usd": 27375.0,
        "retention_days": 90,
        "alert_count": 1,
        "scheduled_search_count": 0,
        "dashboard_ref_count": 0,
        "adhoc_search_count": 4,
        "unique_user_count": 3,
        "mitre_coverage_pct": 50.0,
        "lantern_coverage_pct": 44.0,
        "total_fields": 20,
        "unused_field_pct": 50.0,
    },
    {
        "name": "ms365:activity",
        "index": "o365",
        "composite": 32.0,
        "utilization": 15.0,
        "detection": 22.0,
        "quality": 100.0,
        "gb_per_day": 2.10,
        "annual_cost_usd": 115087.5,
        "retention_days": 90,
        "alert_count": 2,
        "scheduled_search_count": 1,
        "dashboard_ref_count": 0,
        "adhoc_search_count": 6,
        "unique_user_count": 4,
        "mitre_coverage_pct": 72.0,
        "lantern_coverage_pct": 60.0,
        "total_fields": 40,
        "unused_field_pct": 45.0,
    },
    {
        "name": "proxy:access",
        "index": "proxy",
        "composite": 26.0,
        "utilization": 8.0,
        "detection": 5.0,
        "quality": 100.0,
        "gb_per_day": 3.50,
        "annual_cost_usd": 191887.5,
        "retention_days": 90,
        "alert_count": 1,
        "scheduled_search_count": 0,
        "dashboard_ref_count": 0,
        "adhoc_search_count": 4,
        "unique_user_count": 3,
        "mitre_coverage_pct": 42.0,
        "lantern_coverage_pct": 38.0,
        "total_fields": 35,
        "unused_field_pct": 60.0,
    },
    {
        "name": "XmlWinEventLog",
        "index": "windows",
        "composite": 42.2,
        "utilization": 3.48,
        "detection": 40.0,
        "quality": 100.0,
        "gb_per_day": 3.07,
        "annual_cost_usd": 168217.5,
        "retention_days": 90,
        "alert_count": 0,
        "scheduled_search_count": 1,
        "dashboard_ref_count": 0,
        "adhoc_search_count": 2,
        "unique_user_count": 2,
        "mitre_coverage_pct": 85.0,
        "lantern_coverage_pct": 75.0,
        "total_fields": 50,
        "unused_field_pct": 70.0,
    },
    {
        "name": "meraki:accesspoints",
        "index": "meraki",
        "composite": 48.2,
        "utilization": 40.8,
        "detection": 22.2,
        "quality": 100.0,
        "gb_per_day": 0.01,
        "annual_cost_usd": 547.5,
        "retention_days": 90,
        "alert_count": 5,
        "scheduled_search_count": 2,
        "dashboard_ref_count": 1,
        "adhoc_search_count": 10,
        "unique_user_count": 6,
        "mitre_coverage_pct": 45.0,
        "lantern_coverage_pct": 40.0,
        "total_fields": 20,
        "unused_field_pct": 20.0,
    },
    {
        "name": "dns",
        "index": "dns",
        "composite": 35.0,
        "utilization": 20.0,
        "detection": 35.0,
        "quality": 100.0,
        "gb_per_day": 1.20,
        "annual_cost_usd": 65790.0,
        "retention_days": 90,
        "alert_count": 2,
        "scheduled_search_count": 1,
        "dashboard_ref_count": 1,
        "adhoc_search_count": 8,
        "unique_user_count": 5,
        "mitre_coverage_pct": 35.0,
        "lantern_coverage_pct": 30.0,
        "total_fields": 25,
        "unused_field_pct": 30.0,
    },
]


def _build_seed_scores(cost_per_gb_year: float = 150.0) -> list[SourcetypeScore]:
    """Build SourcetypeScore objects from pre-computed seed data."""
    from apps.api.app.services.scoring_engine import (
        TIER_CRITICAL,
        TIER_IMPORTANT,
        TIER_NICE,
        TIER_WASTEFUL,
    )

    def _tier(composite: float) -> str:
        if composite >= 75:
            return TIER_CRITICAL
        if composite >= 50:
            return TIER_IMPORTANT
        if composite >= 25:
            return TIER_NICE
        return TIER_WASTEFUL

    scores: list[SourcetypeScore] = []
    for row in _SEED_ROWS:
        annual_cost = round(row["gb_per_day"] * 365 * cost_per_gb_year, 2)
        tier = _tier(row["composite"])
        util = row["utilization"]
        savings_pct = max(0.0, 1.0 - util / 100.0)
        if tier == TIER_WASTEFUL:
            savings_pct = min(0.95, savings_pct + 0.3)
        elif tier == TIER_NICE:
            savings_pct = min(0.70, savings_pct + 0.1)
        potential_savings = round(annual_cost * savings_pct, 2)
        detection_gap = (
            (row["mitre_coverage_pct"] > 5 or row["lantern_coverage_pct"] > 5)
            and row["detection"] < 25.0
        )
        scores.append(
            SourcetypeScore(
                sourcetype=row["name"],
                index=row["index"],
                composite=row["composite"],
                utilization=row["utilization"],
                detection=row["detection"],
                quality=row["quality"],
                tier=tier,
                gb_per_day=row["gb_per_day"],
                annual_cost_usd=annual_cost,
                potential_savings_usd=potential_savings,
                detection_gap=detection_gap,
                retention_days=row["retention_days"],
                total_fields=row["total_fields"],
                unused_field_pct=row["unused_field_pct"],
                alert_count=row["alert_count"],
                scheduled_search_count=row["scheduled_search_count"],
                dashboard_ref_count=row["dashboard_ref_count"],
                adhoc_search_count=row["adhoc_search_count"],
                unique_user_count=row["unique_user_count"],
                mitre_coverage_pct=row["mitre_coverage_pct"],
                lantern_coverage_pct=row["lantern_coverage_pct"],
            )
        )
    return scores


def _build_response(
    scores: list[SourcetypeScore],
    *,
    cost_per_gb_year: float,
    util_weight: float,
    det_weight: float,
    qual_weight: float,
    data_source: str,
    fallback_used: bool,
    latency_ms: int,
) -> dict[str, Any]:
    engine = CostEngine(cost_per_gb_year=cost_per_gb_year)
    scores_sorted = sorted(scores, key=lambda s: s.composite, reverse=True)

    roi = engine.roi_score(scores)
    gainscope = engine.gainscope(scores)
    low_val_spend = engine.low_value_license_spend(scores)
    savings_pot = engine.storage_savings_potential(scores)
    total_vol = engine.total_daily_volume_gb(scores)
    total_cost = engine.total_annual_cost(scores)
    total_sourcetypes = len(scores)

    tier_dist = engine.tier_distribution(scores)
    data_split = engine.data_value_split(scores)
    staircase = engine.savings_staircase(scores)
    wins = engine.quick_wins(scores)
    top_vol = engine.top_by_volume(scores, n=6)
    s3_cands = engine.s3_candidates(scores)
    sec_gaps = engine.security_gaps(scores)
    avg_sc = engine.avg_scores(scores)
    res_conf = engine.resolution_confidence(scores)
    profiles = engine.score_profiles_by_tier(scores)

    confidence = 0.95 if not fallback_used else 0.82

    return {
        "executive_kpis": {
            "roi_score": roi,
            "gainscope": gainscope,
            "low_value_license_spend_usd": low_val_spend,
            "storage_savings_potential_usd": savings_pot,
            "total_daily_volume_gb": total_vol,
            "total_sourcetypes_assessed": total_sourcetypes,
            "total_annual_spend_usd": total_cost,
        },
        "data_value_split": data_split,
        "quick_wins": wins,
        "tier_distribution": tier_dist,
        "score_profiles_by_tier": profiles,
        "savings_staircase": staircase,
        "top_sourcetypes_by_volume": top_vol,
        "s3_candidates": s3_cands,
        "security_gaps": sec_gaps,
        "avg_scores": avg_sc,
        "resolution_confidence": res_conf,
        "sourcetype_scores": [s.to_dict() for s in scores_sorted],
        "scoring_config": {
            "cost_per_gb_year": cost_per_gb_year,
            "util_weight": util_weight,
            "det_weight": det_weight,
            "qual_weight": qual_weight,
        },
        "trust": {
            "data_source": data_source,
            "fallback_used": fallback_used,
            "latency_ms": latency_ms,
            "confidence": confidence,
        },
    }


@router.get("/executive-summary", summary="datasensAI v3 Executive Telemetry Summary")
def executive_summary(
    cost_per_gb: float = 150.0,
    util_weight: float = 0.35,
    det_weight: float = 0.40,
    qual_weight: float = 0.25,
    window_days: int = 90,
    ctx: AuthContext = Depends(require_analyst),
) -> dict[str, Any]:
    """
    Return a full datasensAI v3 executive telemetry summary.

    When SPLUNK_LIVE_MODE=true, runs SPL queries against the connected Splunk instance
    to build real SourcetypeRawData. Otherwise returns a high-fidelity seed dataset
    representative of a mid-size enterprise Splunk deployment.
    """
    settings = get_settings()
    workflow_id = f"wf_exec_{uuid.uuid4().hex[:12]}"
    start_ms = time.perf_counter()

    with _TRACER.start_as_current_span("api.telemetry.executive_summary") as span:
        span.set_attribute("service.name", "api")
        span.set_attribute("graph.name", "telemetry_executive_scoring")
        span.set_attribute("graph.version", "v3.0.0")
        span.set_attribute("node.name", "executive_summary")
        span.set_attribute("workflow_id", workflow_id)
        span.set_attribute("tenant.safe_id", settings.tenant_safe_id)
        span.set_attribute("env", settings.environment)
        span.set_attribute("model.provider", settings.model_provider)

        scorer = CompositeScorer(
            util_weight=util_weight,
            det_weight=det_weight,
            qual_weight=qual_weight,
            cost_per_gb_year=cost_per_gb,
        )

        scores: list[SourcetypeScore] = []
        data_source = "seed"
        fallback_used = True

        if settings.splunk_live_mode:
            try:
                splunk = get_splunk_adapter_native_default()
                scores = _run_live_scoring(splunk, scorer, window_days=window_days)
                data_source = "live"
                fallback_used = False
            except Exception:
                # Fall through to seed data
                scores = _build_seed_scores(cost_per_gb_year=cost_per_gb)
                data_source = "seed"
                fallback_used = True
        else:
            scores = _build_seed_scores(cost_per_gb_year=cost_per_gb)

        latency_ms = int(round((time.perf_counter() - start_ms) * 1000))
        return _build_response(
            scores,
            cost_per_gb_year=cost_per_gb,
            util_weight=scorer.util_weight,
            det_weight=scorer.det_weight,
            qual_weight=scorer.qual_weight,
            data_source=data_source,
            fallback_used=fallback_used,
            latency_ms=latency_ms,
        )


def _run_live_scoring(
    splunk: Any,
    scorer: CompositeScorer,
    *,
    window_days: int,
) -> list[SourcetypeScore]:
    """Run 5 SPL queries and build SourcetypeRawData from results."""
    from apps.api.app.services.detection_coverage import get_coverage

    earliest = f"-{window_days}d@d"
    latest = "now"

    # Query 1: Index volume by sourcetype
    volume_rows = _safe_splunk_search(
        splunk,
        (
            "search index=* earliest={earliest} latest={latest} | "
            "eval daily_gb=len(_raw)/1073741824 | "
            "stats sum(daily_gb) as total_gb count as event_count "
            "by index, sourcetype | "
            "eval daily_gb=total_gb/{window_days}"
        ).format(earliest=earliest, latest=latest, window_days=window_days),
        earliest=earliest,
        latest=latest,
    )

    # Query 2: Alert references by sourcetype
    alert_rows = _safe_splunk_search(
        splunk,
        (
            "search index=_internal sourcetype=scheduler earliest={earliest} latest={latest} | "
            "stats count as scheduled_count by savedsearch_name | "
            "head 100"
        ).format(earliest=earliest, latest=latest),
        earliest=earliest,
        latest=latest,
    )

    # Query 3: Search activity by sourcetype
    search_rows = _safe_splunk_search(
        splunk,
        (
            "search index=_audit action=search earliest={earliest} latest={latest} | "
            "rex field=search \"index=(?P<idx>[\\w_-]+)\" | "
            "stats count as search_count dc(user) as unique_users by idx | "
            "rename idx as index"
        ).format(earliest=earliest, latest=latest),
        earliest=earliest,
        latest=latest,
    )

    # Query 4: Dashboard references (summarize from saved searches)
    dash_rows = _safe_splunk_search(
        splunk,
        (
            "rest /servicesNS/-/-/saved/searches | "
            "where match(title, \"dash\") | "
            "stats count as dash_count"
        ).format(),
        earliest=earliest,
        latest=latest,
    )

    # Query 5: Parsing errors by sourcetype
    error_rows = _safe_splunk_search(
        splunk,
        (
            "search index=_internal sourcetype=splunkd log_level=ERROR earliest={earliest} latest={latest} | "
            "stats count as error_count by component | head 50"
        ).format(earliest=earliest, latest=latest),
        earliest=earliest,
        latest=latest,
    )

    if not volume_rows:
        raise RuntimeError("No volume data from Splunk — cannot build live scores")

    # Build lookup maps
    search_by_index: dict[str, dict[str, Any]] = {}
    for row in search_rows:
        idx = str(row.get("index", ""))
        search_by_index[idx] = row

    # Build SourcetypeRawData from volume rows
    raw_data_list: list[SourcetypeRawData] = []
    for row in volume_rows:
        sourcetype = str(row.get("sourcetype", "unknown"))
        index = str(row.get("index", "main"))
        daily_gb = float(row.get("daily_gb", 0.0))
        search_info = search_by_index.get(index, {})
        adhoc_count = int(float(search_info.get("search_count", 0)))
        unique_users = int(float(search_info.get("unique_users", 0)))
        mitre_pct, lantern_pct = get_coverage(sourcetype)
        raw_data_list.append(
            SourcetypeRawData(
                name=sourcetype,
                index=index,
                daily_gb=daily_gb,
                alert_count=0,
                scheduled_search_count=len(alert_rows),
                dashboard_ref_count=len(dash_rows),
                adhoc_search_count=adhoc_count,
                unique_user_count=unique_users,
                mitre_coverage_pct=mitre_pct,
                lantern_coverage_pct=lantern_pct,
                realized_alert_count=0,
                total_alert_count=0,
                parsing_error_pct=0.0,
                timestamp_error_pct=0.0,
                retention_days=90,
                total_fields=0,
                unused_field_pct=0.0,
            )
        )

    return scorer.score_many(raw_data_list)


def _safe_splunk_search(
    splunk: Any,
    query: str,
    *,
    earliest: str,
    latest: str,
) -> list[dict[str, Any]]:
    """Run a Splunk search, return empty list on any error."""
    try:
        result = splunk.run_search(query=query, earliest=earliest, latest=latest)
        if isinstance(result, list):
            return result
        if isinstance(result, dict):
            return result.get("results", result.get("rows", []))
        return []
    except Exception:
        return []
