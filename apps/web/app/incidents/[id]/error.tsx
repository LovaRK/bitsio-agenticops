"use client";

export default function IncidentError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="rounded-xl border border-error/30 bg-error/5 p-6">
        <h2 className="text-xl font-semibold text-error">Unable to load incident details</h2>
        <button
          className="mt-4 rounded-md bg-error text-on-error px-3 py-2 text-sm font-semibold hover:bg-error/90 transition-colors"
          onClick={reset}
        >
          Retry
        </button>
      </div>
    </main>
  );
}
