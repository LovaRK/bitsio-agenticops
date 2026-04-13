from __future__ import annotations

import json
import logging
from typing import Any, Protocol

import httpx

from splunk_mcp.dtos import IndexDTO, SearchResultDTO, ServerInfoDTO, StandardizedErrorDTO
from splunk_mcp.retry import RETRYABLE_STATUS_CODES, with_retry

LOGGER = logging.getLogger(__name__)
REDACT_KEYS = {"token", "password", "query", "credential"}


def _standardize_error(raw_error: dict[str, Any]) -> StandardizedErrorDTO:
    """Convert raw error dict to StandardizedErrorDTO."""
    code = str(raw_error.get("code", "unknown"))
    message = str(raw_error.get("message", "Unknown error"))
    retryable = int(code) in RETRYABLE_STATUS_CODES if code.isdigit() else False
    return StandardizedErrorDTO(code=code, message=message, retryable=retryable)


class SplunkAdapter(Protocol):
    def list_indexes(self) -> list[IndexDTO]: ...
    def run_search(self, query: str, earliest: str, latest: str) -> SearchResultDTO: ...
    def get_server_info(self) -> ServerInfoDTO: ...
    def explain_error(self, raw_error: dict[str, Any]) -> StandardizedErrorDTO: ...


class SplunkMCPAdapter:
    def __init__(
        self,
        base_url: str,
        token: str | None = None,
        role: str = "read_only",
        timeout: float = 10.0,
        transport: httpx.BaseTransport | None = None,
        verify_ssl: bool = True,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.role = role
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=timeout,
            transport=transport,
            headers={"Authorization": f"Bearer {token}"} if token else {},
            verify=verify_ssl,
        )

    def list_indexes(self) -> list[IndexDTO]:
        payload = self._request("GET", "/list_indexes")
        return [IndexDTO.model_validate(item) for item in payload.get("indexes", [])]

    def run_search(self, query: str, earliest: str, latest: str) -> SearchResultDTO:
        payload = self._request(
            "POST",
            "/run_search",
            json={"query": query, "earliest": earliest, "latest": latest},
        )
        return SearchResultDTO.model_validate(payload)

    def get_server_info(self) -> ServerInfoDTO:
        payload = self._request("GET", "/server_info")
        return ServerInfoDTO.model_validate(payload)

    def explain_error(self, raw_error: dict[str, Any]) -> StandardizedErrorDTO:
        return _standardize_error(raw_error)

    def _request(
        self, method: str, path: str, json: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        safe_json = self._redact_payload(json or {})
        LOGGER.info("splunk_mcp_request method=%s path=%s payload=%s", method, path, safe_json)

        def _run() -> dict[str, Any]:
            response = self._client.request(method=method, url=path, json=json)
            response.raise_for_status()
            return response.json()

        try:
            return with_retry(_run)
        except httpx.HTTPStatusError as exc:
            error = self.explain_error(
                {
                    "code": str(exc.response.status_code),
                    "message": str(exc.response.text),
                }
            )
            LOGGER.error("splunk_mcp_error code=%s message=%s", error.code, error.message)
            raise

    @staticmethod
    def _redact_payload(payload: dict[str, Any]) -> dict[str, Any]:
        redacted: dict[str, Any] = {}
        for key, value in payload.items():
            if key.lower() in REDACT_KEYS:
                redacted[key] = "[REDACTED]"
            else:
                redacted[key] = value
        return redacted


class NativeSplunkAdapter:
    """
    Adapter for native Splunk REST endpoints.

    Endpoints:
      - GET  /services/data/indexes
      - POST /services/search/jobs/export
      - GET  /services/server/info
    """

    def __init__(
        self,
        base_url: str,
        token: str | None = None,
        role: str = "read_only",
        timeout: float = 20.0,
        transport: httpx.BaseTransport | None = None,
        verify_ssl: bool = True,
        auth_scheme: str = "Bearer",
    ) -> None:
        self.base_url = _normalize_native_base_url(base_url)
        self.role = role
        headers = {}
        if token:
            scheme = auth_scheme.strip() or "Bearer"
            headers["Authorization"] = f"{scheme} {token}"
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=timeout,
            transport=transport,
            headers=headers,
            verify=verify_ssl,
        )

    def list_indexes(self) -> list[IndexDTO]:
        payload = self._request_json(
            "GET", "/services/data/indexes", params={"output_mode": "json"}
        )
        entries = payload.get("entry", [])
        indexes: list[IndexDTO] = []
        for entry in entries:
            content = entry.get("content", {})
            size_mb = _as_float(
                content.get("totalSizeMB")
                or content.get("currentDBSizeMB")
                or content.get("frozenTimePeriodInSecs"),
                default=0.0,
            )
            event_count = _as_int(
                content.get("totalEventCount")
                or content.get("eventCount")
                or content.get("event_count"),
                default=0,
            )
            indexes.append(
                IndexDTO(
                    name=str(entry.get("name", "unknown")),
                    size_mb=size_mb,
                    event_count=event_count,
                )
            )
        return indexes

    def run_search(self, query: str, earliest: str, latest: str) -> SearchResultDTO:
        spl = query.strip()
        if not (spl.startswith("search ") or spl.startswith("|")):
            spl = f"search {spl}"

        params = {"output_mode": "json"}
        form = {"search": spl, "earliest_time": earliest, "latest_time": latest}

        def _run() -> httpx.Response:
            response = self._client.post("/services/search/jobs/export", params=params, data=form)
            response.raise_for_status()
            return response

        try:
            response = with_retry(_run)
        except httpx.HTTPStatusError as exc:
            error = self.explain_error(
                {
                    "code": str(exc.response.status_code),
                    "message": str(exc.response.text),
                }
            )
            LOGGER.error("splunk_native_error code=%s message=%s", error.code, error.message)
            raise

        results: list[dict[str, Any]] = []
        messages: list[str] = []

        for line in response.text.splitlines():
            text = line.strip()
            if not text:
                continue
            try:
                item = json.loads(text)
            except json.JSONDecodeError:
                continue

            if "result" in item and isinstance(item["result"], dict):
                results.append(item["result"])

            if "messages" in item and isinstance(item["messages"], list):
                for msg in item["messages"]:
                    message_text = msg.get("text") if isinstance(msg, dict) else str(msg)
                    if message_text:
                        messages.append(str(message_text))

        if not results:
            try:
                payload = response.json()
                if isinstance(payload, dict):
                    if "result" in payload and isinstance(payload["result"], dict):
                        results.append(payload["result"])
                    if "results" in payload and isinstance(payload["results"], list):
                        results.extend([r for r in payload["results"] if isinstance(r, dict)])
            except Exception:  # noqa: BLE001
                pass

        return SearchResultDTO(results=results, messages=messages, done=True)

    def get_server_info(self) -> ServerInfoDTO:
        payload = self._request_json("GET", "/services/server/info", params={"output_mode": "json"})
        entries = payload.get("entry", [])
        first = entries[0].get("content", {}) if entries else {}
        return ServerInfoDTO(
            version=str(first.get("version", "unknown")),
            build=str(first.get("build", "unknown")),
            mode=str(first.get("server_roles", "enterprise")),
        )

    def explain_error(self, raw_error: dict[str, Any]) -> StandardizedErrorDTO:
        return _standardize_error(raw_error)

    def _request_json(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        def _run() -> dict[str, Any]:
            response = self._client.request(method=method, url=path, params=params)
            response.raise_for_status()
            return response.json()

        try:
            return with_retry(_run)
        except httpx.HTTPStatusError as exc:
            error = self.explain_error(
                {
                    "code": str(exc.response.status_code),
                    "message": str(exc.response.text),
                }
            )
            LOGGER.error("splunk_native_error code=%s message=%s", error.code, error.message)
            raise


def _normalize_native_base_url(base_url: str) -> str:
    value = base_url.rstrip("/")
    for suffix in ("/services/mcp", "/mcp"):
        if value.endswith(suffix):
            return value[: -len(suffix)]
    return value


def _as_int(value: Any, *, default: int) -> int:
    try:
        if isinstance(value, list):
            value = value[0] if value else default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _as_float(value: Any, *, default: float) -> float:
    try:
        if isinstance(value, list):
            value = value[0] if value else default
        return float(value)
    except (TypeError, ValueError):
        return default
