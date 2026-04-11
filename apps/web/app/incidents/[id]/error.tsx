"use client";

export default function IncidentError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
        <h2 className="text-xl font-semibold text-rose-700">Unable to load incident details</h2>
        <button className="mt-4 rounded-md bg-rose-600 px-3 py-2 text-sm text-white" onClick={reset}>
          Retry
        </button>
      </div>
    </main>
  );
}
