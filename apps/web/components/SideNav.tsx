"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  icon: string;
  href: "/" | "/incidents" | "/approvals" | "/monitoring" | "/settings" | "/support";
};

export function SideNav() {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { label: "Dashboard", icon: "dashboard", href: "/" },
    { label: "Incidents", icon: "error_med", href: "/incidents" },
    { label: "Approvals", icon: "check_circle", href: "/approvals" },
    { label: "Monitoring", icon: "monitoring", href: "/monitoring" }
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 border-r border-outline-variant/15 bg-surface-container-lowest flex flex-col py-6 px-4 z-50">
      <div className="mb-10 px-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-container flex items-center justify-center rounded-lg">
            <span className="material-symbols-outlined text-on-primary-container text-sm">
              robot_2
            </span>
          </div>
          <div>
            <h1 className="text-xl font-black text-on-surface uppercase tracking-widest font-headline">
              BitsIO
            </h1>
            <span className="text-[10px] text-primary tracking-tighter opacity-70 block">
              AgenticOps
            </span>
          </div>
        </div>
      </div>

      <nav className="space-y-1 flex-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 ${
              isActive(item.href)
                ? "text-on-surface bg-surface-container-high border-l-4 border-primary"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            <span className="font-headline font-bold tracking-tight">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-1">
        <div className="px-3 py-4 mb-4">
          <button className="w-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant text-xs py-2 px-3 rounded flex items-center justify-between group transition-all">
            <span>Command Palette</span>
            <span className="text-[10px] bg-surface-container-highest px-1.5 py-0.5 rounded opacity-50">
              ⌘K
            </span>
          </button>
        </div>
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors duration-200"
        >
          <span className="material-symbols-outlined text-xl">settings</span>
          <span className="font-headline font-bold tracking-tight">Settings</span>
        </Link>
        <Link
          href="/support"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors duration-200"
        >
          <span className="material-symbols-outlined text-xl">help</span>
          <span className="font-headline font-bold tracking-tight">Support</span>
        </Link>
      </div>
    </aside>
  );
}
