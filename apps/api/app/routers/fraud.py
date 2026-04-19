"""Fraud risk analysis endpoints."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from statistics import mean
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from apps.api.app.dependencies import get_splunk_adapter
from packages.shared.auth import AuthContext, require_analyst
from packages.shared.config.settings import get_settings
from splunk_mcp.adapter import SplunkAdapter

router = APIRouter(prefix="/api/v1/fraud", tags=["fraud-risk"])


class FraudCase(BaseModel):
    case_id: str
    incident_id: str
    vendor: str
    user: str
    amount_usd: float
    risk_score: int = Field(ge=0, le=100)
    status: str
    requires_approval: bool
    anomaly_types: list[str]
    event_count: int
    timestamp: str
    source_index: str


class FraudSummary(BaseModel):
    open_cases: int
    high_risk_cases: int
    approval_required_cases: int
    avg_risk_score: float
    total_amount_reviewed_usd: float
    potential_exposure_usd: float
    recommended_hold_amount_usd: float


class FraudPolicyEvaluation(BaseModel):
    policy_id: str
    policy_version: str
    rule_triggered: str
    approval_reason: str
    source: Literal["reported", "derived"]


class FraudDataQuality(BaseModel):
    completeness_score: float = Field(ge=0.0, le=1.0)
    freshness_seconds: int = Field(ge=0)
    accuracy_confidence: float = Field(ge=0.0, le=1.0)
    validation_passed: bool
    source: Literal["reported", "derived"]


class FraudCompliance(BaseModel):
    data_classification: Literal["internal", "confidential", "restricted"]
    compliance_frameworks: list[str]
    encryption_required: str
    source: Literal["reported", "derived"]


class FraudAgentTelemetry(BaseModel):
    agent_id: str
    agent_version: str
    agent_capabilities: str
    action_confidence: float = Field(ge=0.0, le=1.0)
    human_in_the_loop: bool
    source: Literal["reported", "derived"]


class FraudPricingContext(BaseModel):
    primary_buyer: str
    annual_subscription_arr_usd: str
    one_time_onboarding_usd: str
    optional_managed_tuning_usd_per_year: str


class FraudOverviewResponse(BaseModel):
    mode: Literal["live", "seed"]
    degraded_reason: str | None
    generated_at: str
    summary: FraudSummary
    active_cases: list[FraudCase]
    signal_breakdown: dict[str, int]
    policy_evaluation: FraudPolicyEvaluation
    data_quality: FraudDataQuality
    compliance: FraudCompliance
    agent_telemetry: FraudAgentTelemetry
    pricing_context: FraudPricingContext
    narrative: str


_SEED_CASES: list[FraudCase] = [
    FraudCase(
        case_id="fr_case_20260418_901",
        incident_id="inc_20260408_44",
        vendor="omega-procurement",
        user="finance.ops.17",
        amount_usd=84500.0,
        risk_score=93,
        status="pending_approval",
        requires_approval=True,
        anomaly_types=["payment_deviation", "new_vendor", "approval_override"],
        event_count=31,
        timestamp="2026-04-18T19:10:00+00:00",
        source_index="tutorial",
    ),
    FraudCase(
        case_id="fr_case_20260418_902",
        incident_id="inc_20260408_43",
        vendor="global-reimbursements",
        user="approver.temp.02",
        amount_usd=36200.0,
        risk_score=81,
        status="triaging",
        requires_approval=True,
        anomaly_types=["identity_mismatch", "geo_deviation"],
        event_count=17,
        timestamp="2026-04-18T19:18:00+00:00",
        source_index="tutorial",
    ),
    FraudCase(
        case_id="fr_case_20260418_903",
        incident_id="inc_20260408_42",
        vendor="legacy-maintenance",
        user="svc-payments-batch",
        amount_usd=11200.0,
        risk_score=58,
        status="open",
        requires_approval=False,
        anomaly_types=["retry_amplification"],
        event_count=12,
        timestamp="2026-04-18T19:25:00+00:00",
        source_index="tutorial",
    ),
]


def _extract_text(row: dict, *keys: str, default: str) -> str:
    for key in keys:
        value = row.get(key)
        if value is None:
            continue
        if isinstance(value, list):
            value = value[0] if value else None
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return default


def _extract_float(row: dict, *keys: str, default: float) -> float:
    for key in keys:
        value = row.get(key)
        if value is None:
            continue
        if isinstance(value, list):
            value = value[0] if value else None
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return default


def _extract_time(value: object) -> datetime:
    if isinstance(value, list):
        value = value[0] if value else None
    if value is None:
        return datetime.now(tz=UTC)

    text = str(value).strip()
    if not text:
        return datetime.now(tz=UTC)

    try:
        if text.replace(".", "", 1).isdigit():
            return datetime.fromtimestamp(float(text), tz=UTC)
        return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return datetime.now(tz=UTC)


def _derive_anomaly_types(row: dict[str, object]) -> list[str]:
    blob = " ".join(str(value) for value in row.values()).lower()
    anomalies: list[str] = []

    if any(token in blob for token in ["payment", "amount", "invoice"]):
        anomalies.append("payment_deviation")
    if any(token in blob for token in ["vendor", "new_vendor", "supplier"]):
        anomalies.append("vendor_risk")
    if any(token in blob for token in ["auth", "identity", "login", "disabled"]):
        anomalies.append("identity_mismatch")
    if any(token in blob for token in ["approval", "override", "manual"]):
        anomalies.append("approval_override")
    if any(token in blob for token in ["retry", "timeout", "error"]):
        anomalies.append("retry_amplification")

    if not anomalies:
        anomalies.append("anomaly_pattern")

    return anomalies


def _case_from_row(row: dict[str, object], index: int) -> FraudCase:
    case_id = _extract_text(row, "case_id", "incident_id", "correlation_id", "_cd", default=f"fr_case_live_{index}")
    incident_id = _extract_text(row, "incident_id", "id", default=f"inc_live_{index}")
    vendor = _extract_text(row, "vendor", "merchant", "dest", "host", default="unknown-vendor")
    user = _extract_text(row, "user", "src_user", "actor", "clientip", default="unknown-user")
    amount = _extract_float(row, "amount", "payment_amount", "total", default=5000.0 + (index * 750))
    event_count = int(_extract_float(row, "event_count", "count", default=1.0))

    anomalies = _derive_anomaly_types(row)
    base = 35 + (len(anomalies) * 11)
    amount_boost = min(30, int(amount / 5000))
    frequency_boost = min(20, event_count * 2)
    risk_score = min(99, base + amount_boost + frequency_boost)

    requires_approval = risk_score >= 75
    status = "pending_approval" if requires_approval else "triaging"

    timestamp = _extract_time(row.get("_time") or row.get("time") or row.get("timestamp"))

    return FraudCase(
        case_id=case_id,
        incident_id=incident_id,
        vendor=vendor,
        user=user,
        amount_usd=round(amount, 2),
        risk_score=risk_score,
        status=status,
        requires_approval=requires_approval,
        anomaly_types=anomalies,
        event_count=event_count,
        timestamp=timestamp.isoformat(),
        source_index=_extract_text(row, "index", "source", default="tutorial"),
    )


def _summarize(cases: list[FraudCase]) -> FraudSummary:
    open_cases = sum(1 for case in cases if case.status in {"open", "triaging", "pending_approval"})
    high_risk_cases = sum(1 for case in cases if case.risk_score >= 80)
    approval_required = sum(1 for case in cases if case.requires_approval)

    total_amount = sum(case.amount_usd for case in cases)
    potential_exposure = sum(case.amount_usd * (case.risk_score / 100.0) for case in cases)
    hold_amount = sum(case.amount_usd for case in cases if case.requires_approval)

    return FraudSummary(
        open_cases=open_cases,
        high_risk_cases=high_risk_cases,
        approval_required_cases=approval_required,
        avg_risk_score=round(mean(case.risk_score for case in cases), 2) if cases else 0.0,
        total_amount_reviewed_usd=round(total_amount, 2),
        potential_exposure_usd=round(potential_exposure, 2),
        recommended_hold_amount_usd=round(hold_amount, 2),
    )


def _data_quality(cases: list[FraudCase]) -> FraudDataQuality:
    if not cases:
        return FraudDataQuality(
            completeness_score=0.0,
            freshness_seconds=0,
            accuracy_confidence=0.0,
            validation_passed=False,
            source="derived",
        )

    required_fields = ["vendor", "user", "amount_usd", "risk_score", "status", "timestamp"]
    total_checks = len(cases) * len(required_fields)
    populated = 0

    for case in cases:
        for field in required_fields:
            value = getattr(case, field)
            if value not in ("", None, 0):
                populated += 1

    newest = max(_extract_time(case.timestamp) for case in cases)
    freshness_seconds = max(0, int((datetime.now(tz=UTC) - newest).total_seconds()))

    completeness = round(populated / total_checks, 4) if total_checks else 0.0
    confidence = max(0.5, min(0.98, round((completeness * 0.7) + 0.25, 4)))

    return FraudDataQuality(
        completeness_score=completeness,
        freshness_seconds=freshness_seconds,
        accuracy_confidence=confidence,
        validation_passed=all(0 <= case.risk_score <= 100 for case in cases),
        source="derived",
    )


def _policy_evaluation(cases: list[FraudCase]) -> FraudPolicyEvaluation:
    requires_approval = any(case.requires_approval for case in cases)
    return FraudPolicyEvaluation(
        policy_id="fraud-risk-approval-policy",
        policy_version="v1.0.0",
        rule_triggered="require_approval" if requires_approval else "allow_monitoring_only",
        approval_reason=(
            "Payment or identity anomalies exceeded risk threshold. Human approval required before action."
            if requires_approval
            else "No action crossed approval threshold; monitoring continues."
        ),
        source="derived",
    )


def _compliance(cases: list[FraudCase]) -> FraudCompliance:
    high_risk = any(case.risk_score >= 80 for case in cases)
    return FraudCompliance(
        data_classification="restricted" if high_risk else "confidential",
        compliance_frameworks=["PCI-DSS", "SOX"],
        encryption_required="in-transit + at-rest",
        source="derived",
    )


def _agent_telemetry(cases: list[FraudCase]) -> FraudAgentTelemetry:
    confidence = round(min(0.99, max(0.5, (mean(case.risk_score for case in cases) / 100.0))), 2) if cases else 0.5
    return FraudAgentTelemetry(
        agent_id="fraud-risk-agent",
        agent_version="v1.0.0",
        agent_capabilities="propose-only",
        action_confidence=confidence,
        human_in_the_loop=True,
        source="derived",
    )


def _pricing_context() -> FraudPricingContext:
    return FraudPricingContext(
        primary_buyer="CFO / Controller / Internal Audit",
        annual_subscription_arr_usd="$120K-$168K",
        one_time_onboarding_usd="$25K-$40K",
        optional_managed_tuning_usd_per_year="$30K-$48K",
    )


def _signal_breakdown(cases: list[FraudCase]) -> dict[str, int]:
    counter: Counter[str] = Counter()
    for case in cases:
        counter.update(case.anomaly_types)
    return dict(counter)


def _narrative(cases: list[FraudCase], mode: str) -> str:
    if not cases:
        return "No high-risk fraud patterns detected in the current observation window."

    top = sorted(cases, key=lambda item: item.risk_score, reverse=True)[0]
    return (
        f"{mode.upper()} analysis correlated payment, identity, and approval telemetry. "
        f"Top case {top.case_id} ({top.vendor}) scored {top.risk_score}/100 and "
        "requires human approval before any containment action."
    )


def _query_live_cases(adapter: SplunkAdapter, limit: int = 25) -> list[FraudCase]:
    query = (
        "search index=tutorial (payment OR invoice OR vendor OR approval OR auth OR login OR fraud OR anomaly) "
        '| rex field=_raw "incident_id=(?<incident_id>[^\\s,]+)" '
        '| rex field=_raw "vendor=(?<vendor>[^\\s,]+)" '
        '| rex field=_raw "user=(?<user>[^\\s,]+)" '
        '| rex field=_raw "amount=(?<amount>[0-9.]+)" '
        "| eval vendor=coalesce(vendor, host, source, sourcetype, \"unknown-vendor\") "
        "| eval user=coalesce(user, src_user, user_name, clientip, \"unknown-user\") "
        "| eval amount=coalesce(amount, bytes, kb, 5000) "
        "| stats count as event_count latest(_time) as _time values(index) as index values(vendor) as vendor values(user) as user values(amount) as amount by incident_id "
        "| sort - event_count "
        f"| head {int(limit)}"
    )

    result = adapter.run_search(query=query, earliest="-7d", latest="now")
    cases = [_case_from_row(row, index + 1) for index, row in enumerate(result.results)]

    deduped: dict[str, FraudCase] = {}
    for case in cases:
        deduped[case.case_id] = case
    return list(deduped.values())


def _build_overview(cases: list[FraudCase], mode: Literal["live", "seed"], degraded_reason: str | None) -> FraudOverviewResponse:
    return FraudOverviewResponse(
        mode=mode,
        degraded_reason=degraded_reason,
        generated_at=datetime.now(tz=UTC).isoformat(),
        summary=_summarize(cases),
        active_cases=sorted(cases, key=lambda item: item.risk_score, reverse=True),
        signal_breakdown=_signal_breakdown(cases),
        policy_evaluation=_policy_evaluation(cases),
        data_quality=_data_quality(cases),
        compliance=_compliance(cases),
        agent_telemetry=_agent_telemetry(cases),
        pricing_context=_pricing_context(),
        narrative=_narrative(cases, mode),
    )


@router.get("/demo", response_model=FraudOverviewResponse, summary="Fraud risk demo response")
def fraud_demo(_ctx: AuthContext = Depends(require_analyst)) -> FraudOverviewResponse:
    return _build_overview(list(_SEED_CASES), mode="seed", degraded_reason=None)


@router.get("/overview", response_model=FraudOverviewResponse, summary="Fraud risk overview")
def fraud_overview(
    mode: Literal["auto", "seed", "live"] = Query(default="auto"),
    _ctx: AuthContext = Depends(require_analyst),
    adapter: SplunkAdapter = Depends(get_splunk_adapter),
) -> FraudOverviewResponse:
    settings = get_settings()

    if mode == "seed" or (mode == "auto" and not settings.splunk_live_mode):
        return _build_overview(list(_SEED_CASES), mode="seed", degraded_reason=None)

    try:
        cases = _query_live_cases(adapter)
    except Exception as exc:  # noqa: BLE001
        if mode == "live":
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Fraud live analysis failed: {exc}",
            ) from exc
        return _build_overview(
            list(_SEED_CASES),
            mode="seed",
            degraded_reason=f"Live Splunk query failed. Using seeded fraud cases. ({exc})",
        )

    if not cases:
        if mode == "live":
            return _build_overview([], mode="live", degraded_reason="No matching live fraud telemetry found in current search window.")
        return _build_overview(
            list(_SEED_CASES),
            mode="seed",
            degraded_reason="Live Splunk query returned no fraud patterns. Using seeded fraud cases for continuity.",
        )

    return _build_overview(cases, mode="live", degraded_reason=None)


@router.post("/analyze/live", response_model=FraudOverviewResponse, summary="Force live fraud analysis")
def fraud_analyze_live(
    _ctx: AuthContext = Depends(require_analyst),
    adapter: SplunkAdapter = Depends(get_splunk_adapter),
) -> FraudOverviewResponse:
    settings = get_settings()
    if not settings.splunk_live_mode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Live Splunk mode is disabled. Turn on SPLUNK_LIVE_MODE to run live fraud analysis.",
        )

    cases = _query_live_cases(adapter)
    return _build_overview(cases, mode="live", degraded_reason=None)
