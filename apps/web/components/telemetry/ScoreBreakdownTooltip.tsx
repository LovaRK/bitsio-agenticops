"use client";

import { useState } from "react";

interface ScoreInput {
  label: string;
  value: number;
  weight: number;
  color: string;
}

interface ScoreBreakdownTooltipProps {
  label: string;
  value: number;
  formula?: string;
  inputs?: ScoreInput[];
  explanation?: string;
  source?: string;
  children: React.ReactNode;
}

export function ScoreBreakdownTooltip({
  label,
  value,
  formula,
  inputs,
  explanation,
  source,
  children,
}: ScoreBreakdownTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl border border-outline-variant/20 bg-surface-container-high shadow-xl p-4 text-xs">
          <p className="font-bold text-on-surface mb-1">{label}</p>
          <p className="text-secondary text-lg font-black mb-2">{value.toFixed(1)}</p>
          {formula && (
            <p className="font-mono text-on-surface-variant mb-2 text-[10px]">{formula}</p>
          )}
          {inputs && inputs.length > 0 && (
            <div className="space-y-1 mb-2">
              {inputs.map((inp) => (
                <div key={inp.label} className="flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: inp.color }}
                  />
                  <span className="text-on-surface-variant flex-1">{inp.label}</span>
                  <span className="font-semibold text-on-surface">
                    {inp.value.toFixed(1)} × {inp.weight}
                  </span>
                </div>
              ))}
            </div>
          )}
          {explanation && (
            <p className="text-on-surface-variant leading-relaxed">{explanation}</p>
          )}
          {source && (
            <p className="mt-1 text-[9px] uppercase tracking-wider text-on-surface-variant">
              source: {source}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
