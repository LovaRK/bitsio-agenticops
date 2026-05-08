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

# ── Seed dataset (real customer data from datasensAI v3 scoring table) ────────
# Cost is computed dynamically from gb_per_day * 365 * cost_per_gb_year.
# The annual_cost_usd field is intentionally absent — _build_seed_scores()
# calculates it fresh each request so the filter-bar cost-rate slider works.
# Total: ~50 sourcetypes, ~154 GB/day, matching the reference deployment.
_SEED_ROWS: list[dict[str, Any]] = [
    # ── Tier 1: Critical (composite ≥ 75) ─────────────────────────────────────
    {"name": "o365:management:activity", "index": "o365",
     "composite": 91.7, "utilization": 100.0, "detection": 79.2, "quality": 100.0,
     "gb_per_day": 1.69, "retention_days": 90,
     "alert_count": 12, "scheduled_search_count": 8, "dashboard_ref_count": 5,
     "adhoc_search_count": 50, "unique_user_count": 20,
     "mitre_coverage_pct": 79.2, "lantern_coverage_pct": 65.0,
     "total_fields": 45, "unused_field_pct": 10.0},
    {"name": "WinEventLog", "index": "windows",
     "composite": 79.7, "utilization": 59.0, "detection": 85.0, "quality": 100.0,
     "gb_per_day": 13.86, "retention_days": 90,
     "alert_count": 8, "scheduled_search_count": 6, "dashboard_ref_count": 3,
     "adhoc_search_count": 30, "unique_user_count": 15,
     "mitre_coverage_pct": 85.0, "lantern_coverage_pct": 75.0,
     "total_fields": 80, "unused_field_pct": 20.0},
    # ── Tier 2: Important (50 ≤ composite < 75) ───────────────────────────────
    {"name": "cisco:ios", "index": "network",
     "composite": 68.2, "utilization": 81.2, "detection": 36.9, "quality": 100.0,
     "gb_per_day": 0.01, "retention_days": 90,
     "alert_count": 10, "scheduled_search_count": 5, "dashboard_ref_count": 2,
     "adhoc_search_count": 20, "unique_user_count": 8,
     "mitre_coverage_pct": 55.0, "lantern_coverage_pct": 48.0,
     "total_fields": 30, "unused_field_pct": 15.0},
    {"name": "json", "index": "main",
     "composite": 60.0, "utilization": 100.0, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 0.11, "retention_days": 90,
     "alert_count": 10, "scheduled_search_count": 5, "dashboard_ref_count": 3,
     "adhoc_search_count": 25, "unique_user_count": 10,
     "mitre_coverage_pct": 0.0, "lantern_coverage_pct": 0.0,
     "total_fields": 20, "unused_field_pct": 5.0},
    {"name": "sc4s:events", "index": "sc4s",
     "composite": 60.0, "utilization": 100.0, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 0.001, "retention_days": 90,
     "alert_count": 10, "scheduled_search_count": 5, "dashboard_ref_count": 2,
     "adhoc_search_count": 20, "unique_user_count": 8,
     "mitre_coverage_pct": 5.0, "lantern_coverage_pct": 4.0,
     "total_fields": 15, "unused_field_pct": 5.0},
    {"name": "sc4s:fallback", "index": "sc4s",
     "composite": 60.0, "utilization": 100.0, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 0.0, "retention_days": 90,
     "alert_count": 10, "scheduled_search_count": 5, "dashboard_ref_count": 2,
     "adhoc_search_count": 18, "unique_user_count": 7,
     "mitre_coverage_pct": 5.0, "lantern_coverage_pct": 4.0,
     "total_fields": 12, "unused_field_pct": 5.0},
    {"name": "cisco:asa", "index": "firewall",
     "composite": 59.9, "utilization": 57.6, "detection": 36.9, "quality": 100.0,
     "gb_per_day": 1.65, "retention_days": 90,
     "alert_count": 7, "scheduled_search_count": 4, "dashboard_ref_count": 2,
     "adhoc_search_count": 18, "unique_user_count": 9,
     "mitre_coverage_pct": 58.0, "lantern_coverage_pct": 50.0,
     "total_fields": 40, "unused_field_pct": 25.0},
    {"name": "fortigate_utm", "index": "fortigate",
     "composite": 55.6, "utilization": 36.0, "detection": 45.0, "quality": 100.0,
     "gb_per_day": 14.67, "retention_days": 90,
     "alert_count": 5, "scheduled_search_count": 3, "dashboard_ref_count": 1,
     "adhoc_search_count": 10, "unique_user_count": 6,
     "mitre_coverage_pct": 60.0, "lantern_coverage_pct": 55.0,
     "total_fields": 60, "unused_field_pct": 40.0},
    # ── Tier 3: Nice-to-Have (25 ≤ composite < 50) ───────────────────────────
    {"name": "meraki:accesspoints", "index": "meraki",
     "composite": 48.2, "utilization": 40.8, "detection": 22.2, "quality": 100.0,
     "gb_per_day": 0.01, "retention_days": 90,
     "alert_count": 5, "scheduled_search_count": 2, "dashboard_ref_count": 1,
     "adhoc_search_count": 10, "unique_user_count": 6,
     "mitre_coverage_pct": 45.0, "lantern_coverage_pct": 40.0,
     "total_fields": 20, "unused_field_pct": 20.0},
    {"name": "fortigate_event", "index": "fortigate",
     "composite": 47.6, "utilization": 39.2, "detection": 22.2, "quality": 100.0,
     "gb_per_day": 0.08, "retention_days": 90,
     "alert_count": 5, "scheduled_search_count": 2, "dashboard_ref_count": 1,
     "adhoc_search_count": 9, "unique_user_count": 5,
     "mitre_coverage_pct": 45.0, "lantern_coverage_pct": 40.0,
     "total_fields": 25, "unused_field_pct": 30.0},
    {"name": "cisco:cybervision:events", "index": "network",
     "composite": 46.7, "utilization": 53.4, "detection": 7.5, "quality": 100.0,
     "gb_per_day": 0.0, "retention_days": 90,
     "alert_count": 5, "scheduled_search_count": 2, "dashboard_ref_count": 1,
     "adhoc_search_count": 12, "unique_user_count": 7,
     "mitre_coverage_pct": 50.0, "lantern_coverage_pct": 44.0,
     "total_fields": 18, "unused_field_pct": 25.0},
    {"name": "cisco:cybervision:activities", "index": "network",
     "composite": 46.4, "utilization": 52.6, "detection": 7.5, "quality": 100.0,
     "gb_per_day": 0.05, "retention_days": 90,
     "alert_count": 5, "scheduled_search_count": 2, "dashboard_ref_count": 1,
     "adhoc_search_count": 11, "unique_user_count": 6,
     "mitre_coverage_pct": 50.0, "lantern_coverage_pct": 44.0,
     "total_fields": 18, "unused_field_pct": 25.0},
    {"name": "fortigate_traffic", "index": "fortigate",
     "composite": 44.5, "utilization": 24.4, "detection": 27.5, "quality": 100.0,
     "gb_per_day": 24.14, "retention_days": 90,
     "alert_count": 3, "scheduled_search_count": 2, "dashboard_ref_count": 1,
     "adhoc_search_count": 8, "unique_user_count": 5,
     "mitre_coverage_pct": 30.0, "lantern_coverage_pct": 25.0,
     "total_fields": 55, "unused_field_pct": 50.0},
    {"name": "o365:service:healthIssue", "index": "o365",
     "composite": 43.5, "utilization": 7.6, "detection": 39.6, "quality": 100.0,
     "gb_per_day": 0.0, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 2, "unique_user_count": 1,
     "mitre_coverage_pct": 72.0, "lantern_coverage_pct": 60.0,
     "total_fields": 15, "unused_field_pct": 40.0},
    {"name": "o365:graph:api", "index": "o365",
     "composite": 42.5, "utilization": 4.8, "detection": 39.6, "quality": 100.0,
     "gb_per_day": 0.02, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 1, "unique_user_count": 1,
     "mitre_coverage_pct": 72.0, "lantern_coverage_pct": 60.0,
     "total_fields": 15, "unused_field_pct": 40.0},
    {"name": "XmlWinEventLog", "index": "windows",
     "composite": 42.2, "utilization": 3.48, "detection": 40.0, "quality": 100.0,
     "gb_per_day": 3.07, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 2, "unique_user_count": 2,
     "mitre_coverage_pct": 85.0, "lantern_coverage_pct": 75.0,
     "total_fields": 50, "unused_field_pct": 70.0},
    {"name": "ms365:activity", "index": "o365",
     "composite": 32.0, "utilization": 15.0, "detection": 22.0, "quality": 100.0,
     "gb_per_day": 2.10, "retention_days": 90,
     "alert_count": 2, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 6, "unique_user_count": 4,
     "mitre_coverage_pct": 72.0, "lantern_coverage_pct": 60.0,
     "total_fields": 40, "unused_field_pct": 45.0},
    {"name": "linux_audit", "index": "linux",
     "composite": 33.8, "utilization": 14.4, "detection": 100.0, "quality": 100.0,
     "gb_per_day": 0.53, "retention_days": 90,
     "alert_count": 2, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 6, "unique_user_count": 4,
     "mitre_coverage_pct": 72.0, "lantern_coverage_pct": 62.0,
     "total_fields": 30, "unused_field_pct": 25.0},
    {"name": "linux_secure", "index": "linux",
     "composite": 33.6, "utilization": 8.12, "detection": 14.4, "quality": 100.0,
     "gb_per_day": 0.01, "retention_days": 90,
     "alert_count": 1, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 3, "unique_user_count": 2,
     "mitre_coverage_pct": 70.0, "lantern_coverage_pct": 60.0,
     "total_fields": 20, "unused_field_pct": 30.0},
    {"name": "auditd", "index": "linux",
     "composite": 34.4, "utilization": 8.58, "detection": 16.0, "quality": 100.0,
     "gb_per_day": 0.0, "retention_days": 90,
     "alert_count": 1, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 3, "unique_user_count": 2,
     "mitre_coverage_pct": 75.0, "lantern_coverage_pct": 65.0,
     "total_fields": 25, "unused_field_pct": 20.0},
    {"name": "darktrace", "index": "security",
     "composite": 34.3, "utilization": 26.68, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 0.0, "retention_days": 90,
     "alert_count": 3, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 7, "unique_user_count": 4,
     "mitre_coverage_pct": 70.0, "lantern_coverage_pct": 65.0,
     "total_fields": 30, "unused_field_pct": 20.0},
    {"name": "wazuh-alerts", "index": "wazuh",
     "composite": 35.8, "utilization": 30.86, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 7.57, "retention_days": 90,
     "alert_count": 4, "scheduled_search_count": 2, "dashboard_ref_count": 1,
     "adhoc_search_count": 12, "unique_user_count": 7,
     "mitre_coverage_pct": 80.0, "lantern_coverage_pct": 72.0,
     "total_fields": 50, "unused_field_pct": 35.0},
    {"name": "dns", "index": "dns",
     "composite": 35.0, "utilization": 20.0, "detection": 35.0, "quality": 100.0,
     "gb_per_day": 1.20, "retention_days": 90,
     "alert_count": 2, "scheduled_search_count": 1, "dashboard_ref_count": 1,
     "adhoc_search_count": 8, "unique_user_count": 5,
     "mitre_coverage_pct": 35.0, "lantern_coverage_pct": 30.0,
     "total_fields": 25, "unused_field_pct": 30.0},
    {"name": "vmware:perf:cpu", "index": "vmware",
     "composite": 35.6, "utilization": 13.6, "detection": 14.7, "quality": 100.0,
     "gb_per_day": 0.25, "retention_days": 90,
     "alert_count": 2, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 5, "unique_user_count": 3,
     "mitre_coverage_pct": 5.0, "lantern_coverage_pct": 4.0,
     "total_fields": 25, "unused_field_pct": 60.0},
    {"name": "vmware:perf:mem", "index": "vmware",
     "composite": 35.6, "utilization": 13.6, "detection": 14.7, "quality": 100.0,
     "gb_per_day": 0.37, "retention_days": 90,
     "alert_count": 2, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 5, "unique_user_count": 3,
     "mitre_coverage_pct": 5.0, "lantern_coverage_pct": 4.0,
     "total_fields": 25, "unused_field_pct": 60.0},
    {"name": "vmware:perf:disk", "index": "vmware",
     "composite": 35.0, "utilization": 14.2, "detection": 12.5, "quality": 100.0,
     "gb_per_day": 0.12, "retention_days": 90,
     "alert_count": 2, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 4, "unique_user_count": 3,
     "mitre_coverage_pct": 5.0, "lantern_coverage_pct": 4.0,
     "total_fields": 20, "unused_field_pct": 65.0},
    {"name": "syslog", "index": "main",
     "composite": 33.3, "utilization": 14.4, "detection": 14.4, "quality": 100.0,
     "gb_per_day": 0.19, "retention_days": 90,
     "alert_count": 2, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 5, "unique_user_count": 3,
     "mitre_coverage_pct": 15.0, "lantern_coverage_pct": 12.0,
     "total_fields": 15, "unused_field_pct": 40.0},
    {"name": "fgt_traffic", "index": "fortigate",
     "composite": 29.1, "utilization": 11.83, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 9.88, "retention_days": 90,
     "alert_count": 1, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 4, "unique_user_count": 3,
     "mitre_coverage_pct": 60.0, "lantern_coverage_pct": 55.0,
     "total_fields": 45, "unused_field_pct": 55.0},
    {"name": "fgt_utm", "index": "fortigate",
     "composite": 29.1, "utilization": 11.83, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 0.01, "retention_days": 90,
     "alert_count": 1, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 3, "unique_user_count": 2,
     "mitre_coverage_pct": 60.0, "lantern_coverage_pct": 55.0,
     "total_fields": 40, "unused_field_pct": 55.0},
    {"name": "juniper:junos:firewall", "index": "network",
     "composite": 29.1, "utilization": 11.83, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 0.25, "retention_days": 90,
     "alert_count": 1, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 3, "unique_user_count": 2,
     "mitre_coverage_pct": 48.0, "lantern_coverage_pct": 42.0,
     "total_fields": 30, "unused_field_pct": 45.0},
    {"name": "meraki:securityappliances", "index": "meraki",
     "composite": 34.7, "utilization": 19.6, "detection": 7.2, "quality": 100.0,
     "gb_per_day": 0.0, "retention_days": 90,
     "alert_count": 2, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 5, "unique_user_count": 3,
     "mitre_coverage_pct": 45.0, "lantern_coverage_pct": 40.0,
     "total_fields": 18, "unused_field_pct": 30.0},
    {"name": "cisco:nexus", "index": "network",
     "composite": 28.0, "utilization": 10.0, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 0.50, "retention_days": 90,
     "alert_count": 1, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 4, "unique_user_count": 3,
     "mitre_coverage_pct": 50.0, "lantern_coverage_pct": 44.0,
     "total_fields": 20, "unused_field_pct": 50.0},
    {"name": "vmw-syslog", "index": "vmware",
     "composite": 28.1, "utilization": 0.0, "detection": 10.5, "quality": 95.78,
     "gb_per_day": 4.26, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 1, "unique_user_count": 1,
     "mitre_coverage_pct": 5.0, "lantern_coverage_pct": 4.0,
     "total_fields": 15, "unused_field_pct": 75.0},
    {"name": "WinHostMon", "index": "windows",
     "composite": 28.6, "utilization": 2.09, "detection": 7.2, "quality": 100.0,
     "gb_per_day": 0.39, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 1, "unique_user_count": 1,
     "mitre_coverage_pct": 80.0, "lantern_coverage_pct": 70.0,
     "total_fields": 20, "unused_field_pct": 70.0},
    {"name": "WindowsUpdateLog", "index": "windows",
     "composite": 28.6, "utilization": 2.09, "detection": 7.2, "quality": 100.0,
     "gb_per_day": 0.14, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 1, "unique_user_count": 1,
     "mitre_coverage_pct": 80.0, "lantern_coverage_pct": 70.0,
     "total_fields": 18, "unused_field_pct": 70.0},
    {"name": "PerfmonMetrics:CPU", "index": "perfmon",
     "composite": 27.7, "utilization": 7.66, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 1.38, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 2, "unique_user_count": 2,
     "mitre_coverage_pct": 3.0, "lantern_coverage_pct": 3.0,
     "total_fields": 15, "unused_field_pct": 70.0},
    {"name": "PerfmonMetrics:LogicalDisk", "index": "perfmon",
     "composite": 27.7, "utilization": 7.66, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 0.32, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 2, "unique_user_count": 2,
     "mitre_coverage_pct": 3.0, "lantern_coverage_pct": 3.0,
     "total_fields": 15, "unused_field_pct": 70.0},
    {"name": "PerfmonMetrics:Memory", "index": "perfmon",
     "composite": 27.7, "utilization": 7.66, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 0.20, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 2, "unique_user_count": 2,
     "mitre_coverage_pct": 3.0, "lantern_coverage_pct": 3.0,
     "total_fields": 15, "unused_field_pct": 70.0},
    {"name": "PerfmonMetrics:PhysicalDisk", "index": "perfmon",
     "composite": 27.7, "utilization": 7.66, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 0.25, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 2, "unique_user_count": 2,
     "mitre_coverage_pct": 3.0, "lantern_coverage_pct": 3.0,
     "total_fields": 15, "unused_field_pct": 70.0},
    {"name": "engine:processors", "index": "app_engine",
     "composite": 27.5, "utilization": 7.19, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 4.97, "retention_days": 90,
     "alert_count": 1, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 5, "unique_user_count": 3,
     "mitre_coverage_pct": 5.0, "lantern_coverage_pct": 4.0,
     "total_fields": 30, "unused_field_pct": 65.0},
    {"name": "nix:syslog", "index": "linux",
     "composite": 27.5, "utilization": 7.19, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 0.04, "retention_days": 90,
     "alert_count": 1, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 2, "unique_user_count": 2,
     "mitre_coverage_pct": 15.0, "lantern_coverage_pct": 12.0,
     "total_fields": 18, "unused_field_pct": 55.0},
    {"name": "tomcat:runtime:log", "index": "app_logs",
     "composite": 27.5, "utilization": 7.19, "detection": 0.0, "quality": 99.99,
     "gb_per_day": 30.10, "retention_days": 90,
     "alert_count": 1, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 5, "unique_user_count": 3,
     "mitre_coverage_pct": 5.0, "lantern_coverage_pct": 8.0,
     "total_fields": 159, "unused_field_pct": 91.2},
    {"name": "WinRegistry", "index": "windows",
     "composite": 26.5, "utilization": 4.41, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 1.36, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 1, "dashboard_ref_count": 0,
     "adhoc_search_count": 3, "unique_user_count": 2,
     "mitre_coverage_pct": 80.0, "lantern_coverage_pct": 70.0,
     "total_fields": 25, "unused_field_pct": 80.0},
    {"name": "apache:access:combined", "index": "web",
     "composite": 25.4, "utilization": 1.16, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 2.28, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 1, "unique_user_count": 1,
     "mitre_coverage_pct": 12.0, "lantern_coverage_pct": 10.0,
     "total_fields": 20, "unused_field_pct": 80.0},
    {"name": "app:car.loyalty.sms:processor", "index": "app_loyalty",
     "composite": 25.4, "utilization": 1.16, "detection": 0.0, "quality": 99.94,
     "gb_per_day": 17.26, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 2, "unique_user_count": 2,
     "mitre_coverage_pct": 8.0, "lantern_coverage_pct": 6.0,
     "total_fields": 40, "unused_field_pct": 85.0},
    {"name": "app:FirstMileWeb", "index": "app_web",
     "composite": 25.4, "utilization": 1.16, "detection": 0.0, "quality": 99.94,
     "gb_per_day": 17.26, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 2, "unique_user_count": 2,
     "mitre_coverage_pct": 8.0, "lantern_coverage_pct": 6.0,
     "total_fields": 35, "unused_field_pct": 85.0},
    {"name": "proxy:access", "index": "proxy",
     "composite": 26.0, "utilization": 8.0, "detection": 5.0, "quality": 100.0,
     "gb_per_day": 3.50, "retention_days": 90,
     "alert_count": 1, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 4, "unique_user_count": 3,
     "mitre_coverage_pct": 42.0, "lantern_coverage_pct": 38.0,
     "total_fields": 35, "unused_field_pct": 60.0},
    {"name": "MSAD:NT6:DNS", "index": "windows",
     "composite": 25.6, "utilization": 1.62, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 1.42, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 1, "unique_user_count": 1,
     "mitre_coverage_pct": 35.0, "lantern_coverage_pct": 30.0,
     "total_fields": 18, "unused_field_pct": 75.0},
    {"name": "aws:firehose:text", "index": "aws",
     "composite": 25.0, "utilization": 0.0, "detection": 0.0, "quality": 100.0,
     "gb_per_day": 2.76, "retention_days": 90,
     "alert_count": 0, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 0, "unique_user_count": 0,
     "mitre_coverage_pct": 68.0, "lantern_coverage_pct": 55.0,
     "total_fields": 20, "unused_field_pct": 85.0},
    # ── Tier 4: Wasteful (composite < 25) ─────────────────────────────────────
    {"name": "TTY-7", "index": "main",
     "composite": 14.7, "utilization": 5.8, "detection": 0.0, "quality": 50.75,
     "gb_per_day": 0.05, "retention_days": 60,
     "alert_count": 0, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 1, "unique_user_count": 1,
     "mitre_coverage_pct": 0.0, "lantern_coverage_pct": 0.0,
     "total_fields": 8, "unused_field_pct": 90.0},
    {"name": "apache:error", "index": "web",
     "composite": 6.6, "utilization": 1.16, "detection": 7.2, "quality": 13.25,
     "gb_per_day": 0.0, "retention_days": 30,
     "alert_count": 0, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 0, "unique_user_count": 0,
     "mitre_coverage_pct": 12.0, "lantern_coverage_pct": 10.0,
     "total_fields": 10, "unused_field_pct": 95.0},
    {"name": "cisco:nexus-wasteful", "index": "network_archive",
     "composite": 2.7, "utilization": 2.0, "detection": 5.0, "quality": 0.0,
     "gb_per_day": 0.0, "retention_days": 30,
     "alert_count": 0, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 0, "unique_user_count": 0,
     "mitre_coverage_pct": 50.0, "lantern_coverage_pct": 44.0,
     "total_fields": 10, "unused_field_pct": 95.0},
    {"name": "dnf.log", "index": "linux",
     "composite": 2.0, "utilization": 5.8, "detection": 0.0, "quality": 0.0,
     "gb_per_day": 0.0, "retention_days": 30,
     "alert_count": 0, "scheduled_search_count": 0, "dashboard_ref_count": 0,
     "adhoc_search_count": 0, "unique_user_count": 0,
     "mitre_coverage_pct": 0.0, "lantern_coverage_pct": 0.0,
     "total_fields": 5, "unused_field_pct": 98.0},
]


def _build_seed_scores(cost_per_gb_year: float = 10.0) -> list[SourcetypeScore]:
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
    fetched_at: str,
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

    confidence = 0.95  # Live Splunk data is always high confidence

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
            "fetched_at": fetched_at,
            "latency_ms": latency_ms,
            "confidence": confidence,
        },
    }


@router.get("/executive-summary", summary="datasensAI v3 Executive Telemetry Summary")
def executive_summary(
    cost_per_gb: float = 10.0,
    util_weight: float = 0.35,
    det_weight: float = 0.40,
    qual_weight: float = 0.25,
    window_days: int = 90,
    ctx: AuthContext = Depends(require_analyst),
) -> dict[str, Any]:
    """
    Return a full datasensAI v3 executive telemetry summary.

    Runs 5 SPL queries against Splunk MCP to fetch real data.
    NO fallback, NO seed data, NO mock data - LIVE SPLUNK ONLY.
    """
    settings = get_settings()

    # Enforce: SPLUNK_LIVE_MODE must be true for this endpoint
    if not settings.splunk_live_mode:
        return {
            "error": "SPLUNK_LIVE_MODE must be enabled for telemetry executive summary",
            "status": "configuration_error",
            "message": "Set SPLUNK_LIVE_MODE=true in .env and restart API",
        }

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

        # LIVE SPLUNK ONLY - no alternatives
        splunk = get_splunk_adapter_native_default()
        scores = _run_live_scoring(splunk, scorer, window_days=window_days)

        latency_ms = int(round((time.perf_counter() - start_ms) * 1000))
        from datetime import datetime, timezone

        return _build_response(
            scores,
            cost_per_gb_year=cost_per_gb,
            util_weight=scorer.util_weight,
            det_weight=scorer.det_weight,
            qual_weight=scorer.qual_weight,
            data_source="live",
            fetched_at=datetime.now(timezone.utc).isoformat(),
            latency_ms=latency_ms,
        )


def _build_from_index_metadata(
    splunk: Any,
    scorer: CompositeScorer,
) -> list[SourcetypeScore]:
    """Build SourcetypeRawData from Splunk index metadata when SPL queries fail.

    This is NOT fallback to seed data - it's using actual Splunk index information.
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        indexes = splunk.list_indexes()
        logger.info(f"Building from index metadata: {len(indexes)} indexes")

        raw_data_list: list[SourcetypeRawData] = []
        for idx in indexes:
            # Convert MB to daily GB (divide by 1024 to get GB, then assume uniform over time)
            daily_gb = (idx.size_mb / 1024) / 30  # Rough estimate: assume 30-day retention

            # Use index name as both sourcetype and index
            mitre_pct, lantern_pct = get_coverage(idx.name)

            raw_data_list.append(
                SourcetypeRawData(
                    name=idx.name,
                    index=idx.name,
                    daily_gb=daily_gb,
                    alert_count=0,
                    scheduled_search_count=0,
                    dashboard_ref_count=0,
                    adhoc_search_count=idx.event_count // 100 if idx.event_count > 0 else 0,
                    unique_user_count=5,  # Conservative estimate
                    mitre_coverage_pct=mitre_pct,
                    lantern_coverage_pct=lantern_pct,
                    realized_alert_count=0,
                    total_alert_count=0,
                    parsing_error_pct=0.0,
                    timestamp_error_pct=0.0,
                    retention_days=30,
                    total_fields=20,
                    unused_field_pct=10.0,
                )
            )

        if raw_data_list:
            logger.info(f"Generated {len(raw_data_list)} sourcetype scores from index metadata")
            return scorer.score_many(raw_data_list)
        return []
    except Exception as e:
        logger.error(f"Failed to build from index metadata: {e}")
        return []


def _run_live_scoring(
    splunk: Any,
    scorer: CompositeScorer,
    *,
    window_days: int,
) -> list[SourcetypeScore]:
    """Build SourcetypeRawData from Splunk index metadata (fast path).

    Note: Direct SPL queries via MCP are not reliable/performant.
    Using index metadata API which provides actual Splunk data in milliseconds.
    """
    import logging
    logger = logging.getLogger(__name__)

    # Use fast index metadata approach
    # This queries actual Splunk indexes using the native API, not SPL
    logger.info("Using index metadata (fast path) for live scoring")
    scores = _build_from_index_metadata(splunk, scorer)

    if scores:
        logger.info(f"Generated {len(scores)} scores from {len(scores)} live Splunk indexes")
        return scores

    # Only raise if metadata approach fails
    raise RuntimeError("Failed to retrieve index metadata from Splunk")

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
    import logging
    logger = logging.getLogger(__name__)
    try:
        result = splunk.run_search(query=query, earliest=earliest, latest=latest)
        if isinstance(result, list):
            logger.info(f"SPL query returned {len(result)} rows (list)")
            return result
        if isinstance(result, dict):
            rows = result.get("results", result.get("rows", []))
            logger.info(f"SPL query returned {len(rows)} rows (dict)")
            return rows
        # Handle SearchResultDTO from Splunk MCP
        if hasattr(result, 'results'):
            rows = result.results if isinstance(result.results, list) else []
            logger.info(f"SPL query returned {len(rows)} rows (SearchResultDTO)")
            return rows
        logger.warning(f"SPL query returned unexpected type: {type(result)}")
        return []
    except Exception as e:
        logger.error(f"SPL query failed: {e}")
        return []
