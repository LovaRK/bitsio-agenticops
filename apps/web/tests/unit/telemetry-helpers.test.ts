import { describe, expect, test } from 'vitest';
import { calculateAnnualCost, calculateCompositeScore, calculateSavings, calculateWastePercent, classifyQuadrant } from '@/lib/telemetry/scoring';
import { deriveOptimizationActions, deriveRecommendedAction, deriveRiskLevel } from '@/lib/telemetry/recommendations';
import { deriveAgentDecision } from '@/lib/telemetry/narrative';
import { evaluateGuardrail, isDestructiveAction } from '@/lib/agent/guardrails';
import type { TelemetryMetricsResponse } from '@/types/telemetry';

const baseMetrics: TelemetryMetricsResponse = {
  summary: {
    total_annual_spend_usd: 1000,
    low_value_spend_usd: 300,
    security_gap_count: 3,
  },
  sources: [
    {
      sourcetype: 'app:payments',
      utilization_score: 60,
      detection_score: 40,
      quality_score: 90,
      annual_cost_usd: 500,
      potential_savings_usd: 120,
      tier: 'Important',
      detection_gap: true,
    },
    {
      sourcetype: 'infra:cpu',
      utilization_score: 10,
      detection_score: 15,
      quality_score: 70,
      annual_cost_usd: 500,
      potential_savings_usd: 80,
      tier: 'Wasteful',
    },
  ],
  security_findings: [{ severity: 'medium' }],
  savings_projection: [{ stage: 'Current', annual_cost_usd: 1000 }],
  query_context: { confidence: 0.9 },
};

describe('telemetry scoring helpers', () => {
  test('composite score calculation uses weighted formula', () => {
    expect(calculateCompositeScore(60, 40, 90)).toBeCloseTo(59.5, 3);
  });

  test('annual cost and savings calculations are deterministic', () => {
    expect(calculateAnnualCost(2, 150)).toBe(109500);
    expect(calculateSavings(100, 70)).toBe(30);
    expect(calculateSavings(70, 100)).toBe(0);
  });

  test('quadrant classifier maps correctly', () => {
    expect(classifyQuadrant({ sourcetype: 'x', utilization_score: 80, detection_score: 80 })).toBe('High Value - Keep');
    expect(classifyQuadrant({ sourcetype: 'x', utilization_score: 80, detection_score: 20 })).toBe('Usage Heavy - Improve Security');
    expect(classifyQuadrant({ sourcetype: 'x', utilization_score: 20, detection_score: 80 })).toBe('Detection Heavy - Optimize');
    expect(classifyQuadrant({ sourcetype: 'x', utilization_score: 20, detection_score: 20 })).toBe('Low Value - Archive / Remove');
  });

  test('waste percent uses summary totals', () => {
    expect(calculateWastePercent(baseMetrics.summary, baseMetrics.sources)).toBe(30);
  });
});

describe('recommendation and narrative helpers', () => {
  test('recommended action prioritizes detection gaps', () => {
    expect(deriveRecommendedAction(baseMetrics.sources[0])).toBe('Improve detection');
    expect(deriveRecommendedAction(baseMetrics.sources[1])).toBe('Archive to S3');
  });

  test('optimization actions are derived for each source', () => {
    const actions = deriveOptimizationActions(baseMetrics.sources);
    expect(actions).toHaveLength(2);
    expect(actions[0].sourcetype).toBe('app:payments');
  });

  test('risk and decision derivation are deterministic', () => {
    expect(deriveRiskLevel(baseMetrics.summary, baseMetrics.security_findings)).toBe('medium');
    const decision = deriveAgentDecision(baseMetrics);
    expect(decision.risk).toBe('medium');
    expect(decision.requiresApproval).toBe(true);
  });
});

describe('guardrail helpers', () => {
  test('destructive action detection and blocking work', () => {
    expect(isDestructiveAction('delete_index')).toBe(true);
    expect(evaluateGuardrail('delete_index', 'low')).toBe('blocked');
  });

  test('approval requirement applies for risky or gated actions', () => {
    expect(evaluateGuardrail('retention_reduction', 'low')).toBe('approval_required');
    expect(evaluateGuardrail('read_only_spl_analysis', 'low')).toBe('allowed');
    expect(evaluateGuardrail('read_only_spl_analysis', 'high')).toBe('approval_required');
  });
});
