import Link from "next/link";

import { getSupportResources } from "@/lib/api";

export default async function SupportPage() {
  const resources = await getSupportResources();

  return (
    <section className="pt-6 pb-12 px-8" data-testid="support-page">
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
          Knowledge Base & Support
        </h2>
        <p className="text-on-surface-variant text-sm">
          Live support catalog from the API so new runbooks and guides appear automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {resources.categories.map((category) => (
          <article
            key={category.title}
            className="bg-surface-container-low border border-outline-variant/10 p-6 rounded-2xl hover:bg-surface-container transition-all group"
          >
            <div className="w-12 h-12 bg-primary-container rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-on-primary-container">
                {category.icon}
              </span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-4">{category.title}</h3>
            <ul className="space-y-3">
              {category.links.map((resource) => (
                <li key={resource.label}>
                  <Link
                    className="text-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2"
                    href={resource.href}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-outline-variant/50" />
                    {resource.label}
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="bg-secondary-container/20 border border-secondary/20 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h4 className="text-xl font-bold text-on-surface mb-2">Still need help?</h4>
          <p className="text-on-surface-variant text-sm">
            Email: <span className="font-semibold">{resources.contact.email}</span>
          </p>
          <p className="text-on-surface-variant text-sm">
            Chat: <span className="font-semibold">{resources.contact.chat}</span>
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            href="/approvals"
            className="px-6 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container transition-all"
          >
            Open Approvals
          </Link>
          <Link
            href="/incidents"
            className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold glow-primary transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">support_agent</span>
            Open Incident Explorer
          </Link>
        </div>
      </div>
    </section>
  );
}
