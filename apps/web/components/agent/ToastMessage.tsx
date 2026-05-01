"use client";

export function ToastMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[70] rounded-lg border border-white/20 bg-slate-950/95 px-4 py-2 text-sm text-white shadow-lg">
      {message}
    </div>
  );
}
