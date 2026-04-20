/**
 * API configuration constants.
 * Single source of truth for API behavior flags and base URLs.
 */

export const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";
export const INTERNAL_API_BASE_URL = process.env.INTERNAL_API_BASE_URL ?? PUBLIC_API_BASE_URL;

// Determine which base URL to use based on execution context
export const API_BASE_URL = typeof window === "undefined" ? INTERNAL_API_BASE_URL : PUBLIC_API_BASE_URL;

// Feature flags
export const USE_MOCK_FALLBACK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
export const REQUIRE_LIVE_API = process.env.NEXT_PUBLIC_REQUIRE_LIVE_API === "true";
export const MAIN_TABS_ALLOW_FALLBACK =
  process.env.NEXT_PUBLIC_MAIN_TABS_ALLOW_FALLBACK === "true";
export const ACTION_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_ACTION_TIMEOUT_MS ?? "3000");

// Development keys (never exposed to browser in production)
export const DEV_ANALYST_KEY = process.env.DEV_ANALYST_KEY ?? "dev-analyst";
