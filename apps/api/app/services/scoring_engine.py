"""
datasensAI v3 Composite Scoring Engine.

Scores every Splunk sourcetype on three dimensions:
- Utilization (35%): weighted count of knowledge-object references
- Detection (40%): MITRE ATT&CK + Lantern coverage + realized alerts
- Quality (25%): inverse of parse/timestamp error rate

Composite score 0-100 → Tier classification.
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import Any


TIER_CRITICAL = "Critical"      # composite >= 75
TIER_IMPORTANT = "Important"    # composite >= 50
TIER_NICE = "Nice-to-Have"      # composite >= 25
TIER_WASTEFUL = "Wasteful"      # composite < 25

TIER_COLORS = {
    TIER_CRITICAL: "#4caf50",
    TIER_IMPORTANT: "#2196f3",
    TIER_NICE: "#ff9800",
    TIER_WASTEFUL: "#f44336",
}


@dataclass
class SourcetypeRawData:
    """Raw Splunk-derived inputs for a single sourcetype."""
    name: str
    index: str
    daily_gb: float = 0.0
    alert_count: int = 0
    scheduled_search_count: int = 0
    dashboard_ref_count: int = 0
    adhoc_search_count: int = 0
    unique_user_count: int = 0
    mitre_coverage_pct: float = 0.0
    lantern_coverage_pct: float = 0.0
    realized_alert_count: int = 0
    total_alert_count: int = 0
    parsing_error_pct: float = 0.0
    timestamp_error_pct: float = 0.0
    retention_days: int = 90
    total_fields: int = 0
    unused_field_pct: float = 0.0


@dataclass
class SourcetypeScore:
    """Scored result for a single sourcetype."""
    sourcetype: str
    index: str
    composite: float
    utilization: float
    detection: float
    quality: float
    tier: str
    gb_per_day: float
    annual_cost_usd: float
    potential_savings_usd: float
    detection_gap: bool
    retention_days: int
    total_fields: int
    unused_field_pct: float
    alert_count: int
    scheduled_search_count: int
    dashboard_ref_count: int
    adhoc_search_count: int
    unique_user_count: int
    mitre_coverage_pct: float
    lantern_coverage_pct: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "sourcetype": self.sourcetype,
            "index": self.index,
            "composite": self.composite,
            "utilization": self.utilization,
            "detection": self.detection,
            "quality": self.quality,
            "tier": self.tier,
            "gb_per_day": self.gb_per_day,
            "annual_cost_usd": self.annual_cost_usd,
            "potential_savings_usd": self.potential_savings_usd,
            "detection_gap": self.detection_gap,
            "retention_days": self.retention_days,
            "total_fields": self.total_fields,
            "unused_field_pct": self.unused_field_pct,
            "alert_count": self.alert_count,
            "scheduled_search_count": self.scheduled_search_count,
            "dashboard_ref_count": self.dashboard_ref_count,
            "adhoc_search_count": self.adhoc_search_count,
            "unique_user_count": self.unique_user_count,
            "mitre_coverage_pct": self.mitre_coverage_pct,
            "lantern_coverage_pct": self.lantern_coverage_pct,
        }


# Empirical max for normalization (a source referenced by 10 alerts, 10 scheduled, 5 dashboards,
# 50 adhoc searches, 20 users would score about 200 raw points → maps to 100)
_MAX_UTIL_POINTS = 200.0


class CompositeScorer:
    """
    Scores sourcetypes across three weighted dimensions.

    Default weights: utilization=0.35, detection=0.40, quality=0.25.
    Weights are validated to sum to 1.0 (±0.01 tolerance).
    """

    def __init__(
        self,
        util_weight: float = 0.35,
        det_weight: float = 0.40,
        qual_weight: float = 0.25,
        cost_per_gb_year: float = 150.0,
    ) -> None:
        total = util_weight + det_weight + qual_weight
        if abs(total - 1.0) > 0.01:
            # Normalize weights if they don't sum to 1
            util_weight = util_weight / total
            det_weight = det_weight / total
            qual_weight = qual_weight / total
        self.util_weight = util_weight
        self.det_weight = det_weight
        self.qual_weight = qual_weight
        self.cost_per_gb_year = cost_per_gb_year

    def score(self, data: SourcetypeRawData) -> SourcetypeScore:
        utilization = self._utilization_score(data)
        detection = self._detection_score(data)
        quality = self._quality_score(data)
        composite = round(
            self.util_weight * utilization
            + self.det_weight * detection
            + self.qual_weight * quality,
            1,
        )
        tier = self._classify_tier(composite)
        annual_cost = round(data.daily_gb * 365 * self.cost_per_gb_year, 2)
        # Savings proportional to unused capacity: higher waste tier = higher savings
        savings_pct = max(0.0, 1.0 - utilization / 100.0)
        if tier == TIER_WASTEFUL:
            savings_pct = min(0.95, savings_pct + 0.3)
        elif tier == TIER_NICE:
            savings_pct = min(0.70, savings_pct + 0.1)
        potential_savings = round(annual_cost * savings_pct, 2)
        detection_gap = (
            (data.mitre_coverage_pct > 5 or data.lantern_coverage_pct > 5)
            and detection < 25.0
        )
        return SourcetypeScore(
            sourcetype=data.name,
            index=data.index,
            composite=composite,
            utilization=round(utilization, 1),
            detection=round(detection, 1),
            quality=round(quality, 1),
            tier=tier,
            gb_per_day=round(data.daily_gb, 3),
            annual_cost_usd=annual_cost,
            potential_savings_usd=potential_savings,
            detection_gap=detection_gap,
            retention_days=data.retention_days,
            total_fields=data.total_fields,
            unused_field_pct=round(data.unused_field_pct, 1),
            alert_count=data.alert_count,
            scheduled_search_count=data.scheduled_search_count,
            dashboard_ref_count=data.dashboard_ref_count,
            adhoc_search_count=data.adhoc_search_count,
            unique_user_count=data.unique_user_count,
            mitre_coverage_pct=round(data.mitre_coverage_pct, 1),
            lantern_coverage_pct=round(data.lantern_coverage_pct, 1),
        )

    def score_many(self, data_list: list[SourcetypeRawData]) -> list[SourcetypeScore]:
        return [self.score(d) for d in data_list]

    def _utilization_score(self, data: SourcetypeRawData) -> float:
        raw = (
            data.alert_count * 3
            + data.scheduled_search_count * 3
            + data.dashboard_ref_count * 2
            + data.adhoc_search_count * 1
            + data.unique_user_count * 2
        )
        return min(100.0, (raw / _MAX_UTIL_POINTS) * 100.0)

    def _detection_score(self, data: SourcetypeRawData) -> float:
        realized_ratio = 0.0
        if data.total_alert_count > 0:
            realized_ratio = min(100.0, (data.realized_alert_count / data.total_alert_count) * 100.0)
        return min(100.0, (
            0.5 * min(100.0, data.mitre_coverage_pct)
            + 0.3 * min(100.0, data.lantern_coverage_pct)
            + 0.2 * realized_ratio
        ))

    def _quality_score(self, data: SourcetypeRawData) -> float:
        return max(0.0, 100.0 - data.parsing_error_pct - data.timestamp_error_pct)

    def _classify_tier(self, composite: float) -> str:
        if composite >= 75:
            return TIER_CRITICAL
        if composite >= 50:
            return TIER_IMPORTANT
        if composite >= 25:
            return TIER_NICE
        return TIER_WASTEFUL
