import { getTelemetryMetrics } from "@/lib/services/waste";
import { SourceUtilizationCard } from "@/components/SourceUtilizationCard";
import { SourceValueMatrix } from "@/components/SourceValueMatrix";
import { ROIBreakdown } from "@/components/ROIBreakdown";
import { SecurityGapsList } from "@/components/SecurityGapsList";
import { StorageSavingsTimeline } from "@/components/StorageSavingsTimeline";

export default async function WastePage() {
  const metrics = await getTelemetryMetrics();

  return (
    <section className="pt-6 pb-12 px-8" data-testid="waste-page">
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
          <article className="rounded-xl border border-outline-variant/10 bg-surface-container p-5">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Total Annual Spend</p>
            <p className="mt-3 text-3xl font-black text-on-surface">
              ${(metrics.summary.total_annual_spend_usd / 1000000).toFixed(2)}M
            </p>
            <p className="mt-2 text-xs text-on-surface-variant">across all data sources</p>
          </article>

          <article className="rounded-xl border border-outline-variant/10 bg-error-container/20 border-error/30 p-5">
            <p className="text-[10px] uppercase tracking-widest text-error font-bold">Potential Savings</p>
            <p className="mt-3 text-3xl font-black text-error">
              ${(metrics.summary.total_potential_savings_usd / 1000000).toFixed(2)}M
            </p>
            <p className="mt-2 text-xs text-on-surface-variant">available with optimization</p>
          </article>

          <article className="rounded-xl border border-outline-variant/10 bg-surface-container p-5">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
              Avg Utilization Score
            </p>
            <p className="mt-3 text-3xl font-black text-tertiary">{metrics.summary.avg_utilization_score}%</p>
            <p className="mt-2 text-xs text-on-surface-variant">across all sources</p>
          </article>

          <article className="rounded-xl border border-outline-variant/10 bg-surface-container p-5">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
              Security Gaps Found
            </p>
            <p className="mt-3 text-3xl font-black text-on-surface">{metrics.summary.security_gap_count}</p>
            <p className="mt-2 text-xs text-on-surface-variant">
              improvement opportunities
            </p>
          </article>
        </div>
      </div>

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
                  key={source.index}
                  sourceIndex={source.index}
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
                id: s.index,
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
          <article className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-on-surface">Reduce Data Retention</h4>
                <p className="text-xs text-on-surface-variant mt-1">
                  Shorten retention policies from 90d to 30d for low-utilization sources
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-secondary-container/20 text-secondary whitespace-nowrap">
                Quick Win
              </span>
            </div>
            <div className="bg-surface-container-lowest rounded p-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Annual Savings:</span>
                <span className="font-bold text-secondary">~$180K</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Complexity:</span>
                <span className="font-bold text-on-surface">Low</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Timeline:</span>
                <span className="font-bold text-on-surface">1-2 weeks</span>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-on-surface">Archive Low-Value Sources</h4>
                <p className="text-xs text-on-surface-variant mt-1">
                  Move Cisco Nexus data to cold storage or remove entirely
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-error-container/20 text-error whitespace-nowrap">
                High Impact
              </span>
            </div>
            <div className="bg-surface-container-lowest rounded p-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Annual Savings:</span>
                <span className="font-bold text-error">~$290K</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Complexity:</span>
                <span className="font-bold text-on-surface">High</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Timeline:</span>
                <span className="font-bold text-on-surface">4-6 weeks</span>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-on-surface">Field Filtering & Optimization</h4>
                <p className="text-xs text-on-surface-variant mt-1">
                  Remove unused fields from Windows Events and Application Logs
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-tertiary-container/20 text-tertiary whitespace-nowrap">
                Medium Effort
              </span>
            </div>
            <div className="bg-surface-container-lowest rounded p-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Annual Savings:</span>
                <span className="font-bold text-secondary">~$75K</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Complexity:</span>
                <span className="font-bold text-on-surface">Medium</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Timeline:</span>
                <span className="font-bold text-on-surface">2-3 weeks</span>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-on-surface">Resolve Security Gaps</h4>
                <p className="text-xs text-on-surface-variant mt-1">
                  Add cloud access logs and mobile device telemetry for complete coverage
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-secondary-container/20 text-secondary whitespace-nowrap">
                Security
              </span>
            </div>
            <div className="bg-surface-container-lowest rounded p-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Annual Savings:</span>
                <span className="font-bold text-secondary">~$35K</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Complexity:</span>
                <span className="font-bold text-on-surface">Medium</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Timeline:</span>
                <span className="font-bold text-on-surface">3-4 weeks</span>
              </div>
            </div>
          </article>
        </div>
      </div>

      {/* Key Insights */}
      <div className="p-6 bg-primary-container/10 border border-primary/20 rounded-xl space-y-4">
        <h4 className="font-bold text-on-surface">💡 Key Insights from AgenticOps Analysis</h4>
        <ul className="text-sm text-on-surface-variant space-y-2 list-disc list-inside">
          <li>
            <span className="text-on-surface font-semibold">High-value sources</span> (Office 365, DNS) show strong
            utilization (78-92%) and are candidates for retention given their security and operational value.
          </li>
          <li>
            <span className="text-on-surface font-semibold">Cisco Nexus</span> represents the largest optimization
            opportunity at ~$290K annual savings with minimal operational impact (22% utilization, 0 searches).
          </li>
          <li>
            <span className="text-on-surface font-semibold">Security posture improvement</span> can be achieved
            alongside cost optimization by adding cloud access logs and mobile telemetry (+12% savings impact).
          </li>
          <li>
            Phased implementation starting with retention policy updates and field filtering can deliver
            <span className="text-on-surface font-semibold"> 50% of potential savings</span> within 30 days with low
            operational risk.
          </li>
        </ul>
      </div>
    </section>
  );
}
