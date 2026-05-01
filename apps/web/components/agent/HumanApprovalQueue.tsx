"use client";
import type { ApprovalItem } from '@/types/agent';
export function HumanApprovalQueue({
  items,
  onApprove,
  onReject,
  onModify,
}: {
  items: ApprovalItem[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onModify: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white">Human Approval Queue</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-white/70">No risky actions pending approval.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((i) => (
            <div key={i.id} className="rounded-lg border border-white/10 bg-slate-900/40 p-3">
              <p className="text-sm text-white">{i.title}</p>
              <p className="text-xs text-white/60">Risk {i.risk} · Confidence {Math.round(i.confidence * 100)}%</p>
              <div className="mt-2 flex gap-2">
                <button className="rounded border border-green-400/30 px-2 py-1 text-xs text-green-300" onClick={() => onApprove(i.id)}>Approve</button>
                <button className="rounded border border-red-400/30 px-2 py-1 text-xs text-red-300" onClick={() => onReject(i.id)}>Reject</button>
                <button className="rounded border border-white/20 px-2 py-1 text-xs text-white" onClick={() => onModify(i.id)}>Modify</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
