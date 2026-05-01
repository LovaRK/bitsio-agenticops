"use client";
import type { SecurityFinding } from '@/types/telemetry';
export function RiskAndDetectionPanel({findings}:{findings:SecurityFinding[]}){return <section className="rounded-xl border border-white/10 bg-white/5 p-4"><h3 className="text-sm font-semibold text-white">Risk and Detection Panel</h3><p className="mt-2 text-sm text-white/70">Some telemetry sources are collected but not mapped to detection logic. This creates blind spots.</p><p className="mt-2 text-sm text-white/80">Findings: {findings.length}</p></section>;}
