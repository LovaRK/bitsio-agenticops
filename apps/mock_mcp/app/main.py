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


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/error/{code}")
def error(code: int) -> dict:
    raise HTTPException(status_code=code, detail={"code": str(code), "message": "mock error"})
