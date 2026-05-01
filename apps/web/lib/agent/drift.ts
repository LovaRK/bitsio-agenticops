import type { DriftSignal } from '@/types/agent';

export const deriveDriftSignals = (confidence: number): DriftSignal[] => {
  if (confidence >= 0.8) return [];
  return [{
    id: 'drift-confidence',
    timestamp: new Date().toISOString(),
    severity: confidence < 0.6 ? 'high' : 'medium',
    driftType: 'confidence_drop',
    explanation: 'Decision confidence fell below expected threshold.',
    previousState: 'stable',
    currentState: 'degraded',
    recommendedReviewAction: 'Review source coverage and refresh agent analysis.',
  }];
};
