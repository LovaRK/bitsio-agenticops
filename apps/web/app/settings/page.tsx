import { getSettingsSnapshot } from "@/lib/api";
import { RuntimeConfigPanel } from "@/components/RuntimeConfigPanel";
import { ModelSettingsPanel } from "@/components/ModelSettingsPanel";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function SettingsPage() {
  const settings = await getSettingsSnapshot();

  const sections = [
    {
      title: "General Configuration",
      items: [
        { label: "Platform Name", value: settings.platform_name, icon: "badge" },
        { label: "Environment", value: settings.environment, icon: "public" },
        { label: "Default Timezone", value: settings.timezone, icon: "schedule" },
      ],
    },
    {
      title: "AI & Reasoning Engine",
      items: [
        { label: "Model Provider", value: settings.model.provider, icon: "psychology" },
        { label: "Model Name", value: settings.model.name, icon: "smart_toy" },
        {
          label: "Runtime",
          value: settings.model.runtime,
          icon: settings.model.runtime === "local" ? "memory" : "cloud",
        },
        { label: "Endpoint", value: settings.model.base_url, icon: "lan" },
        {
          label: "Mock Mode",
          value: settings.model.mock_mode ? "Enabled" : "Disabled",
          icon: "precision_manufacturing",
        },
      ],
    },
    {
      title: "Integrations & Security",
      items: [
        {
          label: "Splunk Status",
          value: settings.splunk.connected ? "Connected" : "Unavailable",
          icon: "data_object",
        },
        { label: "Visible Indexes", value: String(settings.splunk.index_count), icon: "database" },
        {
          label: "Rate Limit / min",
          value: String(settings.security.rate_limit_per_minute),
          icon: "speed",
        },
      ],
    },
  ];

  return (
    <section className="pt-4 pb-10 px-4 sm:px-6 lg:px-8 sm:pt-6 lg:pb-12" data-testid="settings-page">
      <div className="mb-10">
        <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
          Platform Settings
        </h2>
        <p className="text-on-surface-variant text-sm">
          Runtime configuration snapshot from the live API environment.
        </p>
      </div>

      <div className="max-w-4xl space-y-8">
        <article className="bg-surface-container-low border border-outline-variant/10 rounded-xl overflow-hidden">
          <div className="px-6 py-4 bg-surface-container border-b border-outline-variant/10">
            <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">
              Appearance
            </h3>
          </div>
          <div className="p-6">
            <ThemeToggle />
          </div>
        </article>

        <RuntimeConfigPanel settings={settings} />

        <ModelSettingsPanel settings={settings} />

        {sections.map((section) => (
          <article
            key={section.title}
            className="bg-surface-container-low border border-outline-variant/10 rounded-xl overflow-hidden"
          >
            <div className="px-6 py-4 bg-surface-container border-b border-outline-variant/10">
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">
                {section.title}
              </h3>
            </div>
            <div className="divide-y divide-outline-variant/10">
              {section.items.map((item) => (
                <div
                  key={item.label}
                  className="px-6 py-4 flex items-center justify-between hover:bg-surface-container/20 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">
                      {item.icon}
                    </span>
                    <span className="text-sm font-medium text-on-surface-variant">{item.label}</span>
                  </div>
                  <span className="text-sm font-bold text-on-surface">{item.value}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
