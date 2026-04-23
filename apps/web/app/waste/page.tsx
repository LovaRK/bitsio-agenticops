import { getTelemetryMetrics } from "@/lib/services/waste";
import { SourceUtilizationCard } from "@/components/SourceUtilizationCard";
import { SourceValueMatrix } from "@/components/SourceValueMatrix";
import { ROIBreakdown } from "@/components/ROIBreakdown";
import { SecurityGapsList } from "@/components/SecurityGapsList";
import { StorageSavingsTimeline } from "@/components/StorageSavingsTimeline";
import { MotionCard } from "@/components/ui/MotionCard";
import { TOOLTIP } from "@/lib/uiTooltips";

function formatCompactUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatRangeWeeks(annualSavingsUsd: number): string {
  if (annualSavingsUsd >= 200_000) return "4-6 weeks";
  if (annualSavingsUsd >= 75_000) return "2-4 weeks";
  return "1-2 weeks";
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default async function WastePage() {
  let metrics: Awaited<ReturnType<typeof getTelemetryMetrics>>;
  try {
    metrics = await getTelemetryMetrics();
  } catch {
    return (
      <section className="pt-4 pb-10 px-4 sm:px-6 lg:px-8 sm:pt-6 lg:pb-12" data-testid="waste-page">
        <div className="rounded-xl border border-error/25 bg-error/10 p-6">
          <h2 className="text-xl font-semibold text-on-surface">Telemetry metrics unavailable</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            This page is configured for live API metrics. Connect Splunk/API in Settings and retry.
          </p>
        </div>
      </section>
    );
  }

  const recommendedActions = metrics.sources
    .filter((source) => source.potential_savings_usd > 0)
    .sort((a, b) => b.potential_savings_usd - a.potential_savings_usd)
    .slice(0, 4)
    .map((source) => {
      const recommendation =
        source.recommendation === "Remove"
          ? "Archive or remove low-utilization source after validation."
          : source.recommendation === "Optimize"
            ? "Optimize fields/retention to reduce ingest without losing value."
            : "Keep source as high-value and focus on tuning queries.";

      const tag =
        source.recommendation === "Remove"
          ? "High Impact"
          : source.recommendation === "Optimize"
            ? "Optimization"
            : "Maintain";

      return {
        id: `${source.index}:${source.name}`,
        title: `${source.name} (${source.index})`,
        recommendation,
        annualSavings: source.potential_savings_usd,
        complexity:
          source.recommendation === "Remove"
            ? "High"
            : source.recommendation === "Optimize"
              ? "Medium"
              : "Low",
        timeline: formatRangeWeeks(source.potential_savings_usd),
        tag,
      };
    });

  const topFinding = metrics.security_findings
    .slice()
    .sort((a, b) => b.impact_on_savings_percent - a.impact_on_savings_percent)[0];

  const executedSteps = metrics.executed_steps ?? [];
  const queryContext = metrics.query_context;
  const showQueryTrace = executedSteps.length > 0;

  return (
    <section className="pt-4 pb-10 px-4 sm:px-6 lg:px-8 sm:pt-6 lg:pb-12" data-testid="waste-page">
      {/* Header */}
      <div className="mb-12">
        <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
          Telemetry Value Metrics
        </h2>
        <p className="text-base font-semibold text-secondary mb-2">Data Utilization & ROI Analysis</p>
        <p className="text-on-surface-variant text-sm max-w-3xl">
          Comprehensive analysis of your data sources showing utilization efficiency, annual spend breakdown,
          security posture, and optimization recommendations to reduce costs while improving data protection.
        </p>
      </div>

      {/* Section 1: Summary Metrics */}
      <div className="mb-12">
        <h3 className="text-xl font-headline font-semibold text-on-surface mb-6">
          Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MotionCard className="rounded-xl border border-outline-variant/10 bg-surface-container p-5" title={TOOLTIP.dashboard.annualSpend}>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Total Annual Spend</p>
            <p className="mt-3 text-3xl font-black text-on-surface">
              {formatCompactUsd(metrics.summary.total_annual_spend_usd)}
            </p>
            <p className="mt-2 text-xs text-on-surface-variant">across all data sources</p>
          </MotionCard>

          <MotionCard className="rounded-xl border border-outline-variant/10 bg-error-container/20 border-error/30 p-5" title={TOOLTIP.dashboard.potentialSavings}>
            <p className="text-[10px] uppercase tracking-widest text-error font-bold">Potential Savings</p>
            <p className="mt-3 text-3xl font-black text-error">
              {formatCompactUsd(metrics.summary.total_potential_savings_usd)}
            </p>
            <p className="mt-2 text-xs text-on-surface-variant">available with optimization</p>
          </MotionCard>

          <MotionCard className="rounded-xl border border-outline-variant/10 bg-surface-container p-5" title={TOOLTIP.dashboard.utilization}>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
              Avg Utilization Score
            </p>
            <p className="mt-3 text-3xl font-black text-tertiary">{metrics.summary.avg_utilization_score}%</p>
            <p className="mt-2 text-xs text-on-surface-variant">across all sources</p>
          </MotionCard>

          <MotionCard className="rounded-xl border border-outline-variant/10 bg-surface-container p-5" title={TOOLTIP.dashboard.securityGaps}>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
              Security Gaps Found
            </p>
            <p className="mt-3 text-3xl font-black text-on-surface">{metrics.summary.security_gap_count}</p>
            <p className="mt-2 text-xs text-on-surface-variant">
              improvement opportunities
            </p>
          </MotionCard>
        </div>
      </div>

      {showQueryTrace ? (
        <div className="mb-12">
          <h3 className="text-xl font-headline font-semibold text-on-surface mb-3">
            Live Query Trace
          </h3>
          <p className="text-xs text-on-surface-variant mb-4">
            Adapter:{" "}
            <span className="text-on-surface font-semibold">
              {queryContext?.backend ?? "unknown"}
            </span>{" "}
            | Live mode:{" "}
            <span className="text-on-surface font-semibold">
              {queryContext?.live_mode ? "enabled" : "disabled"}
            </span>{" "}
            | Data source used:{" "}
            <span className="text-on-surface font-semibold">
              {queryContext?.used_live_data ? "live Splunk query results" : "fallback dataset"}
            </span>
          </p>
          {queryContext?.fallback_reason ? (
            <p className="text-xs text-warning mb-3">
              Fallback reason: {queryContext.fallback_reason}
            </p>
          ) : null}

          <div className="space-y-3">
            {executedSteps.map((step, idx) => (
              <article
                key={`${step.id}-${idx}`}
                className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-on-surface">{idx + 1}. {step.description}</p>
                  <span
                    className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${
                      step.status === "executed"
                        ? "bg-secondary-container/20 text-secondary"
                        : step.status === "fallback"
                          ? "bg-error-container/20 text-error"
                          : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {step.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">{step.purpose}</p>
                <p className="mt-2 text-xs font-mono rounded bg-surface-container-lowest border border-outline-variant/20 px-2 py-1 text-on-surface-variant overflow-x-auto">
                  {step.query}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {/* Section 2: Source Value Analysis */}
      <div className="mb-12">
        <h3 className="text-xl font-headline font-semibold text-on-surface mb-6">
          Data Source Analysis
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Utilization scores */}
          <div className="space-y-4">
            <div className="text-sm font-semibold text-on-surface mb-4">Sources by Utilization</div>
            {metrics.sources
              .sort((a, b) => b.utilization_score - a.utilization_score)
              .map((source) => (
                <SourceUtilizationCard
                  key={`${source.index}:${source.name}`}
                  sourceIndex={`${source.name} (${source.index})`}
                  utilizationScore={source.utilization_score}
                  valueRating={source.value_rating}
                  annualSpendUsd={source.annual_spend_usd}
                  potentialSavingsUsd={source.potential_savings_usd}
                  dailyIngestGb={source.daily_ingest_gb}
                />
              ))}
          </div>

          {/* Right columns: Matrix and value positioning */}
          <div className="lg:col-span-2">
            <SourceValueMatrix
              sources={metrics.sources.map((s) => ({
                id: `${s.index}:${s.name}`,
                name: s.name,
                dailyGb: s.daily_ingest_gb,
                utilizationScore: s.utilization_score,
                annualCostUsd: s.annual_spend_usd,
                recommendation: s.recommendation as "Keep" | "Optimize" | "Remove",
              }))}
            />
          </div>
        </div>
      </div>

      {/* Section 3: Financial Impact */}
      <div className="mb-12">
        <ROIBreakdown
          sources={metrics.sources.map((s) => ({
            name: s.name,
            currentSpendUsd: s.annual_spend_usd,
            potentialSavingsUsd: s.potential_savings_usd,
          }))}
        />
      </div>

      {metrics.realized_savings ? (
        <div className="mb-12">
          <h3 className="text-xl font-headline font-semibold text-on-surface mb-6">
            Value Realization Tracker
          </h3>
          <div className="rounded-xl border border-secondary/25 bg-secondary-container/10 p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MotionCard className="rounded-lg border border-outline-variant/15 bg-surface-container-low p-4">
                <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                  Estimated Annual Savings
                </p>
                <p className="mt-2 text-2xl font-black text-on-surface">
                  {formatUsd(metrics.realized_savings.estimated_annual_savings_usd)}
                </p>
              </MotionCard>
              <MotionCard className="rounded-lg border border-outline-variant/15 bg-surface-container-low p-4">
                <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                  Realized To Date
                </p>
                <p className="mt-2 text-2xl font-black text-secondary">
                  {formatUsd(metrics.realized_savings.realized_to_date_usd)}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {metrics.realized_savings.realization_pct}% of annual plan
                </p>
              </MotionCard>
              <MotionCard className="rounded-lg border border-outline-variant/15 bg-surface-container-low p-4">
                <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                  Next Milestone
                </p>
                <p className="mt-2 text-sm font-bold text-on-surface">
                  {metrics.realized_savings.next_milestone}
                </p>
                <p className="mt-1 text-lg font-black text-tertiary">
                  {formatUsd(metrics.realized_savings.next_milestone_target_usd)}
                </p>
              </MotionCard>
            </div>
          </div>
        </div>
      ) : null}

      {/* Section 4: Security & Compliance */}
      <div className="mb-12">
        <SecurityGapsList
          findings={metrics.security_findings.map((f) => ({
            id: f.id,
            category: f.category,
            title: f.title,
            severity: f.severity,
            resolutionConfidencePercent: f.resolution_confidence_percent,
            impactOnSavingsPercent: f.impact_on_savings_percent,
            description: f.description,
            reasonCodes: f.reason_codes,
            decisionThresholds: f.decision_thresholds
              ? {
                  ingestMinGbPerDay: f.decision_thresholds.ingest_min_gb_per_day,
                  searchCount90dMax: f.decision_thresholds.search_count_90d_max,
                  dashboardRefsMax: f.decision_thresholds.dashboard_refs_max,
                  alertRefsMax: f.decision_thresholds.alert_refs_max,
                  actual: {
                    dailyIngestGb: f.decision_thresholds.actual.daily_ingest_gb,
                    searchCount90d: f.decision_thresholds.actual.search_count_90d,
                    dashboardReferences: f.decision_thresholds.actual.dashboard_references,
                    alertReferences: f.decision_thresholds.actual.alert_references,
                  },
                }
              : undefined,
            recommendedAction: f.recommended_action,
            riskIfRemoved: f.risk_if_removed,
            estimatedRealizedSavingsUsd: f.estimated_realized_savings_usd,
          }))}
        />
      </div>

      {/* Section 5: Projected Savings */}
      <div className="mb-12">
        <StorageSavingsTimeline
          projections={metrics.savings_projection.map((p) => ({
            month: p.month,
            label: p.label,
            currentTrajectoryUsd: p.current_trajectory_usd,
            optimizedTrajectoryUsd: p.optimized_trajectory_usd,
          }))}
        />
      </div>

      {/* Section 6: Recommended Actions */}
      <div className="mb-12">
        <h3 className="text-xl font-headline font-semibold text-on-surface mb-6">
          Recommended Optimization Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendedActions.map((action) => (
            <article
              key={action.id}
              className="card-lift rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 space-y-3"
              title={`Recommendation for ${action.title}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-on-surface">{action.title}</h4>
                  <p className="text-xs text-on-surface-variant mt-1">{action.recommendation}</p>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-secondary-container/20 text-secondary whitespace-nowrap">
                  {action.tag}
                </span>
              </div>
              <div className="bg-surface-container-lowest rounded p-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">Annual Savings:</span>
                  <span className="font-bold text-secondary">{formatCompactUsd(action.annualSavings)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">Complexity:</span>
                  <span className="font-bold text-on-surface">{action.complexity}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">Timeline:</span>
                  <span className="font-bold text-on-surface">{action.timeline}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Key Insights */}
      <div className="p-6 bg-primary-container/10 border border-primary/20 rounded-xl space-y-4">
        <h4 className="font-bold text-on-surface">💡 Key Insights from AgenticOps Analysis</h4>
        <ul className="text-sm text-on-surface-variant space-y-2 list-disc list-inside">
          <li>
            <span className="text-on-surface font-semibold">High-value sources</span> are determined from live
            utilization, search usage, and dashboard/alert references in your current telemetry window.
          </li>
          <li>
            <span className="text-on-surface font-semibold">Top optimization opportunity</span> currently indicates{" "}
            {recommendedActions[0]?.title ?? "n/a"} with potential savings of{" "}
            {formatCompactUsd(recommendedActions[0]?.annualSavings ?? 0)}.
          </li>
          <li>
            <span className="text-on-surface font-semibold">Security posture improvement</span> aligns with{" "}
            {topFinding?.title ?? "current detection gaps"} ({topFinding?.severity ?? "n/a"}) and can unlock
            additional value impact.
          </li>
          <li>
            All recommendations are generated from the live API payload so numbers evolve as ingest and query
            behavior changes in Splunk.
          </li>
        </ul>
      </div>
    </section>
  );
}
