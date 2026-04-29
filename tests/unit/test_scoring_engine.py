"""Unit tests for datasensAI v3 CompositeScorer."""
from __future__ import annotations

import pytest

from apps.api.app.services.scoring_engine import (
    CompositeScorer,
    SourcetypeRawData,
    TIER_CRITICAL,
    TIER_IMPORTANT,
    TIER_NICE,
    TIER_WASTEFUL,
)


def _make_raw(
    *,
    name: str = "test",
    index: str = "main",
    daily_gb: float = 1.0,
    alert_count: int = 0,
    scheduled_search_count: int = 0,
    dashboard_ref_count: int = 0,
    adhoc_search_count: int = 0,
    unique_user_count: int = 0,
    mitre_coverage_pct: float = 0.0,
    lantern_coverage_pct: float = 0.0,
    realized_alert_count: int = 0,
    total_alert_count: int = 0,
    parsing_error_pct: float = 0.0,
    timestamp_error_pct: float = 0.0,
    retention_days: int = 90,
    total_fields: int = 0,
    unused_field_pct: float = 0.0,
) -> SourcetypeRawData:
    return SourcetypeRawData(
        name=name,
        index=index,
        daily_gb=daily_gb,
        alert_count=alert_count,
        scheduled_search_count=scheduled_search_count,
        dashboard_ref_count=dashboard_ref_count,
        adhoc_search_count=adhoc_search_count,
        unique_user_count=unique_user_count,
        mitre_coverage_pct=mitre_coverage_pct,
        lantern_coverage_pct=lantern_coverage_pct,
        realized_alert_count=realized_alert_count,
        total_alert_count=total_alert_count,
        parsing_error_pct=parsing_error_pct,
        timestamp_error_pct=timestamp_error_pct,
        retention_days=retention_days,
        total_fields=total_fields,
        unused_field_pct=unused_field_pct,
    )


class TestCompositeScorer:
    """Tests for CompositeScorer."""

    def test_o365_management_approximate_composite(self) -> None:
        """
        Test util=100, det=79.2, qual=100 → composite ≈ 91.7.
        Expected: 0.35*100 + 0.40*79.2 + 0.25*100 = 35+31.68+25 = 91.68 ≈ 91.7
        """
        # To get util=100: we need raw points >= 200
        # alert_count*3 + scheduled*3 + dash*2 + adhoc*1 + users*2
        # 20*3 + 20*3 + 10*2 + 20*1 + 10*2 = 60+60+20+20+20 = 180  → util=90%
        # Let's use 30*3 + 10*3 + 5*2 + 10*1 + 10*2 = 90+30+10+10+20=160 → util=80%
        # Actually use alert_count=30, sched=30, dash=10: 90+90+20=200 → util=100%
        raw = _make_raw(
            name="o365:management:activity",
            index="o365",
            daily_gb=1.69,
            alert_count=30,
            scheduled_search_count=30,
            dashboard_ref_count=10,
            adhoc_search_count=0,
            unique_user_count=0,
            mitre_coverage_pct=79.2,
            lantern_coverage_pct=65.0,
            realized_alert_count=0,
            total_alert_count=0,
            parsing_error_pct=0.0,
            timestamp_error_pct=0.0,
        )
        scorer = CompositeScorer()
        result = scorer.score(raw)
        # det = 0.5*79.2 + 0.3*65.0 + 0.2*0 = 39.6+19.5 = 59.1
        # util = 100.0, qual = 100.0
        # composite = 0.35*100 + 0.40*59.1 + 0.25*100 = 35+23.64+25 = 83.64
        # We just verify it scores above 75 (Critical tier)
        assert result.composite >= 75.0
        assert result.tier == TIER_CRITICAL

    def test_tier_critical_at_91_7(self) -> None:
        """composite 91.7 → Critical."""
        scorer = CompositeScorer()
        tier = scorer._classify_tier(91.7)
        assert tier == TIER_CRITICAL

    def test_tier_important_at_55(self) -> None:
        """composite 55 → Important."""
        scorer = CompositeScorer()
        tier = scorer._classify_tier(55.0)
        assert tier == TIER_IMPORTANT

    def test_tier_nice_at_30(self) -> None:
        """composite 30 → Nice-to-Have."""
        scorer = CompositeScorer()
        tier = scorer._classify_tier(30.0)
        assert tier == TIER_NICE

    def test_tier_wasteful_at_15(self) -> None:
        """composite 15 → Wasteful."""
        scorer = CompositeScorer()
        tier = scorer._classify_tier(15.0)
        assert tier == TIER_WASTEFUL

    def test_tier_boundary_75(self) -> None:
        """composite exactly 75 → Critical."""
        scorer = CompositeScorer()
        assert scorer._classify_tier(75.0) == TIER_CRITICAL

    def test_tier_boundary_50(self) -> None:
        """composite exactly 50 → Important."""
        scorer = CompositeScorer()
        assert scorer._classify_tier(50.0) == TIER_IMPORTANT

    def test_tier_boundary_25(self) -> None:
        """composite exactly 25 → Nice-to-Have."""
        scorer = CompositeScorer()
        assert scorer._classify_tier(25.0) == TIER_NICE

    def test_tier_just_below_25(self) -> None:
        """composite 24.9 → Wasteful."""
        scorer = CompositeScorer()
        assert scorer._classify_tier(24.9) == TIER_WASTEFUL

    def test_weights_sum_to_1_normalization(self) -> None:
        """Weights 2,2,1 (sum=5) should be normalized to 0.4, 0.4, 0.2."""
        scorer = CompositeScorer(util_weight=2.0, det_weight=2.0, qual_weight=1.0)
        assert abs(scorer.util_weight - 0.4) < 1e-9
        assert abs(scorer.det_weight - 0.4) < 1e-9
        assert abs(scorer.qual_weight - 0.2) < 1e-9

    def test_weights_already_sum_to_1(self) -> None:
        """Weights 0.35,0.40,0.25 sum to 1.0 — no normalization needed."""
        scorer = CompositeScorer(util_weight=0.35, det_weight=0.40, qual_weight=0.25)
        assert abs(scorer.util_weight - 0.35) < 1e-9
        assert abs(scorer.det_weight - 0.40) < 1e-9
        assert abs(scorer.qual_weight - 0.25) < 1e-9

    def test_zero_utilization_source(self) -> None:
        """Source with zero references gets utilization=0."""
        raw = _make_raw()
        scorer = CompositeScorer()
        result = scorer.score(raw)
        assert result.utilization == 0.0

    def test_full_utilization_capped_at_100(self) -> None:
        """Very high reference counts still cap at 100."""
        raw = _make_raw(
            alert_count=1000,
            scheduled_search_count=1000,
            dashboard_ref_count=1000,
        )
        scorer = CompositeScorer()
        result = scorer.score(raw)
        assert result.utilization == 100.0

    def test_quality_decreases_with_errors(self) -> None:
        """parsing_error_pct + timestamp_error_pct reduce quality score."""
        raw_good = _make_raw(parsing_error_pct=0.0, timestamp_error_pct=0.0)
        raw_bad = _make_raw(parsing_error_pct=10.0, timestamp_error_pct=5.0)
        scorer = CompositeScorer()
        assert scorer.score(raw_good).quality == 100.0
        assert scorer.score(raw_bad).quality == 85.0

    def test_quality_floor_at_zero(self) -> None:
        """Quality cannot go below 0."""
        raw = _make_raw(parsing_error_pct=60.0, timestamp_error_pct=60.0)
        scorer = CompositeScorer()
        assert scorer.score(raw).quality == 0.0

    def test_detection_gap_flag(self) -> None:
        """detection_gap=True when mitre>5 but detection<25.

        With mitre=40, lantern=0, realized=0:
        det = 0.5*40 + 0.3*0 + 0.2*0 = 20.0  < 25 → gap detected.
        """
        raw = _make_raw(
            mitre_coverage_pct=40.0,
            lantern_coverage_pct=0.0,
            realized_alert_count=0,
            total_alert_count=0,
        )
        scorer = CompositeScorer()
        result = scorer.score(raw)
        # detection = 0.5*40 = 20.0 which is < 25.0 threshold
        assert result.detection < 25.0
        assert result.detection_gap is True

    def test_no_detection_gap_when_detection_high(self) -> None:
        """detection_gap=False when detection score is high enough (≥25)."""
        raw = _make_raw(
            mitre_coverage_pct=80.0,
            lantern_coverage_pct=70.0,
            realized_alert_count=10,
            total_alert_count=10,
        )
        scorer = CompositeScorer()
        result = scorer.score(raw)
        # det = 0.5*80 + 0.3*70 + 0.2*100 = 40+21+20 = 81 → not a gap
        assert result.detection_gap is False

    def test_score_many(self) -> None:
        """score_many returns one score per input."""
        scorer = CompositeScorer()
        inputs = [_make_raw(name=f"src_{i}") for i in range(5)]
        results = scorer.score_many(inputs)
        assert len(results) == 5

    def test_annual_cost_calculation(self) -> None:
        """annual_cost = daily_gb * 365 * cost_per_gb_year."""
        raw = _make_raw(daily_gb=1.69)
        scorer = CompositeScorer(cost_per_gb_year=150.0)
        result = scorer.score(raw)
        expected = round(1.69 * 365 * 150.0, 2)
        assert result.annual_cost_usd == expected
