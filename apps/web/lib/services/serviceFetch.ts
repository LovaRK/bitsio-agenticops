import { PAGE_FETCH_TIMEOUT_MS, USE_MOCK_FALLBACK } from "@/lib/config";
import { apiFetch, canFallback, withTimeout } from "@/lib/http";
import { emitAppAlert } from "@/lib/uiAlerts";

type FetchWithFallbackOptions<T> = {
  path: string;
  fallbackFactory: () => T;
  warningMessage: string;
  timeoutMs?: number;
  timeoutLabel?: string;
  init?: RequestInit;
  allowFallback?: boolean;
  suppressAlerts?: boolean;
};

export async function fetchWithFallback<T>(
  options: FetchWithFallbackOptions<T>,
): Promise<T> {
  const {
    path,
    fallbackFactory,
    warningMessage,
    timeoutMs,
    timeoutLabel,
    init,
    allowFallback = true,
    suppressAlerts = false,
  } = options;
  const effectiveTimeoutMs = timeoutMs ?? PAGE_FETCH_TIMEOUT_MS;
  const effectiveTimeoutLabel = timeoutLabel ?? `fetch:${path}`;

  if (USE_MOCK_FALLBACK) {
    emitAppAlert({
      level: "warning",
      message: `Using local mock mode for ${path}.`,
    });
    return fallbackFactory();
  }

  try {
    const request = apiFetch<T>(path, { ...init, suppressAlerts });
    if (effectiveTimeoutMs > 0) {
      return await withTimeout(request, effectiveTimeoutMs, effectiveTimeoutLabel);
    }
    return await request;
  } catch (err) {
    if (!allowFallback || !canFallback()) {
      throw err;
    }
    console.warn(warningMessage, err);
    if (!suppressAlerts) {
      emitAppAlert({
        level: "warning",
        message: `${warningMessage} Falling back to local data.`,
      });
    }
    return fallbackFactory();
  }
}
