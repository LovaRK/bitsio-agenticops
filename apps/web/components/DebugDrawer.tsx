"use client";

import { useState } from "react";

type DebugMeta = {
  model_provider?: string | null;
  model_name?: string | null;
  runtime_mode?: string | null;
  adapter_mode?: string | null;
  prompt_template?: string | null;
  context_source?: string | null;
  input_token_estimate?: number | null;
  output_token_estimate?: number | null;
  latency_ms?: number | null;
  fallback_used?: boolean;
  retrieval_mode?: string | null;
  tools_selected?: string[];
  redacted?: boolean;
};

type Props = {
  debugMeta: DebugMeta | null | undefined;
  label?: string;
};

type Row = { label: string; value: string | number | boolean | null | undefined };

function DebugRow({ label, value }: Row) {
  if (value == null || value === "") return null;
  const display =
    typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-[11px] text-on-surface-variant">{label}</span>
      <span className="text-right text-[11px] font-mono text-on-surface">{display}</span>
    </div>
  );
}

export function DebugDrawer({ debugMeta, label = "Show Debug Details" }: Props) {
  const [open, setOpen] = useState(false);

  if (!debugMeta) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-primary transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">
          {open ? "expand_less" : "expand_more"}
        </span>
        {label}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-3">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-on-surface-variant">
            How this answer was produced
            {debugMeta.redacted && (
              <span className="ml-2 rounded bg-warning-container/40 px-1 py-0.5 text-[9px] text-warning">
                some details redacted
              </span>
            )}
          </p>

          <div className="divide-y divide-outline-variant/10">
            <DebugRow label="Provider" value={debugMeta.model_provider} />
            <DebugRow label="Model" value={debugMeta.model_name} />
            <DebugRow label="Runtime mode" value={debugMeta.runtime_mode} />
            <DebugRow label="Adapter mode" value={debugMeta.adapter_mode} />
            <DebugRow label="Prompt template" value={debugMeta.prompt_template} />
            <DebugRow label="Context source" value={debugMeta.context_source} />
            <DebugRow label="Retrieval mode" value={debugMeta.retrieval_mode} />
            <DebugRow label="Input tokens (est.)" value={debugMeta.input_token_estimate} />
            <DebugRow label="Output tokens (est.)" value={debugMeta.output_token_estimate} />
            <DebugRow label="Latency" value={debugMeta.latency_ms != null ? `${debugMeta.latency_ms}ms` : null} />
            <DebugRow label="Fallback used" value={debugMeta.fallback_used} />
            {debugMeta.tools_selected && debugMeta.tools_selected.length > 0 && (
              <DebugRow label="Tools" value={debugMeta.tools_selected.join(", ")} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
