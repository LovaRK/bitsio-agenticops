# DECISION_LOG

- 2026-04-08: Locked Pro Core+UI scope (Phases 0-7).
- 2026-04-08: Local Docker is canonical dev environment.
- 2026-04-08: Mock-first Splunk integration for deterministic CI.
- 2026-04-08: Anthropic chosen as first live model adapter target.
- 2026-04-08: Strict phase-gate progression remains mandatory.
- 2026-04-08: Canonical docs owned by Codex for Antigravity parallel execution.
- 2026-04-13: Splunk connector boundary supports dual runtime modes: `native` (default for production compatibility) and `mcp` (custom app compatibility).
- 2026-04-13: Browser live flow is enforced with `NEXT_PUBLIC_REQUIRE_LIVE_API=true` to prevent silent mock fallback during production demos.
- 2026-04-13: API CORS middleware enabled for local web (`127.0.0.1:3000` and `localhost:3000`) to support approval preflight requests.
- 2026-04-15: Telemetry metrics route canonicalized to `GET /api/v1/waste/telemetry/metrics`; older `/api/v1/telemetry/metrics` treated as deprecated docs reference.
- 2026-04-16: Added implementation snapshot doc as canonical engineering state reference for onboarding and handoff.
- 2026-04-16: Explicitly documented that `/api/v1/waste/telemetry/metrics` is currently curated payload while `/api/v1/waste/analyze/live` is the live tenant analysis path.
- 2026-04-16: Added Incident Context Agent graph with 5-node decomposition (`ingest -> enrichment -> historical_correlation -> anomaly_detection -> context_response`).
- 2026-04-16: Introduced protocol-based service boundaries for ICA (`MetadataService`, `EmbeddingService`, `BaselineService`) with stub-first local defaults.
- 2026-04-16: Standardized ICA enrichment API boundary at `POST /api/v1/incidents/{incident_id}/enrich` with `force_refresh` cache control.
- 2026-04-16: Added mock MCP baseline endpoint `GET /api/v1/baselines/{service_name}` for deterministic local anomaly testing.
