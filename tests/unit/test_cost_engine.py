"""Unit tests for datasensAI v3 CostEngine."""
from __future__ import annotations

import pytest

from apps.api.app.services.cost_engine import CostEngine
from apps.api.app.services.scoring_engine import (
    SourcetypeScore,
    TIER_CRITICAL,
    TIER_IMPORTANT,
    TIER_NICE,
    TIER_WASTEFUL,
)


def _make_score(
    *,
    sourcetype: str = "test",
    index: str = "main",
    composite: float = 50.0,
    utilization: float = 50.0,
    detection: float = 50.0,
    quality: float = 100.0,
    tier: str = TIER_IMPORTANT,
    gb_per_day: float = 1.0,
    annual_cost_usd: float = 54750.0,  # 1.0 * 365 * 150
    potential_savings_usd: float = 10000.0,
    detection_gap: bool = False,
    retention_days: int = 90,
    total_fields: int = 20,
    unused_field_pct: float = 30.0,
    alert_count: int = 2,
    scheduled_search_count: int = 2,
    dashboard_ref_count: int = 1,
    adhoc_search_count: int = 10,
    unique_user_count: int = 5,
    mitre_coverage_pct: float = 50.0,
    lantern_coverage_pct: float = 40.0,
) -> SourcetypeScore:
    return SourcetypeScore(
        sourcetype=sourcetype,
        index=index,
        composite=composite,
        utilization=utilization,
        detection=detection,
        quality=quality,
        tier=tier,
        gb_per_day=gb_per_day,
        annual_cost_usd=annual_cost_usd,
        potential_savings_usd=potential_savings_usd,
        detection_gap=detection_gap,
        retention_days=retention_days,
        total_fields=total_fields,
        unused_field_pct=unused_field_pct,
        alert_count=alert_count,
        scheduled_search_count=scheduled_search_count,
        dashboard_ref_count=dashboard_ref_count,
        adhoc_search_count=adhoc_search_count,
        unique_user_count=unique_user_count,
        mitre_coverage_pct=mitre_coverage_pct,
        lantern_coverage_pct=lantern_coverage_pct,
    )


class TestCostEngine:
    """Tests for CostEngine."""

    def test_annual_cost_1_69_gb(self) -> None:
        """1.69 GB/day × 365 × $150 = $92,572.50."""
        engine = CostEngine(cost_per_gb_year=150.0)
        score = _make_score(gb_per_day=1.69, annual_cost_usd=round(1.69 * 365 * 150.0, 2))
        total = engine.total_annual_cost([score])
        assert total == round(1.69 * 365 * 150.0, 2)

    def test_total_annual_cost_sums(self) -> None:
        """total_annual_cost sums all annual costs."""
        engine = CostEngine()
        scores = [
            _make_score(annual_cost_usd=1000.0),
            _make_score(annual_cost_usd=2000.0),
            _make_score(annual_cost_usd=3000.0),
        ]
        assert engine.total_annual_cost(scores) == 6000.0

    def test_total_potential_savings_sums(self) -> None:
        """total_potential_savings sums all potential savings."""
        engine = CostEngine()
        scores = [
            _make_score(potential_savings_usd=500.0),
            _make_score(potential_savings_usd=1500.0),
        ]
        assert engine.total_potential_savings(scores) == 2000.0

    def test_roi_score_average(self) -> None:
        """roi_score = mean composite score."""
        engine = CostEngine()
        scores = [
            _make_score(composite=80.0),
            _make_score(composite=60.0),
        ]
        assert engine.roi_score(scores) == 70.0

    def test_roi_score_empty(self) -> None:
        """roi_score returns 0 for empty list."""
        engine = CostEngine()
        assert engine.roi_score([]) == 0.0

    def test_gainscope_all_critical(self) -> None:
        """All Critical → gainscope = 100%."""
        engine = CostEngine()
        scores = [_make_score(tier=TIER_CRITICAL, gb_per_day=10.0)]
        assert engine.gainscope(scores) == 100.0

    def test_gainscope_all_wasteful(self) -> None:
        """All Wasteful → gainscope = 0%."""
        engine = CostEngine()
        scores = [_make_score(tier=TIER_WASTEFUL, gb_per_day=10.0)]
        assert engine.gainscope(scores) == 0.0

    def test_gainscope_mixed(self) -> None:
        """50% by volume in critical → gainscope = 50%."""
        engine = CostEngine()
        scores = [
            _make_score(tier=TIER_CRITICAL, gb_per_day=5.0),
            _make_score(tier=TIER_WASTEFUL, gb_per_day=5.0),
        ]
        assert engine.gainscope(scores) == 50.0

    def test_gainscope_empty_volume(self) -> None:
        """No volume → gainscope = 0."""
        engine = CostEngine()
        scores = [_make_score(tier=TIER_CRITICAL, gb_per_day=0.0)]
        assert engine.gainscope(scores) == 0.0

    def test_savings_staircase_returns_5_stages(self) -> None:
        """savings_staircase always returns exactly 5 stages."""
        engine = CostEngine()
        scores = [
            _make_score(
                tier=TIER_WASTEFUL,
                gb_per_day=10.0,
                annual_cost_usd=547500.0,
                potential_savings_usd=400000.0,
                retention_days=90,
                total_fields=40,
                unused_field_pct=60.0,
                alert_count=0,
                scheduled_search_count=0,
            )
        ]
        staircase = engine.savings_staircase(scores)
        assert len(staircase) == 5

    def test_savings_staircase_descending(self) -> None:
        """Each stage has equal or lower cost than the previous."""
        engine = CostEngine()
        scores = [
            _make_score(
                tier=TIER_WASTEFUL,
                gb_per_day=30.0,
                annual_cost_usd=1642500.0,
                potential_savings_usd=1000000.0,
                retention_days=365,
                total_fields=80,
                unused_field_pct=70.0,
                alert_count=0,
                scheduled_search_count=0,
            )
        ]
        staircase = engine.savings_staircase(scores)
        for i in range(1, len(staircase)):
            assert staircase[i]["annual_cost_usd"] <= staircase[i - 1]["annual_cost_usd"]

    def test_savings_staircase_stage_labels(self) -> None:
        """Stage labels match expected values."""
        engine = CostEngine()
        scores = [_make_score()]
        staircase = engine.savings_staircase(scores)
        labels = [s["label"] for s in staircase]
        assert labels == [
            "Current Spend",
            "After Quick Actions",
            "After Field Tuning",
            "After S3 Archival",
            "Optimized Target",
        ]

    def test_quick_wins_at_most_3(self) -> None:
        """quick_wins returns at most 3 items."""
        engine = CostEngine()
        scores = [
            _make_score(
                sourcetype=f"src_{i}",
                tier=TIER_WASTEFUL,
                gb_per_day=5.0 + i,
                annual_cost_usd=300000.0 + i * 10000,
                potential_savings_usd=200000.0,
                retention_days=180,
                total_fields=50,
                unused_field_pct=75.0,
                alert_count=0,
                scheduled_search_count=0,
            )
            for i in range(10)
        ]
        wins = engine.quick_wins(scores)
        assert len(wins) <= 3

    def test_quick_wins_ranked(self) -> None:
        """Quick wins have rank 1, 2, 3."""
        engine = CostEngine()
        scores = [
            _make_score(
                sourcetype="big_wasteful",
                tier=TIER_WASTEFUL,
                gb_per_day=30.0,
                annual_cost_usd=1642500.0,
                potential_savings_usd=1000000.0,
                retention_days=365,
                total_fields=80,
                unused_field_pct=75.0,
                alert_count=0,
                scheduled_search_count=0,
            )
        ]
        wins = engine.quick_wins(scores)
        for i, win in enumerate(wins):
            assert win["rank"] == i + 1

    def test_tier_distribution_counts(self) -> None:
        """Tier distribution correctly counts per tier."""
        engine = CostEngine()
        scores = [
            _make_score(tier=TIER_CRITICAL, annual_cost_usd=100.0, gb_per_day=1.0),
            _make_score(tier=TIER_CRITICAL, annual_cost_usd=100.0, gb_per_day=1.0),
            _make_score(tier=TIER_WASTEFUL, annual_cost_usd=50.0, gb_per_day=0.5),
        ]
        dist = engine.tier_distribution(scores)
        assert dist[TIER_CRITICAL]["count"] == 2
        assert dist[TIER_WASTEFUL]["count"] == 1
        assert dist[TIER_IMPORTANT]["count"] == 0

    def test_data_value_split_structure(self) -> None:
        """data_value_split returns volume and sourcetype_count sub-dicts."""
        engine = CostEngine()
        scores = [
            _make_score(tier=TIER_CRITICAL, gb_per_day=10.0),
            _make_score(tier=TIER_WASTEFUL, gb_per_day=10.0),
        ]
        split = engine.data_value_split(scores)
        assert "volume" in split
        assert "sourcetype_count" in split
        assert split["volume"]["utilized_pct"] == 50.0
        assert split["sourcetype_count"]["utilized_count"] == 1

    def test_avg_scores_empty(self) -> None:
        """avg_scores returns zeros for empty input."""
        engine = CostEngine()
        result = engine.avg_scores([])
        assert result == {"utilization": 0.0, "detection": 0.0, "quality": 0.0}

    def test_avg_scores_computed(self) -> None:
        """avg_scores returns mean of each dimension."""
        engine = CostEngine()
        scores = [
            _make_score(utilization=40.0, detection=60.0, quality=80.0),
            _make_score(utilization=60.0, detection=40.0, quality=100.0),
        ]
        result = engine.avg_scores(scores)
        assert result["utilization"] == 50.0
        assert result["detection"] == 50.0
        assert result["quality"] == 90.0

    def test_resolution_confidence_high_when_no_active_consumers(self) -> None:
        """Wasteful sourcetypes with no alerts/searches → confidence ≈ 95."""
        engine = CostEngine()
        scores = [
            _make_score(
                tier=TIER_WASTEFUL,
                alert_count=0,
                scheduled_search_count=0,
            )
        ]
        conf = engine.resolution_confidence(scores)
        assert conf == 95.0

    def test_resolution_confidence_low_when_alerts_exist(self) -> None:
        """Wasteful sourcetypes with active alerts → low confidence."""
        engine = CostEngine()
        scores = [
            _make_score(
                tier=TIER_WASTEFUL,
                alert_count=5,
                scheduled_search_count=0,
            )
        ]
        conf = engine.resolution_confidence(scores)
        assert conf == 25.0

    def test_security_gaps_structure(self) -> None:
        """security_gaps returns expected keys."""
        engine = CostEngine()
        scores = [_make_score(mitre_coverage_pct=10.0, gb_per_day=1.0, detection=5.0)]
        gaps = engine.security_gaps(scores)
        assert "mitre_gaps" in gaps
        assert "mitre_gap_count" in gaps
        assert "operational_gaps" in gaps
        assert "operational_gap_count" in gaps
        assert "detection_coverage_by_domain" in gaps

    def test_s3_candidates_only_low_tiers(self) -> None:
        """s3_candidates only includes Nice-to-Have and Wasteful tiers."""
        engine = CostEngine()
        scores = [
            _make_score(sourcetype="critical_src", tier=TIER_CRITICAL, gb_per_day=5.0),
            _make_score(sourcetype="important_src", tier=TIER_IMPORTANT, gb_per_day=5.0),
            _make_score(sourcetype="nice_src", tier=TIER_NICE, gb_per_day=5.0),
            _make_score(sourcetype="wasteful_src", tier=TIER_WASTEFUL, gb_per_day=5.0),
        ]
        candidates = engine.s3_candidates(scores)
        tiers = {c["tier"] for c in candidates}
        assert TIER_CRITICAL not in tiers
        assert TIER_IMPORTANT not in tiers
        assert TIER_NICE in tiers or TIER_WASTEFUL in tiers
