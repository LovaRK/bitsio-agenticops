"use client";
import { FORMULAS } from '@/lib/telemetry/formulas';
export function FormulaCatalog(){return <section className="rounded-xl border border-white/10 bg-white/5 p-4"><h3 className="text-sm font-semibold text-white">Formula Catalog</h3><div className="mt-2 space-y-2">{FORMULAS.map(f=><div key={f.key} className="rounded-lg border border-white/10 bg-slate-900/40 p-2"><p className="text-xs text-white/60">{f.what}</p><p className="text-sm text-white">{f.formula}</p></div>)}</div></section>;}
