"use client";

type FormatType = "number" | "currency" | "percent";

interface DonutGaugeProps {
  value: number;
  maxValue: number;
  label: string;
  color: string;
  format?: FormatType;
  size?: number;
  tooltipText?: string;
}

function formatValue(value: number, format: FormatType): string {
  if (format === "currency") {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }
  if (format === "percent") return `${value.toFixed(1)}%`;
  return value.toFixed(1);
}

export function DonutGauge({
  value,
  maxValue,
  label,
  color,
  format = "number",
  size = 120,
  tooltipText,
}: DonutGaugeProps) {
  const radius = (size / 2) * 0.7;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const fillPct = maxValue > 0 ? Math.min(1, Math.max(0, value / maxValue)) : 0;
  const dashOffset = circumference * (1 - fillPct);

  return (
    <div className="relative flex flex-col items-center" title={tooltipText}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={label}>
        {/* Background ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(140,144,161,0.2)"
          strokeWidth={size * 0.08}
        />
        {/* Fill ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.08}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {/* Center value */}
        <text
          x={cx}
          y={cy - (size * 0.04)}
          textAnchor="middle"
          fontSize={size * 0.16}
          fontWeight="900"
          fill="currentColor"
          className="text-on-surface"
        >
          {formatValue(value, format)}
        </text>
        <text
          x={cx}
          y={cy + (size * 0.13)}
          textAnchor="middle"
          fontSize={size * 0.09}
          fill="rgba(140,144,161,0.9)"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
