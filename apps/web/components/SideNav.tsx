"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type NavItem = {
  label: string;
  icon: string;
  href:
    | "/"
    | "/incidents"
    | "/approvals"
    | "/monitoring"
    | "/waste"
    | "/telemetry-value"
    | "/settings"
    | "/support";
};

export function SideNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const navItems: NavItem[] = [
    { label: "Dashboard", icon: "dashboard", href: "/" },
    { label: "Incidents", icon: "error_med", href: "/incidents" },
    { label: "Approvals", icon: "check_circle", href: "/approvals" },
    { label: "Monitoring", icon: "monitoring", href: "/monitoring" },
    { label: "Telemetry Value Impact", icon: "paid", href: "/telemetry-value" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const commands = useMemo(
    () => [
      { label: "Go to Dashboard", hint: "Home", href: "/" as const },
      { label: "Go to Incidents", hint: "Trace explorer", href: "/incidents" as const },
      { label: "Go to Approvals", hint: "Human-in-loop queue", href: "/approvals" as const },
      { label: "Go to Monitoring", hint: "System health", href: "/monitoring" as const },
      { label: "Go to Telemetry Value Impact", hint: "ROI and savings", href: "/telemetry-value" as const },
      { label: "Open Settings", hint: "Runtime control", href: "/settings" as const },
      { label: "Open Support", hint: "Help resources", href: "/support" as const },
    ],
    []
  );

  const filteredCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter(
      (cmd) => cmd.label.toLowerCase().includes(normalized) || cmd.hint.toLowerCase().includes(normalized)
    );
  }, [commands, query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isPaletteShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isPaletteShortcut) {
        event.preventDefault();
        setIsPaletteOpen((open) => !open);
        return;
      }
      if (!isPaletteOpen) return;
      if (event.key === "Escape") {
        setIsPaletteOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((idx) => Math.min(idx + 1, Math.max(filteredCommands.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((idx) => Math.max(idx - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        const selected = filteredCommands[activeIndex];
        if (selected) {
          event.preventDefault();
          router.push(selected.href);
          setIsPaletteOpen(false);
          setQuery("");
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, filteredCommands, isPaletteOpen, router]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, isPaletteOpen]);

  return (
    <>
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
            <button
              type="button"
              onClick={() => setIsPaletteOpen(true)}
              className="w-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant text-xs py-2 px-3 rounded flex items-center justify-between group transition-all"
            >
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

      {isPaletteOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[1px] flex items-start justify-center pt-24"
          onClick={() => setIsPaletteOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-outline-variant/20 bg-surface-container shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-outline-variant/15 px-4 py-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-on-surface-variant text-lg">search</span>
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type a command..."
                className="w-full bg-transparent outline-none text-sm text-on-surface placeholder:text-on-surface-variant"
              />
              <button
                type="button"
                onClick={() => setIsPaletteOpen(false)}
                className="text-xs rounded px-2 py-1 text-on-surface-variant hover:bg-surface-container-high"
              >
                Esc
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {filteredCommands.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-on-surface-variant">
                  No matching commands
                </div>
              ) : (
                filteredCommands.map((command, index) => (
                  <button
                    key={`${command.href}:${command.label}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      router.push(command.href);
                      setIsPaletteOpen(false);
                      setQuery("");
                    }}
                    className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                      activeIndex === index
                        ? "bg-primary/15 text-on-surface"
                        : "text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    <div className="text-sm font-semibold">{command.label}</div>
                    <div className="text-xs opacity-75">{command.hint}</div>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-outline-variant/15 px-4 py-2 text-[11px] text-on-surface-variant flex items-center gap-4">
              <span>↑↓ Navigate</span>
              <span>Enter Select</span>
              <span>Esc Close</span>
              <span>⌘K Toggle</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
