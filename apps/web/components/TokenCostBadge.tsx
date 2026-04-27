"use client";

type TokenMeta = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number | null;
  latency_ms?: number | null;
  provider?: string | null;
  model?: string | null;
};

type Props = {
  tokenMeta: TokenMeta | null | undefined;
  compact?: boolean;
};

export function TokenCostBadge({ tokenMeta, compact = false }: Props) {
  if (!tokenMeta || (!tokenMeta.total_tokens && !tokenMeta.latency_ms)) return null;

  const tokens = tokenMeta.total_tokens ?? 0;
  const cost = tokenMeta.estimated_cost_usd;
  const latency = tokenMeta.latency_ms;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/20 bg-surface-container-lowest px-2 py-0.5 text-[10px] text-on-surface-variant">
        <span className="material-symbols-outlined text-[12px]">token</span>
        {tokens.toLocaleString()}
        {cost != null && cost > 0 && (
          <span className="text-on-surface-variant/60">· ${cost.toFixed(6)}</span>
        )}
        {latency != null && (
          <span className="text-on-surface-variant/60">· {latency}ms</span>
        )}
      </span>
    );
  }

  return (
    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Token Usage</p>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {tokenMeta.input_tokens != null && (
          <span className="text-xs text-on-surface-variant">
            In: <strong className="text-on-surface">{tokenMeta.input_tokens.toLocaleString()}</strong>
          </span>
        )}
        {tokenMeta.output_tokens != null && (
          <span className="text-xs text-on-surface-variant">
            Out: <strong className="text-on-surface">{tokenMeta.output_tokens.toLocaleString()}</strong>
          </span>
        )}
        {tokens > 0 && (
          <span className="text-xs text-on-surface-variant">
            Total: <strong className="text-on-surface">{tokens.toLocaleString()}</strong>
          </span>
        )}
        {cost != null && (
          <span className="text-xs text-on-surface-variant">
            Cost:{" "}
            <strong className="text-on-surface">
              {cost === 0 ? "local (free)" : `$${cost.toFixed(6)}`}
            </strong>
          </span>
        )}
        {latency != null && (
          <span className="text-xs text-on-surface-variant">
            Latency: <strong className="text-on-surface">{latency}ms</strong>
          </span>
        )}
        {tokenMeta.provider && (
          <span className="text-xs text-on-surface-variant">
            Model: <strong className="text-on-surface">{tokenMeta.provider}/{tokenMeta.model}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
