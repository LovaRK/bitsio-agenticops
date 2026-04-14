"use client";

import { useEffect, useState } from "react";
import { THEME_KEY, DEFAULT_THEME, getSavedTheme, saveTheme, type Theme } from "@/constants/theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const nextTheme = getSavedTheme();
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    saveTheme(nextTheme);
  };

  if (compact) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={toggleTheme}
        className="rounded-lg p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
      >
        <span className="material-symbols-outlined">{theme === "dark" ? "light_mode" : "dark_mode"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
    >
      <span className="inline-flex items-center gap-2">
        <span className="material-symbols-outlined text-sm">
          {theme === "dark" ? "light_mode" : "dark_mode"}
        </span>
        Switch to {theme === "dark" ? "Light" : "Dark"} Mode
      </span>
    </button>
  );
}
