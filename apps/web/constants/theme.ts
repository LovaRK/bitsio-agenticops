/**
 * Theme configuration constants.
 * Single source of truth for theme-related values.
 */

export const THEME_KEY = "bitsio-theme" as const;

export type Theme = "light" | "dark";

export const DEFAULT_THEME: Theme = "dark" as const;

/**
 * Get the current theme from localStorage.
 * Returns the saved theme or the default if not set.
 * Safe for server-side execution (returns default if localStorage not available).
 */
export function getSavedTheme(): Theme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // localStorage might be blocked or unavailable
  }

  return DEFAULT_THEME;
}

/**
 * Save theme to localStorage.
 * Only works client-side.
 */
export function saveTheme(theme: Theme): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // localStorage might be blocked or unavailable
  }
}
