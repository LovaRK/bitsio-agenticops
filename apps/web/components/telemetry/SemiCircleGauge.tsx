"use client";

interface SemiCircleGaugeProps {
  value: number;
  max: number;
  label: string;
  tooltipText?: string;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function valueToColor(value: number, max: number): string {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  if (pct < 0.5) {
    // red → yellow
    const r = Math.round(lerp(244, 255, pct * 2));
    const g = Math.round(lerp(67, 193, pct * 2));
    const b = Math.round(lerp(54, 7, pct * 2));
    return `rgb(${r},${g},${b})`;
  }
  // yellow → green
  const r = Math.round(lerp(255, 76, (pct - 0.5) * 2));
  const g = Math.round(lerp(193, 175, (pct - 0.5) * 2));
  const b = Math.round(lerp(7, 80, (pct - 0.5) * 2));
  return `rgb(${r},${g},${b})`;
}

export function SemiCircleGauge({ value, max, label, tooltipText }: SemiCircleGaugeProps) {
  const W = 160;
  const H = 90;
  const cx = W / 2;
  const cy = H - 10;
  const r = 65;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const angle = Math.PI * pct; // 0 → π
  const endX = cx + r * Math.cos(Math.PI - angle);
  const endY = cy - r * Math.sin(angle);
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${endX} ${endY}`;
  const color = valueToColor(value, max);

  return (
    <div className="flex flex-col items-center" title={tooltipText}>
      <svg width={W} height={H + 20} viewBox={`0 0 ${W} ${H + 20}`} aria-label={label}>
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(140,144,161,0.2)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Value arc */}
        {pct > 0 && (
          <path
            d={arcPath}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
          />
        )}
        {/* Center value */}
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fontSize="22"
          fontWeight="900"
          fill={color}
        >
          {value.toFixed(1)}
        </text>
        {/* Label */}
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontSize="9"
          fill="rgba(140,144,161,0.9)"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
