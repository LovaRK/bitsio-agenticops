/**
 * Severity level utilities and styling.
 * Single source of truth for severity-related styling and logic.
 */

export interface SeverityStyles {
  dot: string;
  badge: string;
}

/**
 * Get Tailwind CSS classes for a severity level.
 * Returns dot (indicator) and badge (text) styles.
 */
export function getSeverityStyle(severity: string): SeverityStyles {
  const s = severity.toLowerCase();

  if (s === "critical") {
    return {
      dot: "bg-error status-glow-error",
      badge: "text-error border-error/30",
    };
  }

  if (s === "high") {
    return {
      dot: "bg-tertiary status-glow-warning",
      badge: "text-tertiary border-tertiary/30",
    };
  }

  // Default: low/medium severity
  return {
    dot: "bg-secondary status-glow-success",
    badge: "text-secondary border-secondary/30",
  };
}
