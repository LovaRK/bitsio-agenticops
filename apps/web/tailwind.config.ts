import type { Config } from "tailwindcss";

const colorVar = (token: string) => `rgb(var(--${token}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-variant": colorVar("surface-variant"),
        "background": colorVar("background"),
        "on-secondary-container": colorVar("on-secondary-container"),
        "error-container": colorVar("error-container"),
        "on-primary": colorVar("on-primary"),
        "on-tertiary-fixed-variant": colorVar("on-tertiary-fixed-variant"),
        "inverse-surface": colorVar("inverse-surface"),
        "inverse-on-surface": colorVar("inverse-on-surface"),
        "on-background": colorVar("on-background"),
        "on-tertiary-fixed": colorVar("on-tertiary-fixed"),
        "on-primary-container": colorVar("on-primary-container"),
        "outline-variant": colorVar("outline-variant"),
        "on-surface-variant": colorVar("on-surface-variant"),
        "primary-container": colorVar("primary-container"),
        "on-error-container": colorVar("on-error-container"),
        "surface-tint": colorVar("surface-tint"),
        "surface-bright": colorVar("surface-bright"),
        "surface-container-highest": colorVar("surface-container-highest"),
        "on-surface": colorVar("on-surface"),
        "error": colorVar("error"),
        "surface-container-lowest": colorVar("surface-container-lowest"),
        "surface-container-low": colorVar("surface-container-low"),
        "on-tertiary-container": colorVar("on-tertiary-container"),
        "surface-container": colorVar("surface-container"),
        "tertiary-fixed": colorVar("tertiary-fixed"),
        "surface-container-high": colorVar("surface-container-high"),
        "secondary-fixed": colorVar("secondary-fixed"),
        "surface": colorVar("surface"),
        "primary-fixed": colorVar("primary-fixed"),
        "on-primary-fixed-variant": colorVar("on-primary-fixed-variant"),
        "secondary-fixed-dim": colorVar("secondary-fixed-dim"),
        "on-secondary-fixed": colorVar("on-secondary-fixed"),
        "tertiary-fixed-dim": colorVar("tertiary-fixed-dim"),
        "on-primary-fixed": colorVar("on-primary-fixed"),
        "inverse-primary": colorVar("inverse-primary"),
        "primary": colorVar("primary"),
        "primary-fixed-dim": colorVar("primary-fixed-dim"),
        "outline": colorVar("outline"),
        "on-secondary-fixed-variant": colorVar("on-secondary-fixed-variant"),
        "tertiary-container": colorVar("tertiary-container"),
        "on-tertiary": colorVar("on-tertiary"),
        "tertiary": colorVar("tertiary"),
        "on-error": colorVar("on-error"),
        "secondary-container": colorVar("secondary-container"),
        "secondary": colorVar("secondary"),
        "on-secondary": colorVar("on-secondary"),
        "surface-dim": colorVar("surface-dim"),
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem"
      },
      fontFamily: {
        headline: ["var(--font-space-grotesk)"],
        body: ["var(--font-inter)"],
        label: ["var(--font-inter)"]
      }
    }
  },
  plugins: []
};

export default config;
