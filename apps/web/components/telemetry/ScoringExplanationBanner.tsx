const TIER_BADGES = [
  { label: "Critical", color: "#4caf50", desc: "Score ≥ 75" },
  { label: "Important", color: "#2196f3", desc: "Score 50–74" },
  { label: "Nice-to-Have", color: "#ff9800", desc: "Score 25–49" },
  { label: "Wasteful", color: "#f44336", desc: "Score < 25" },
];

export function ScoringExplanationBanner() {
  return (
    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-5 mb-6">
      <p className="text-sm font-bold text-on-surface mb-2">
        datasensAI v3 Composite Scoring Methodology
      </p>
      <p className="text-xs text-on-surface-variant mb-4 leading-relaxed max-w-4xl">
        Each Splunk sourcetype is scored across three dimensions:{" "}
        <span className="text-on-surface font-semibold">Utilization (35%)</span> — weighted count
        of knowledge-object references (alerts × 3, scheduled searches × 3, dashboards × 2,
        ad-hoc searches × 1, unique users × 2);{" "}
        <span className="text-on-surface font-semibold">Detection (40%)</span> — MITRE ATT&amp;CK
        coverage (50%) + Lantern coverage (30%) + realized alert ratio (20%);{" "}
        <span className="text-on-surface font-semibold">Quality (25%)</span> — inverse of
        parse/timestamp error rates. The composite score (0–100) maps to one of four tiers:
      </p>
      <div className="flex flex-wrap gap-3">
        {TIER_BADGES.map((t) => (
          <span
            key={t.label}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{ borderColor: t.color, color: t.color, background: `${t.color}18` }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: t.color }}
            />
            {t.label}
            <span className="font-normal text-on-surface-variant">({t.desc})</span>
          </span>
        ))}
      </div>
    </div>
  );
}
