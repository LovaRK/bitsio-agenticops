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
