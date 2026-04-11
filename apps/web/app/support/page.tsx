export default function SupportPage() {
  const categories = [
    {
      title: "Quick Start Guides",
      icon: "rocket_launch",
      links: ["Initial Setup", "Connecting Splunk", "Configuring AI Agents", "Team Onboarding"]
    },
    {
      title: "Technical Documentation",
      icon: "menu_book",
      links: ["API Reference", "Workflow Schema", "Logic Mapping", "Observability Hooks"]
    },
    {
      title: "Troubleshooting",
      icon: "build",
      links: ["Common Error Codes", "Connection Issues", "Model Hallucinations", "Performance Tuning"]
    }
  ];

  return (
    <section className="pt-6 pb-12 px-8" data-testid="support-page">
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
          Knowledge Base & Support
        </h2>
        <p className="text-on-surface-variant text-sm">
          Everything you need to master autonomous incident operations.
        </p>
        <div className="mt-8 relative max-w-md mx-auto">
           <input 
             type="text" 
             placeholder="Search documentation..." 
             className="w-full bg-surface-container border border-outline-variant/20 rounded-xl px-12 py-3 text-sm text-on-surface focus:outline-none focus:border-primary/50 shadow-xl transition-all"
           />
           <span className="material-symbols-outlined absolute left-4 top-3 text-on-surface-variant">search</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {categories.map((cat) => (
          <div key={cat.title} className="bg-surface-container-low border border-outline-variant/10 p-6 rounded-2xl hover:bg-surface-container transition-all group">
             <div className="w-12 h-12 bg-primary-container rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-on-primary-container">{cat.icon}</span>
             </div>
             <h3 className="text-lg font-bold text-on-surface mb-4">{cat.title}</h3>
             <ul className="space-y-3">
                {cat.links.map(link => (
                  <li key={link}>
                    <button className="text-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-outline-variant/50"></span>
                       {link}
                    </button>
                  </li>
                ))}
             </ul>
          </div>
        ))}
      </div>

      <div className="bg-secondary-container/20 border border-secondary/20 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
         <div>
            <h4 className="text-xl font-bold text-on-surface mb-2">Still need help?</h4>
            <p className="text-on-surface-variant text-sm">Our expert support team is available 24/7 for critical enterprise issues.</p>
         </div>
         <div className="flex gap-4">
            <button className="px-6 py-2.5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container transition-all">
               Visit Discord
            </button>
            <button className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold glow-primary transition-all active:scale-95 flex items-center gap-2">
               <span className="material-symbols-outlined text-sm">mail</span>
               Contact Support
            </button>
         </div>
      </div>
    </section>
  );
}
