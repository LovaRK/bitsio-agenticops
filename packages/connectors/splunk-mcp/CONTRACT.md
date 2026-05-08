# Splunk MCP Adapter Contract

## Stable Methods

`list_indexes() -> List[IndexDTO]`
- `IndexDTO`: `{ name: str, size_mb: float, event_count: int }`

`run_search(query, earliest, latest) -> SearchResultDTO`
- `SearchResultDTO`: `{ results: List[dict], messages: List[str], done: bool }`

`get_server_info() -> ServerInfoDTO`
- `ServerInfoDTO`: `{ version: str, build: str, mode: str }`

`explain_error(raw_error) -> StandardizedErrorDTO`
- `StandardizedErrorDTO`: `{ code: str, message: str, retryable: bool }`

## Retry Semantics

- Max retries: 3
- Initial wait: 1s, multiplier: 2, jitter: 0-0.5s
- Retry on: HTTP 429, 503, 504 only

## Redaction Rules

- Redact from all logs: token, password, query, credential
- Replace with: `[REDACTED]`

## Adapter Boundary Decision

The adapter is the only package allowed to handle raw MCP payloads. Upstream callers consume typed DTOs only.
