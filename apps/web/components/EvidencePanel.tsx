export function EvidencePanel({
  evidenceRefs,
  missingEvidence,
  confidence
}: {
  evidenceRefs: string[];
  missingEvidence: string[];
  confidence: number;
}) {
  const confidenceColor = confidence > 0.8 ? "text-emerald-600" : confidence >= 0.5 ? "text-amber-600" : "text-rose-600";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Evidence & Actions</h2>
      <p className={`mt-2 text-sm font-medium ${confidenceColor}`}>Confidence: {(confidence * 100).toFixed(0)}%</p>

      <div className="mt-4">
        <h3 className="text-sm font-semibold">Evidence References</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {evidenceRefs.map((item) => (
            <li key={item} className="truncate">
              <a className="text-blue-600 underline" href={item}>
                {item}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-md bg-amber-50 p-3">
        <h3 className="text-sm font-semibold text-amber-700">Missing Evidence</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
          {missingEvidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
