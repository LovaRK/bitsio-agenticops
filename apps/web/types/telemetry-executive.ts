/**
 * datasensAI v3 Executive Telemetry Dashboard — TypeScript types.
 * Matches the Python response shape from /api/v1/telemetry/executive-summary.
 */

export type TierName = "Critical" | "Important" | "Nice-to-Have" | "Wasteful";

export interface ExecutiveKPIs {
  roi_score: number;
  gainscope: number;
  low_value_license_spend_usd: number;
  storage_savings_potential_usd: number;
  total_daily_volume_gb: number;
  total_sourcetypes_assessed: number;
  total_annual_spend_usd: number;
}

export interface DataValueVolume {
  utilized_gb: number;
  underutilized_gb: number;
  utilized_pct: number;
  underutilized_pct: number;
}

export interface DataValueCount {
  utilized_count: number;
  underutilized_count: number;
  utilized_pct: number;
  underutilized_pct: number;
}

export interface DataValueSplit {
  volume: DataValueVolume;
  sourcetype_count: DataValueCount;
}

export interface QuickWin {
  rank: number;
  category: string;
  action: string;
  sourcetype: string;
  estimated_impact_usd: number;
  details: string;
}

export interface TierData {
  count: number;
  annual_cost_usd: number;
  daily_gb: number;
  pct: number;
}

export type TierDistribution = Record<TierName, TierData>;

export interface SavingsStaircaseStage {
  stage: number;
  label: string;
  annual_cost_usd: number;
  description: string;
}

export interface TopSourcetype {
  sourcetype: string;
  gb_per_day: number;
  tier: TierName;
  composite: number;
}

export interface S3Candidate {
  sourcetype: string;
  tier: TierName;
  composite: number;
  gb_per_day: number;
  annual_cost_usd: number;
  utilization: number;
  detection: number;
  recommended_action: string;
}

export interface MitreGap {
  sourcetype: string;
  mitre_coverage_pct: number;
  tier: TierName;
}

export interface OperationalGap {
  sourcetype: string;
  detection: number;
  alert_count: number;
}

export interface SecurityGaps {
  mitre_gaps: MitreGap[];
  mitre_gap_count: number;
  operational_gaps: OperationalGap[];
  operational_gap_count: number;
  detection_coverage_by_domain: {
    infrastructure: number;
    network: number;
    cloud: number;
    endpoint: number;
    application: number;
  };
}

export interface SourcetypeScore {
  sourcetype: string;
  index: string;
  composite: number;
  utilization: number;
  detection: number;
  quality: number;
  tier: TierName;
  gb_per_day: number;
  annual_cost_usd: number;
  potential_savings_usd: number;
  detection_gap: boolean;
  retention_days: number;
  total_fields: number;
  unused_field_pct: number;
  alert_count: number;
  scheduled_search_count: number;
  dashboard_ref_count: number;
  adhoc_search_count: number;
  unique_user_count: number;
  mitre_coverage_pct: number;
  lantern_coverage_pct: number;
}

export interface ScoreProfile {
  utilization: number;
  detection: number;
  quality: number;
}

export type ScoreProfilesByTier = Record<TierName, ScoreProfile>;

export interface AvgScores {
  utilization: number;
  detection: number;
  quality: number;
}

export interface ScoringConfig {
  cost_per_gb_year: number;
  util_weight: number;
  det_weight: number;
  qual_weight: number;
}

export interface TrustMeta {
  data_source: "live" | "seed";
  fallback_used: boolean;
  latency_ms: number;
  confidence: number;
}

export interface ExecutiveSummaryResponse {
  executive_kpis: ExecutiveKPIs;
  data_value_split: DataValueSplit;
  quick_wins: QuickWin[];
  tier_distribution: TierDistribution;
  score_profiles_by_tier: ScoreProfilesByTier;
  savings_staircase: SavingsStaircaseStage[];
  top_sourcetypes_by_volume: TopSourcetype[];
  s3_candidates: S3Candidate[];
  security_gaps: SecurityGaps;
  avg_scores: AvgScores;
  resolution_confidence: number;
  sourcetype_scores: SourcetypeScore[];
  scoring_config: ScoringConfig;
  trust: TrustMeta;
}
