from __future__ import annotations

from typing import Any, Protocol

from splunk_mcp.adapter import SplunkAdapter


class BaselineService(Protocol):
    def get_baseline(self, service_name: str, lookback_days: int = 30) -> dict[str, Any] | None: ...


class StubBaselineService:
    def __init__(self, baselines: dict[str, dict[str, Any]] | None = None) -> None:
        default_baselines = {
            "payments-api": {
                "latency_p50": 120.0,
                "latency_p95": 240.0,
                "error_rate": 0.02,
                "throughput": 1200.0,
                "stddev": {"latency_p95": 30.0, "error_rate": 0.01},
            },
            "auth-api": {
                "latency_p50": 90.0,
                "latency_p95": 180.0,
                "error_rate": 0.01,
                "throughput": 2000.0,
                "stddev": {"latency_p95": 20.0, "error_rate": 0.005},
            },
        }
        self.baselines = default_baselines if baselines is None else baselines

    def get_baseline(self, service_name: str, lookback_days: int = 30) -> dict[str, Any] | None:
        _ = lookback_days
        return self.baselines.get(service_name)


class SplunkBaselineService:
    """Scaffold for baseline retrieval from Splunk."""

    def __init__(self, splunk_adapter: SplunkAdapter) -> None:
        self.splunk_adapter = splunk_adapter

    def get_baseline(self, service_name: str, lookback_days: int = 30) -> dict[str, Any] | None:
        query = (
            f"search index=tutorial service={service_name} "
            "| stats avg(latency_p95) as latency_p95 avg(error_rate) as error_rate "
            "avg(latency_p50) as latency_p50 avg(throughput) as throughput"
        )
        result = self.splunk_adapter.run_search(
            query=query,
            earliest=f"-{int(lookback_days)}d",
            latest="now",
        )
        if not result.results:
            return None

        row = result.results[0]
        latency_p95 = float(row.get("latency_p95", 0.0) or 0.0)
        error_rate = float(row.get("error_rate", 0.0) or 0.0)
        return {
            "latency_p50": float(row.get("latency_p50", 0.0) or 0.0),
            "latency_p95": latency_p95,
            "error_rate": error_rate,
            "throughput": float(row.get("throughput", 0.0) or 0.0),
            "stddev": {
                "latency_p95": max(latency_p95 * 0.1, 1.0),
                "error_rate": max(error_rate * 0.1, 0.001),
            },
        }
