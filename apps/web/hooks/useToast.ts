/**
 * useToast hook for user-facing notifications.
 * Provides a simple API for showing success, error, and info messages.
 */

import { useState, useCallback } from "react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, durationMs = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, type, message };

    setToasts((prev) => [...prev, toast]);

    if (durationMs > 0) {
      setTimeout(() => {
        removeToast(id);
      }, durationMs);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message: string, durationMs?: number) => addToast("success", message, durationMs),
    [addToast],
  );

  const error = useCallback(
    (message: string, durationMs?: number) => addToast("error", message, durationMs),
    [addToast],
  );

  const info = useCallback(
    (message: string, durationMs?: number) => addToast("info", message, durationMs),
    [addToast],
  );

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
  };
}
