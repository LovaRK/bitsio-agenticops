"use client";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  return (
    <section className="pt-4 pb-10 px-4 sm:px-6 lg:px-8 sm:pt-6 lg:pb-12" data-testid="app-error-boundary">
      <div className="max-w-3xl rounded-xl border border-error/30 bg-error/5 p-6">
        <h2 className="text-xl font-semibold text-error">Something went wrong</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          The page hit an unexpected error. Try again.
        </p>
        <p className="mt-3 text-xs text-on-surface-variant/80 font-mono break-all">
          {error?.message || "Unknown error"}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md bg-error text-on-error px-3 py-2 text-sm font-semibold hover:bg-error/90 transition-colors"
        >
          Retry
        </button>
      </div>
    </section>
  );
}
