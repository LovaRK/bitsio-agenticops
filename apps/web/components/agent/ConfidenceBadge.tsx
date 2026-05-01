"use client";
export function ConfidenceBadge({value}:{value:number}){return <span className="inline-flex rounded-full border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-200">Confidence {Math.round(value*100)}%</span>;}
