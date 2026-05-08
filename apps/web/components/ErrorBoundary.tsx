"use client";

import { useEffect, useState } from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      setError(event.error);
      setHasError(true);
      event.preventDefault();
    };

    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, []);

  if (hasError && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="max-w-md rounded-lg border border-error/30 bg-error-container/20 p-6">
          <h1 className="text-lg font-bold text-error">Something went wrong</h1>
          <p className="mt-2 text-sm text-on-surface-variant">{error.message}</p>
          <button
            onClick={() => {
              setHasError(false);
              setError(null);
            }}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
