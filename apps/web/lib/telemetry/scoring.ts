import type { SourceProfile, SummaryMetrics, TelemetryMetricsResponse } from '@/types/telemetry';

export const classifyQuadrant = (source: SourceProfile): string => {
  const u = source.utilization_score ?? 0;
  const d = source.detection_score ?? 0;
  if (u >= 50 && d >= 50) return 'High Value - Keep';
  if (u < 50 && d >= 50) return 'Detection Heavy - Optimize';
  if (u >= 50 && d < 50) return 'Usage Heavy - Improve Security';
  return 'Low Value - Archive / Remove';
};

export const calculateWastePercent = (summary: SummaryMetrics, sources: SourceProfile[]): number => {
  const total = summary.total_annual_spend_usd ?? sources.reduce((a, s) => a + (s.annual_cost_usd ?? 0), 0);
  const low = summary.low_value_spend_usd ?? sources.filter((s) => s.tier === 'Wasteful' || s.tier === 'Nice-to-Have').reduce((a, s) => a + (s.annual_cost_usd ?? 0), 0);
  return total > 0 ? (low / total) * 100 : 0;
};

export const calculateConfidence = (metrics: TelemetryMetricsResponse): number => {
  const base = metrics.query_context.confidence ?? 0.8;
  const withSources = metrics.sources.length > 0 ? 0.1 : -0.2;
  const withFindings = metrics.security_findings.length > 0 ? 0.05 : 0;
  return Math.max(0.1, Math.min(0.99, base + withSources + withFindings));
};

export const calculateCompositeScore = (u: number, d: number, q: number, weights = { util: 0.35, det: 0.4, qual: 0.25 }): number =>
  weights.util * u + weights.det * d + weights.qual * q;

export const calculateAnnualCost = (gbPerDay: number, costPerGbYear: number): number => gbPerDay * 365 * costPerGbYear;
export const calculateSavings = (currentCost: number, optimizedCost: number): number => Math.max(0, currentCost - optimizedCost);
