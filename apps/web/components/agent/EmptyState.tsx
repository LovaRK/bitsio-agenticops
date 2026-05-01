"use client";
export function EmptyState({title,body}:{title:string;body:string}){return <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-white/70"><p className="font-semibold text-white">{title}</p><p className="mt-1">{body}</p></div>;}
