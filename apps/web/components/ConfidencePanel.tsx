export function ConfidencePanel({
  confidence,
  impactedService,
  responders
}: {
  confidence: number;
  impactedService?: string;
  responders?: Array<{ id: string; name: string; isAI?: boolean }>;
}) {
  const confidencePercent = Math.round(confidence * 100);

  return (
    <aside className="col-span-12 lg:col-span-4 sticky top-24" data-testid="confidence-panel">
      <div className="glass-panel p-6 rounded-2xl border border-outline-variant/15 flex flex-col gap-8">
        {/* Confidence Meter */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-6 flex items-center justify-between">
            Confidence Score
            <span className="text-secondary font-headline text-lg">{confidencePercent}%</span>
          </h4>
          <div className="relative h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden mb-2">
            <div
              className="absolute left-0 top-0 h-full bg-secondary rounded-full transition-all duration-500"
              style={{ width: `${confidencePercent}%` }}
            ></div>
            <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          </div>
          <p className="text-[11px] text-on-surface-variant leading-tight">
            System is highly confident based on 4 historic matches and log patterns in Splunk.
          </p>
        </div>

        {/* Contextual Data */}
        <div className="space-y-4">
          {impactedService && (
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
              <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider block mb-1">
                Impacted Service
              </span>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-tertiary">cloud</span>
                <span className="text-sm font-bold font-headline">{impactedService}</span>
              </div>
            </div>
          )}

          {responders && responders.length > 0 && (
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/10">
              <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider block mb-1">
                Active Responders
              </span>
              <div className="flex -space-x-2">
                {responders.map((responder) =>
                  responder.isAI ? (
                    <div
                      key={responder.id}
                      className="w-6 h-6 rounded-full border-2 border-surface bg-primary-container ring-1 ring-outline-variant/30 flex items-center justify-center text-[8px] font-bold"
                    >
                      AI
                    </div>
                  ) : (
                    <div
                      key={responder.id}
                      className="w-6 h-6 rounded-full border-2 border-surface bg-surface-container ring-1 ring-outline-variant/30 overflow-hidden"
                      title={responder.name}
                    >
                      <div className="w-full h-full bg-surface-container-high"></div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Area */}
        <div className="pt-4 border-t border-outline-variant/10">
          <button className="w-full bg-primary py-4 rounded-xl text-on-primary font-black font-headline tracking-wide glow-primary hover:scale-[1.02] transition-transform active:scale-95 mb-3 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined font-bold">verified</span>
            Review &amp; Approve
          </button>
          <button className="w-full bg-surface-container-high py-3 rounded-xl text-on-surface text-sm font-bold border border-outline-variant/20 hover:bg-surface-bright transition-colors">
            Escalate to Human
          </button>
        </div>
      </div>

      {/* Secondary Context Map */}
      <div className="mt-6 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
        <h5 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-4">
          Blast Radius Map
        </h5>
        <div className="aspect-video bg-surface-container-lowest rounded-lg relative overflow-hidden flex items-center justify-center group">
          <div className="absolute inset-0 opacity-40 bg-gradient-to-br from-primary/20 to-tertiary/20"></div>
          <div className="relative z-10 flex flex-col items-center">
            <span className="material-symbols-outlined text-error text-3xl animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>
              error
            </span>
            <span className="text-[10px] font-mono mt-2 text-on-surface-variant">US-EAST-1_CLUSTER_A</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
