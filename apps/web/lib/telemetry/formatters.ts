export const formatCurrency = (v: number): string => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
};
export const formatPercent = (v: number): string => `${v.toFixed(1)}%`;
export const formatNumber = (v: number): string => v.toLocaleString();
export const formatDuration = (ms: number): string => `${ms.toFixed(0)}ms`;
export const formatLatency = (ms: number): string => `${ms.toFixed(0)}ms`;
export const formatConfidence = (c: number): string => `${Math.round(c * 100)}%`;
export const formatGb = (v: number): string => `${v.toFixed(2)} GB`;
