"use client";
import type { FormulaItem } from '@/lib/telemetry/formulas';
export function FormulaTooltip({item}:{item:FormulaItem}){return <div className="rounded-lg border border-white/10 bg-slate-900/80 p-3 text-xs text-white/80"><p className="font-semibold text-white">{item.what}</p><p className="mt-1">Formula: {item.formula}</p><p className="mt-1">Why: {item.whyItMatters}</p></div>;}
