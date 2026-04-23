/**
 * HTTP utilities for API communication.
 * Handles timeouts, error handling, and header management.
 */

import { API_BASE_URL, DEV_ANALYST_KEY, REQUIRE_LIVE_API, USE_MOCK_FALLBACK } from "@/lib/config";
import { emitAppAlert } from "@/lib/uiAlerts";

const UI_TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || "tenant_ui_local";

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Request timeout (${label})`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

type ApiFetchOptions = RequestInit & {
  suppressAlerts?: boolean;
};

function buildApiUrl(base: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBase = (base || "").trim().replace(/\/+$/, "");

  if (!normalizedBase) {
    return normalizedPath;
  }

  // Prevent duplicated API prefix when PUBLIC_API_BASE_URL="/api"
  // and callers pass path="/api/v1/...".
  if (normalizedBase.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    return `${normalizedBase}${normalizedPath.slice(4)}`;
  }

  return `${normalizedBase}${normalizedPath}`;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const url = buildApiUrl(API_BASE_URL, path);
  const { suppressAlerts = false, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers ?? {});

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Attach API key in all environments when no explicit auth is provided.
  // This keeps RBAC behavior consistent between dev and production-like demos.
  if (!headers.has("x-api-key") && !headers.has("Authorization") && DEV_ANALYST_KEY) {
    headers.set("x-api-key", DEV_ANALYST_KEY);
  }

  // Avoid sharing the global default tenant bucket (tenant_demo),
  // which can trigger 429s during local/demo traffic bursts.
  if (!headers.has("x-tenant-id")) {
    headers.set("x-tenant-id", UI_TENANT_ID);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...requestOptions,
      cache: requestOptions.cache ?? "no-store",
      headers,
    });
  } catch (error) {
    if (!suppressAlerts) {
      const message = `Network error while reaching API (${path}).`;
      emitAppAlert({ level: "error", message });
    }
    throw error;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (!suppressAlerts) {
      emitAppAlert({
        level: "error",
        message: `API ${res.status} for ${path}. Check runtime connection in Settings.`,
      });
    }
    throw new Error(`API ${res.status} on ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export function canFallback(): boolean {
  return !REQUIRE_LIVE_API && process.env.NODE_ENV !== "production";
}
