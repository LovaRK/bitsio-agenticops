/**
 * API configuration constants.
 * Single source of truth for API behavior flags and base URLs.
 */

function resolvePublicApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!configured) return "";

  if (typeof window === "undefined") return configured;

  try {
    const parsed = new URL(configured);
    const browserHost = window.location.hostname;
    const configuredIsLocalhost =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const browserIsRemote =
      browserHost !== "localhost" && browserHost !== "127.0.0.1";

    if (configuredIsLocalhost && browserIsRemote) {
      const port = parsed.port || "8001";
      return `${window.location.protocol}//${browserHost}:${port}`;
    }
  } catch {
    // Keep configured value if it's a relative path or unparsable absolute URL.
  }

  return configured;
}

export const PUBLIC_API_BASE_URL = resolvePublicApiBaseUrl();
function resolveInternalApiBaseUrl(): string {
  const configuredInternal = process.env.INTERNAL_API_BASE_URL?.trim();
  if (configuredInternal) {
    return configuredInternal;
  }

  // If public base is absolute, server-side code can reuse it.
  if (/^https?:\/\//i.test(PUBLIC_API_BASE_URL)) {
    return PUBLIC_API_BASE_URL;
  }

  // Server-side fetch requires an absolute URL. Default to local API.
  const apiPort = process.env.API_PORT?.trim() || "8001";
  return `http://127.0.0.1:${apiPort}`;
}

export const INTERNAL_API_BASE_URL = resolveInternalApiBaseUrl();

// Determine which base URL to use based on execution context
export const API_BASE_URL = typeof window === "undefined" ? INTERNAL_API_BASE_URL : PUBLIC_API_BASE_URL;

// Feature flags
export const USE_MOCK_FALLBACK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
export const REQUIRE_LIVE_API = process.env.NEXT_PUBLIC_REQUIRE_LIVE_API === "true";
export const MAIN_TABS_ALLOW_FALLBACK =
  process.env.NEXT_PUBLIC_MAIN_TABS_ALLOW_FALLBACK === "true";
export const ACTION_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_ACTION_TIMEOUT_MS ?? "3000");
export const PAGE_FETCH_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_PAGE_FETCH_TIMEOUT_MS ?? "15000");
export const TELEMETRY_METRICS_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_TELEMETRY_METRICS_TIMEOUT_MS ?? "35000",
);

// Development keys (never exposed to browser in production)
const configuredDevAnalystKey =
  process.env.DEV_ANALYST_KEY?.trim() ||
  process.env.NEXT_PUBLIC_DEV_ANALYST_KEY?.trim() ||
  "dev-analyst";

// Guard against accidental downgrade to viewer key in dev/demo.
export const DEV_ANALYST_KEY =
  configuredDevAnalystKey === "dev-viewer" ? "dev-analyst" : configuredDevAnalystKey;
