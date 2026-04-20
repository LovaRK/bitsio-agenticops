"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body className="bg-background text-on-surface">
        <main className="min-h-screen flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-2xl rounded-xl border border-error/30 bg-error/5 p-6">
            <h1 className="text-2xl font-semibold text-error">App failed to render</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              A critical rendering error occurred. Retry to recover.
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
        </main>
      </body>
    </html>
  );
}
