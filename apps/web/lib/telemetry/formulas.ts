export interface FormulaItem {
  key: string;
  what: string;
  formula: string;
  example: string;
  sourceFields: string[];
  whyItMatters: string;
}

export const FORMULAS: FormulaItem[] = [
  {
    key: 'composite',
    what: 'Composite value score for each sourcetype.',
    formula: '0.35 * Utilization + 0.40 * Detection + 0.25 * Quality',
    example: '0.35*60 + 0.40*45 + 0.25*90 = 61.5',
    sourceFields: ['utilization_score', 'detection_score', 'quality_score'],
    whyItMatters: 'Ranks telemetry value to prioritize optimization and risk actions.',
  },
  {
    key: 'annual_cost',
    what: 'Estimated annual telemetry license cost.',
    formula: 'GB/day * 365 * cost_per_gb_year',
    example: '5 * 365 * 150 = 273,750',
    sourceFields: ['gb_per_day', 'cost_per_gb_year'],
    whyItMatters: 'Quantifies spend concentration by source.',
  },
  {
    key: 'savings',
    what: 'Projected optimization savings.',
    formula: 'Current Cost - Optimized Cost',
    example: '120,000 - 95,000 = 25,000',
    sourceFields: ['annual_cost_usd', 'potential_savings_usd'],
    whyItMatters: 'Translates recommended actions to business impact.',
  },
];
