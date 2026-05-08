"""
datasensAI v3 Cost & Savings Engine.

Calculates:
- Annual license cost per sourcetype
- Potential savings per sourcetype and overall
- 5-stage Savings Staircase
- Top-3 Quick Wins ranked by dollar impact
- GainScope: % of volume in high-value tiers
- ROI Score: composite average
"""
from __future__ import annotations

from typing import Any

from apps.api.app.services.scoring_engine import (
    SourcetypeScore,
    TIER_CRITICAL,
    TIER_IMPORTANT,
    TIER_NICE,
    TIER_WASTEFUL,
)


class CostEngine:
    def __init__(self, cost_per_gb_year: float = 150.0) -> None:
        self.cost_per_gb_year = cost_per_gb_year

    # ── Aggregate KPIs ────────────────────────────────────────────────────────

    def total_annual_cost(self, scores: list[SourcetypeScore]) -> float:
        return round(sum(s.annual_cost_usd for s in scores), 2)

    def total_potential_savings(self, scores: list[SourcetypeScore]) -> float:
        return round(sum(s.potential_savings_usd for s in scores), 2)

    def roi_score(self, scores: list[SourcetypeScore]) -> float:
        if not scores:
            return 0.0
        return round(sum(s.composite for s in scores) / len(scores), 1)

    def gainscope(self, scores: list[SourcetypeScore]) -> float:
        """% of total daily GB volume in Tier 1 + Tier 2."""
        total_vol = sum(s.gb_per_day for s in scores)
        if total_vol <= 0:
            return 0.0
        utilized = sum(s.gb_per_day for s in scores if s.tier in [TIER_CRITICAL, TIER_IMPORTANT])
        return round((utilized / total_vol) * 100, 1)

    def low_value_license_spend(self, scores: list[SourcetypeScore]) -> float:
        """Annual cost of Tier 3 + Tier 4 sourcetypes."""
        return round(
            sum(s.annual_cost_usd for s in scores if s.tier in [TIER_NICE, TIER_WASTEFUL]),
            2,
        )

    def storage_savings_potential(self, scores: list[SourcetypeScore]) -> float:
        """Estimated total savings from retention + field + S3 actions."""
        return round(sum(s.potential_savings_usd for s in scores), 2)

    def total_daily_volume_gb(self, scores: list[SourcetypeScore]) -> float:
        return round(sum(s.gb_per_day for s in scores), 3)

    # ── Tier Distribution ─────────────────────────────────────────────────────

    def tier_distribution(self, scores: list[SourcetypeScore]) -> dict[str, Any]:
        dist: dict[str, dict[str, Any]] = {
            TIER_CRITICAL: {"count": 0, "annual_cost_usd": 0.0, "daily_gb": 0.0},
            TIER_IMPORTANT: {"count": 0, "annual_cost_usd": 0.0, "daily_gb": 0.0},
            TIER_NICE: {"count": 0, "annual_cost_usd": 0.0, "daily_gb": 0.0},
            TIER_WASTEFUL: {"count": 0, "annual_cost_usd": 0.0, "daily_gb": 0.0},
        }
        total = len(scores)
        for s in scores:
            if s.tier in dist:
                dist[s.tier]["count"] += 1
                dist[s.tier]["annual_cost_usd"] += s.annual_cost_usd
                dist[s.tier]["daily_gb"] += s.gb_per_day
        for tier_data in dist.values():
            tier_data["annual_cost_usd"] = round(tier_data["annual_cost_usd"], 2)
            tier_data["daily_gb"] = round(tier_data["daily_gb"], 3)
            tier_data["pct"] = round((tier_data["count"] / total) * 100, 1) if total > 0 else 0.0
        return dist

    # ── Data Value Split ──────────────────────────────────────────────────────

    def data_value_split(self, scores: list[SourcetypeScore]) -> dict[str, Any]:
        total_gb = sum(s.gb_per_day for s in scores)
        utilized_gb = sum(s.gb_per_day for s in scores if s.tier in [TIER_CRITICAL, TIER_IMPORTANT])
        underutilized_gb = total_gb - utilized_gb
        total_count = len(scores)
        utilized_count = sum(1 for s in scores if s.tier in [TIER_CRITICAL, TIER_IMPORTANT])
        return {
            "volume": {
                "utilized_gb": round(utilized_gb, 3),
                "underutilized_gb": round(underutilized_gb, 3),
                "utilized_pct": round((utilized_gb / total_gb) * 100, 1) if total_gb > 0 else 0.0,
                "underutilized_pct": (
                    round((underutilized_gb / total_gb) * 100, 1) if total_gb > 0 else 0.0
                ),
            },
            "sourcetype_count": {
                "utilized_count": utilized_count,
                "underutilized_count": total_count - utilized_count,
                "utilized_pct": (
                    round((utilized_count / total_count) * 100, 1) if total_count > 0 else 0.0
                ),
                "underutilized_pct": (
                    round(((total_count - utilized_count) / total_count) * 100, 1)
                    if total_count > 0
                    else 0.0
                ),
            },
        }

    # ── Savings Staircase ─────────────────────────────────────────────────────

    def savings_staircase(self, scores: list[SourcetypeScore]) -> list[dict[str, Any]]:
        """5-stage cost reduction staircase."""
        stage1 = self.total_annual_cost(scores)

        # Stage 2: Retention reduction on wasteful sourcetypes with long retention
        retention_savings = sum(
            s.annual_cost_usd * min(0.67, (s.retention_days - 30) / s.retention_days)
            for s in scores
            if s.tier == TIER_WASTEFUL and s.retention_days > 30 and s.gb_per_day > 0.01
        )
        stage2 = round(max(stage1 * 0.5, stage1 - retention_savings), 2)

        # Stage 3: Field optimization on high unused-field sources
        field_savings = sum(
            s.annual_cost_usd * (s.unused_field_pct / 100.0) * 0.30
            for s in scores
            if s.unused_field_pct > 50 and s.gb_per_day > 1.0
        )
        stage3 = round(max(stage2 * 0.75, stage2 - field_savings), 2)

        # Stage 4: S3 archival for Nice-to-Have with significant volume
        s3_savings = sum(
            s.annual_cost_usd * 0.85
            for s in scores
            if s.tier == TIER_NICE and s.gb_per_day > 1.0
        )
        stage4 = round(max(stage3 * 0.50, stage3 - s3_savings), 2)

        # Stage 5: Ongoing query tuning (conservative 12%)
        stage5 = round(stage4 * 0.88, 2)

        return [
            {
                "stage": 1,
                "label": "Current Spend",
                "annual_cost_usd": stage1,
                "description": "Your current annual Splunk license cost across all sourcetypes.",
            },
            {
                "stage": 2,
                "label": "After Quick Actions",
                "annual_cost_usd": stage2,
                "description": "Savings from reducing retention on Wasteful sourcetypes (90→30 days).",
            },
            {
                "stage": 3,
                "label": "After Field Tuning",
                "annual_cost_usd": stage3,
                "description": "Additional savings from filtering unused fields (those never searched).",
            },
            {
                "stage": 4,
                "label": "After S3 Archival",
                "annual_cost_usd": stage4,
                "description": "Savings from moving Nice-to-Have data (>1 GB/day) to S3 cold storage.",
            },
            {
                "stage": 5,
                "label": "Optimized Target",
                "annual_cost_usd": stage5,
                "description": "Final optimized state with ongoing query tuning applied.",
            },
        ]

    # ── Quick Wins ────────────────────────────────────────────────────────────

    def quick_wins(self, scores: list[SourcetypeScore]) -> list[dict[str, Any]]:
        """Top 3 actions ranked by estimated dollar impact."""
        candidates: list[dict[str, Any]] = []

        # Category 1: Retention reduction
        for s in sorted(scores, key=lambda x: x.annual_cost_usd, reverse=True):
            if s.tier in [TIER_WASTEFUL, TIER_NICE] and s.retention_days > 30 and s.gb_per_day > 0.05:
                savings_pct = min(0.67, (s.retention_days - 30) / s.retention_days)
                impact = round(s.annual_cost_usd * savings_pct, 2)
                if impact > 0:
                    candidates.append({
                        "rank": 0,
                        "category": "Retention Optimization",
                        "action": (
                            f"Reduce retention on index '{s.index}' from {s.retention_days}→30 days"
                        ),
                        "sourcetype": s.sourcetype,
                        "estimated_impact_usd": impact,
                        "details": (
                            f"{s.gb_per_day:.2f} GB/day, currently retaining {s.retention_days} days"
                        ),
                    })
                    break

        # Category 2: Field optimization
        for s in sorted(
            scores, key=lambda x: x.annual_cost_usd * x.unused_field_pct, reverse=True
        ):
            if s.unused_field_pct > 50 and s.gb_per_day > 0.5 and s.total_fields > 10:
                unused_count = int(s.total_fields * s.unused_field_pct / 100)
                impact = round(s.annual_cost_usd * (s.unused_field_pct / 100) * 0.30, 2)
                if impact > 0:
                    candidates.append({
                        "rank": 0,
                        "category": "Field Optimization",
                        "action": (
                            f"Filter unused fields from '{s.sourcetype}' — "
                            f"{unused_count} of {s.total_fields} fields never searched"
                        ),
                        "sourcetype": s.sourcetype,
                        "estimated_impact_usd": impact,
                        "details": (
                            f"{s.gb_per_day:.2f} GB/day, "
                            f"{s.unused_field_pct:.1f}% of fields unused"
                        ),
                    })
                    break

        # Category 3: S3 archival
        for s in sorted(scores, key=lambda x: x.annual_cost_usd, reverse=True):
            if s.tier in [TIER_NICE, TIER_WASTEFUL] and s.gb_per_day > 1.0:
                impact = round(s.annual_cost_usd * 0.90, 2)
                candidates.append({
                    "rank": 0,
                    "category": "Archive to S3",
                    "action": (
                        f"Route '{s.sourcetype}' to S3 cold storage, access via Federated Search"
                    ),
                    "sourcetype": s.sourcetype,
                    "estimated_impact_usd": impact,
                    "details": (
                        f"{s.gb_per_day:.2f} GB/day, utilization score={s.utilization:.0f}"
                    ),
                })
                break

        # Sort by impact, assign rank
        candidates.sort(key=lambda c: c["estimated_impact_usd"], reverse=True)
        for i, c in enumerate(candidates[:3]):
            c["rank"] = i + 1
        return candidates[:3]

    # ── S3 Candidates ─────────────────────────────────────────────────────────

    def s3_candidates(self, scores: list[SourcetypeScore]) -> list[dict[str, Any]]:
        """Full list of S3/Federated Search candidates sorted by annual cost."""
        candidates = []
        for s in sorted(scores, key=lambda x: x.annual_cost_usd, reverse=True):
            if s.tier not in [TIER_NICE, TIER_WASTEFUL]:
                continue
            if s.tier == TIER_WASTEFUL and s.gb_per_day < 0.001:
                action = "Drop candidate — minimal volume, no detected value"
            elif s.alert_count > 0 or s.scheduled_search_count > 0:
                action = "Consider S3 for cold/frozen tier, keep hot for active searches"
            elif s.gb_per_day > 5.0:
                action = "Strong S3 candidate — high volume, rarely searched"
            elif s.utilization < 10:
                action = "Route to S3, use Federated Search for occasional access"
            else:
                action = "Evaluate for S3 — low utilization relative to volume"
            candidates.append({
                "sourcetype": s.sourcetype,
                "tier": s.tier,
                "composite": s.composite,
                "gb_per_day": s.gb_per_day,
                "annual_cost_usd": s.annual_cost_usd,
                "utilization": s.utilization,
                "detection": s.detection,
                "recommended_action": action,
            })
        return candidates

    # ── Top N by Volume ───────────────────────────────────────────────────────

    def top_by_volume(self, scores: list[SourcetypeScore], n: int = 6) -> list[dict[str, Any]]:
        return [
            {
                "sourcetype": s.sourcetype,
                "gb_per_day": s.gb_per_day,
                "tier": s.tier,
                "composite": s.composite,
            }
            for s in sorted(scores, key=lambda x: x.gb_per_day, reverse=True)[:n]
        ]

    # ── Score Profiles by Tier ────────────────────────────────────────────────

    def score_profiles_by_tier(
        self, scores: list[SourcetypeScore]
    ) -> dict[str, dict[str, float]]:
        """Average Utilization/Detection/Quality per tier for radar charts."""
        grouped: dict[str, list[SourcetypeScore]] = {
            TIER_CRITICAL: [],
            TIER_IMPORTANT: [],
            TIER_NICE: [],
            TIER_WASTEFUL: [],
        }
        for s in scores:
            if s.tier in grouped:
                grouped[s.tier].append(s)

        result = {}
        for tier, tier_scores in grouped.items():
            if not tier_scores:
                result[tier] = {"utilization": 0.0, "detection": 0.0, "quality": 0.0}
            else:
                result[tier] = {
                    "utilization": round(
                        sum(s.utilization for s in tier_scores) / len(tier_scores), 1
                    ),
                    "detection": round(
                        sum(s.detection for s in tier_scores) / len(tier_scores), 1
                    ),
                    "quality": round(
                        sum(s.quality for s in tier_scores) / len(tier_scores), 1
                    ),
                }
        return result

    # ── Security Gaps ─────────────────────────────────────────────────────────

    def security_gaps(self, scores: list[SourcetypeScore]) -> dict[str, Any]:
        mitre_gaps = [
            {
                "sourcetype": s.sourcetype,
                "mitre_coverage_pct": s.mitre_coverage_pct,
                "tier": s.tier,
            }
            for s in scores
            if s.mitre_coverage_pct < 25.0 and s.gb_per_day > 0.01
        ]
        operational_gaps = [
            {
                "sourcetype": s.sourcetype,
                "detection": s.detection,
                "alert_count": s.alert_count,
            }
            for s in scores
            if s.detection >= 4.0 and s.alert_count == 0
        ]
        # Domain distribution from sourcetype name heuristics
        domain_counts = {
            "infrastructure": 0,
            "network": 0,
            "cloud": 0,
            "endpoint": 0,
            "application": 0,
        }
        for s in scores:
            name_lower = s.sourcetype.lower()
            if any(
                k in name_lower
                for k in ["win", "linux", "vmware", "cpu", "mem", "disk", "syslog", "host"]
            ):
                domain_counts["infrastructure"] += 1
            elif any(
                k in name_lower
                for k in [
                    "fortigate", "cisco", "meraki", "firewall", "network", "dns", "dhcp",
                ]
            ):
                domain_counts["network"] += 1
            elif any(
                k in name_lower
                for k in ["aws", "azure", "gcp", "o365", "cloud", "s3", "office365"]
            ):
                domain_counts["cloud"] += 1
            elif any(
                k in name_lower
                for k in ["endpoint", "edr", "crowdstrike", "defender", "carbon"]
            ):
                domain_counts["endpoint"] += 1
            else:
                domain_counts["application"] += 1
        return {
            "mitre_gaps": mitre_gaps[:20],
            "mitre_gap_count": len(mitre_gaps),
            "operational_gaps": operational_gaps[:20],
            "operational_gap_count": len(operational_gaps),
            "detection_coverage_by_domain": domain_counts,
        }

    # ── Average Score Summary ─────────────────────────────────────────────────

    def avg_scores(self, scores: list[SourcetypeScore]) -> dict[str, float]:
        if not scores:
            return {"utilization": 0.0, "detection": 0.0, "quality": 0.0}
        return {
            "utilization": round(sum(s.utilization for s in scores) / len(scores), 1),
            "detection": round(sum(s.detection for s in scores) / len(scores), 1),
            "quality": round(sum(s.quality for s in scores) / len(scores), 1),
        }

    # ── Resolution Confidence ─────────────────────────────────────────────────

    def resolution_confidence(self, scores: list[SourcetypeScore]) -> float:
        """How safely can all S3/remove recommendations be implemented?"""
        factors = []
        for s in scores:
            if s.tier in [TIER_WASTEFUL, TIER_NICE]:
                if s.alert_count == 0 and s.scheduled_search_count == 0:
                    factors.append(95.0)
                elif s.alert_count > 0:
                    factors.append(25.0)
                else:
                    factors.append(60.0)
        if not factors:
            return 50.0
        return round(sum(factors) / len(factors), 1)
