/**
 * useSubmit hook for async form submission handling.
 * Manages loading, error, and success states during async operations.
 */

import { useState, useCallback } from "react";

export interface SubmitState {
  isSubmitting: boolean;
  error: string | null;
  success: string | null;
}

export function useSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = useCallback(
    async <T,>(fn: () => Promise<T>, onSuccess?: (result: T) => void) => {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);

      try {
        const result = await fn();
        setSuccess("Operation completed successfully.");
        onSuccess?.(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Operation failed. Please try again.";
        setError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setError(null);
    setSuccess(null);
  }, []);

  return {
    isSubmitting,
    error,
    success,
    submit,
    reset,
    setError,
    setSuccess,
  };
}
