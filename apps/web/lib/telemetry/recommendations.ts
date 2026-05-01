import type { SecurityFinding, SourceProfile, SummaryMetrics } from '@/types/telemetry';

export const deriveRiskLevel = (summary: SummaryMetrics, securityFindings: SecurityFinding[]): 'low' | 'medium' | 'high' | 'critical' => {
  const gaps = summary.security_gap_count ?? securityFindings.length;
  if (gaps >= 10) return 'critical';
  if (gaps >= 5) return 'high';
  if (gaps >= 2) return 'medium';
  return 'low';
};

export const deriveRecommendedAction = (source: SourceProfile): string => {
  if (source.detection_gap) return 'Improve detection';
  if ((source.utilization_score ?? 0) < 20) return 'Archive to S3';
  if ((source.quality_score ?? 100) < 70) return 'Fix parsing quality';
  return 'Keep and monitor';
};

export const deriveExpectedSavings = (source: SourceProfile): number => source.potential_savings_usd ?? (source.annual_cost_usd ?? 0) * 0.2;

export const deriveOptimizationActions = (sources: SourceProfile[]) =>
  sources.map((s) => ({
    id: `${s.sourcetype}-action`,
    action: deriveRecommendedAction(s),
    sourcetype: s.sourcetype,
    tier: s.tier ?? 'Unknown',
    score: s.composite_score ?? s.score ?? 0,
    gbPerDay: s.gb_per_day ?? 0,
    annualCost: s.annual_cost_usd ?? 0,
    expectedSavings: deriveExpectedSavings(s),
    risk: s.detection_gap ? 'high' : 'low',
    confidence: s.confidence ?? 0.85,
    why: s.detection_gap ? 'Detection gap present' : 'Cost/value optimization opportunity',
  }));

export const derivePlannedActions = (summary: SummaryMetrics, sources: SourceProfile[]) => {
  const waste = summary.low_value_spend_usd ?? 0;
  if (waste > 100_000) return deriveOptimizationActions(sources).slice(0, 5);
  return deriveOptimizationActions(sources).filter((x) => x.action === 'Improve detection').slice(0, 5);
};
