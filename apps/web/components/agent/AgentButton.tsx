"use client";

export type AgentButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "disabled";

interface AgentButtonProps {
  label: string;
  variant?: AgentButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
  onClick: () => void;
}

const variantClass: Record<AgentButtonVariant, string> = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/60",
  secondary: "bg-slate-900/70 hover:bg-slate-800 text-white border border-white/20",
  danger: "bg-red-600/80 hover:bg-red-500 text-white border border-red-400/40",
  ghost: "bg-transparent hover:bg-white/10 text-white border border-white/15",
  disabled: "bg-slate-900/40 text-white/50 border border-white/10 cursor-not-allowed",
};

export function AgentButton({ label, variant = "secondary", disabled = false, loading = false, tooltip, onClick }: AgentButtonProps) {
  const isDisabled = disabled || loading || variant === "disabled";
  return (
    <button
      type="button"
      disabled={isDisabled}
      title={tooltip}
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${variantClass[isDisabled ? "disabled" : variant]}`}
    >
      {loading ? "Loading..." : label}
    </button>
  );
}
