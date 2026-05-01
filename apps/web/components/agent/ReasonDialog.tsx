"use client";
import { useEffect, useRef } from "react";

export interface ReasonDialogProps {
  open: boolean;
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function ReasonDialog({
  open,
  title,
  description,
  value,
  onChange,
  onCancel,
  onSubmit,
}: ReasonDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const submitRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = [cancelRef.current, submitRef.current].filter(Boolean) as HTMLElement[];
      if (nodes.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const idx = nodes.findIndex((n) => n === active);
      if (e.shiftKey) {
        if (idx <= 0) {
          e.preventDefault();
          nodes[nodes.length - 1].focus();
        }
      } else if (idx === nodes.length - 1) {
        e.preventDefault();
        nodes[0].focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60" role="presentation" onClick={onCancel}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="mx-auto mt-24 w-full max-w-md rounded-xl border border-white/10 bg-slate-950 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-white/70">{description}</p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-3 h-24 w-full rounded-lg border border-white/15 bg-slate-900 p-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="Enter reason..."
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            ref={cancelRef}
            className="rounded border border-white/20 px-3 py-1.5 text-sm text-white"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            ref={submitRef}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={!value.trim()}
            onClick={onSubmit}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
