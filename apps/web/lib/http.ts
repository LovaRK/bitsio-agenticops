/**
 * HTTP utilities for API communication.
 * Handles timeouts, error handling, and header management.
 */

import { API_BASE_URL, DEV_ANALYST_KEY, REQUIRE_LIVE_API, USE_MOCK_FALLBACK } from "@/lib/config";

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

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (process.env.NODE_ENV !== "production" && !headers.has("x-api-key")) {
    headers.set("x-api-key", DEV_ANALYST_KEY);
  }

  const res = await fetch(url, {
    ...options,
    cache: options.cache ?? "no-store",
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export function canFallback(): boolean {
  return !REQUIRE_LIVE_API && process.env.NODE_ENV !== "production";
}
