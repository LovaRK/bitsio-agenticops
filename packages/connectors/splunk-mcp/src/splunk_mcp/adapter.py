from __future__ import annotations

import logging
from typing import Any

import httpx

from splunk_mcp.dtos import IndexDTO, SearchResultDTO, ServerInfoDTO, StandardizedErrorDTO
from splunk_mcp.retry import RETRYABLE_STATUS_CODES, with_retry

LOGGER = logging.getLogger(__name__)
REDACT_KEYS = {"token", "password", "query", "credential"}


class SplunkMCPAdapter:
    def __init__(
        self,
        base_url: str,
        token: str | None = None,
        role: str = "read_only",
        timeout: float = 10.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.role = role
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=timeout,
            transport=transport,
            headers={"Authorization": f"Bearer {token}"} if token else {},
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
        code = str(raw_error.get("code", "unknown"))
        message = str(raw_error.get("message", "Unknown error"))
        retryable = int(code) in RETRYABLE_STATUS_CODES if code.isdigit() else False
        return StandardizedErrorDTO(code=code, message=message, retryable=retryable)

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
