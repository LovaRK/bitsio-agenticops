"use client";

export function TopBar() {
  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-surface/60 backdrop-blur-xl flex justify-between items-center px-8 w-full border-b border-outline-variant/15 z-40">
      <div className="flex items-center gap-8">
        <div className="text-lg font-bold text-on-surface font-headline">AgenticOps</div>
        <nav className="flex gap-6">
          <a
            className="text-on-surface-variant hover:text-on-surface transition-opacity text-sm font-medium"
            href="#"
          >
            Timeline
          </a>
          <a
            className="text-on-surface-variant hover:text-on-surface transition-opacity text-sm font-medium"
            href="#"
          >
            Logs
          </a>
          <a
            className="text-on-surface-variant hover:text-on-surface transition-opacity text-sm font-medium"
            href="#"
          >
            Traces
          </a>
          <a
            className="text-on-surface-variant hover:text-on-surface transition-opacity text-sm font-medium"
            href="#"
          >
            Metrics
          </a>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 mr-4">
          <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface cursor-pointer">
            notifications
          </span>
          <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface cursor-pointer">
            history_edu
          </span>
        </div>
        <button className="bg-primary-container text-on-primary-container px-4 py-1.5 rounded-xl text-sm font-bold glow-primary transition-all active:scale-95">
          Deploy Fix
        </button>
        <div className="w-8 h-8 rounded-full bg-surface-container overflow-hidden border border-outline-variant/30">
          <img
            alt="User Profile"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDhn0HuwzN8UCY2lmEWKVIHbeVGppY9gOJ_iKxnjiZGLE7fNpG8sZ0GSg9v1KwLGhB4kk_HFxt6c9VIyqCCCAZW6YW0Q-Uv-46VMJBIQUJjoPtRBIoFVW4KFXmhC962Dmb81f_FgKWjcIc2Kfko_JobTeAmwIjJ2DLKlO-RZWtabLy5H8RfjPoERFlVmVy1znwbbA0VQt3Bxj92AoPaITWIJoNUldTrhXPS64lASXiObs1T0idnDuuk-5XnaUUQ6xb2Vx09ovnDoKBp"
          />
        </div>
      </div>
    </header>
  );
}
