from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="BitsIO Mock MCP", version="0.1.0")
_FIXTURES = Path(__file__).parent / "fixtures"


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    earliest: str
    latest: str


def _load_fixture(name: str) -> dict:
    file_path = _FIXTURES / f"{name}.json"
    return json.loads(file_path.read_text(encoding="utf-8"))


@app.get("/list_indexes")
def list_indexes() -> dict:
    return _load_fixture("list_indexes")


@app.post("/run_search")
def run_search(payload: SearchRequest) -> dict:
    fixture = _load_fixture("run_search")
    fixture["query_meta"] = {
        "earliest": payload.earliest,
        "latest": payload.latest,
        "query_hash": str(abs(hash(payload.query))),
    }
    return fixture


@app.get("/server_info")
def server_info() -> dict:
    return _load_fixture("server_info")


@app.get("/api/v1/baselines/{service_name}")
def baseline_metrics(service_name: str, lookback_days: int = 30) -> dict:
    base = {
        "api-gateway": {
            "latency_p50": 95.0,
            "latency_p95": 180.0,
            "error_rate": 0.012,
            "throughput": 2150.0,
        },
        "payment-service": {
            "latency_p50": 130.0,
            "latency_p95": 260.0,
            "error_rate": 0.021,
            "throughput": 1450.0,
        },
        "order-service": {
            "latency_p50": 110.0,
            "latency_p95": 230.0,
            "error_rate": 0.015,
            "throughput": 1800.0,
        },
        "auth-service": {
            "latency_p50": 70.0,
            "latency_p95": 140.0,
            "error_rate": 0.009,
            "throughput": 2500.0,
        },
    }.get(service_name)
    if not base:
        raise HTTPException(status_code=404, detail="baseline not found")

    lookback = max(1, lookback_days)
    scale = 1.0 + min(0.35, lookback / 3650)
    return {
        **base,
        "stddev": {
            "latency_p95": round(base["latency_p95"] * (0.08 * scale), 3),
            "error_rate": round(base["error_rate"] * (0.1 * scale), 6),
        },
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/error/{code}")
def error(code: int) -> dict:
    raise HTTPException(status_code=code, detail={"code": str(code), "message": "mock error"})
