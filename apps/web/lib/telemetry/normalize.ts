import type { SourceProfile, TelemetryMetricsResponse } from '@/types/telemetry';

export interface NormalizedTelemetryViewModel extends TelemetryMetricsResponse {
  summary: TelemetryMetricsResponse['summary'] & {
    total_annual_spend_usd: number;
    total_potential_savings_usd: number;
    total_daily_volume_gb: number;
    total_sourcetypes_assessed: number;
  };
  sources: SourceProfile[];
}

export const normalizeTelemetryResponse = (input: TelemetryMetricsResponse): NormalizedTelemetryViewModel => {
  const safeInput = input ?? ({} as TelemetryMetricsResponse);
  const summary = safeInput.summary ?? {};
  const sources = (safeInput.sources ?? []).map((s) => ({ ...s, sourcetype: s.sourcetype || 'unknown' }));
  return {
    ...safeInput,
    sources,
    summary: {
      ...summary,
      total_annual_spend_usd: summary.total_annual_spend_usd ?? sources.reduce((a, s) => a + (s.annual_cost_usd ?? 0), 0),
      total_potential_savings_usd: summary.total_potential_savings_usd ?? sources.reduce((a, s) => a + (s.potential_savings_usd ?? 0), 0),
      total_daily_volume_gb: summary.total_daily_volume_gb ?? sources.reduce((a, s) => a + (s.gb_per_day ?? 0), 0),
      total_sourcetypes_assessed: summary.total_sourcetypes_assessed ?? sources.length,
    },
    security_findings: safeInput.security_findings ?? [],
    savings_projection: safeInput.savings_projection ?? [],
    query_context: safeInput.query_context ?? {},
  };
};
