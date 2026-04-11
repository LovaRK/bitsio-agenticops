export default function SettingsPage() {
  const sections = [
    {
      title: "General Configuration",
      items: [
        { label: "Platform Name", value: "BitsIO AgenticOps", icon: "badge" },
        { label: "Deployment Region", value: "us-west-2 (Oregon)", icon: "public" },
        { label: "Default Timezone", value: "UTC (GMT+0)", icon: "schedule" }
      ]
    },
    {
      title: "AI & Reasoning Engine",
      items: [
        { label: "Primary Logic Model", value: "GPT-4o (Reasoning Specialized)", icon: "psychology" },
        { label: "Autonomous Intervention", value: "Enabled", icon: "bolt" },
        { label: "Confidence Threshold", value: "0.85 (High)", icon: "equalizer" }
      ]
    },
    {
      title: "Integrations & API",
      items: [
        { label: "Splunk Observability", value: "Connected", icon: "data_object" },
        { label: "Slack Notifications", value: "Active", icon: "maps_ugc" },
        { label: "Webhook Endpoint", value: "https://api.bitsio.app/webhook/...", icon: "link" }
      ]
    }
  ];

  return (
    <section className="pt-6 pb-12 px-8" data-testid="settings-page">
      <div className="mb-10">
        <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
          Platform Settings
        </h2>
        <p className="text-on-surface-variant text-sm">
          Global configuration for autonomous operations and system preferences.
        </p>
      </div>

      <div className="max-w-4xl space-y-8">
        {sections.map((section) => (
          <div key={section.title} className="bg-surface-container-low border border-outline-variant/10 rounded-xl overflow-hidden">
            <div className="px-6 py-4 bg-surface-container border-b border-outline-variant/10">
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">{section.title}</h3>
            </div>
            <div className="divide-y divide-outline-variant/10">
              {section.items.map((item) => (
                <div key={item.label} className="px-6 py-4 flex items-center justify-between hover:bg-surface-container/20 transition-all group">
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">{item.icon}</span>
                    <span className="text-sm font-medium text-on-surface-variant">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-on-surface">{item.value}</span>
                    <button className="text-[10px] font-black uppercase text-primary tracking-widest hover:underline">Edit</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-4 flex justify-end gap-3">
           <button className="px-6 py-2 rounded-lg text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-all">Discard Changes</button>
           <button className="px-6 py-2 rounded-lg text-sm font-bold bg-primary text-on-primary shadow-lg glow-primary transition-all active:scale-95">Save Configuration</button>
        </div>
      </div>
    </section>
  );
}
