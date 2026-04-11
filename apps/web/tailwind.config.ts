import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-variant": "#353534",
        "background": "#131313",
        "on-secondary-container": "#004d44",
        "error-container": "#93000a",
        "on-primary": "#002e69",
        "on-tertiary-fixed-variant": "#920026",
        "inverse-surface": "#e5e2e1",
        "inverse-on-surface": "#313030",
        "on-background": "#e5e2e1",
        "on-tertiary-fixed": "#40000c",
        "on-primary-container": "#f7f7ff",
        "outline-variant": "#424656",
        "on-surface-variant": "#c2c6d8",
        "primary-container": "#006de6",
        "on-error-container": "#ffdad6",
        "surface-tint": "#adc6ff",
        "surface-bright": "#393939",
        "surface-container-highest": "#353534",
        "on-surface": "#e5e2e1",
        "error": "#ffb4ab",
        "surface-container-lowest": "#0e0e0e",
        "surface-container-low": "#1c1b1b",
        "on-tertiary-container": "#fff6f5",
        "surface-container": "#201f1f",
        "tertiary-fixed": "#ffdada",
        "surface-container-high": "#2a2a2a",
        "secondary-fixed": "#62fae3",
        "surface": "#131313",
        "primary-fixed": "#d8e2ff",
        "on-primary-fixed-variant": "#004493",
        "secondary-fixed-dim": "#3cddc7",
        "on-secondary-fixed": "#00201c",
        "tertiary-fixed-dim": "#ffb3b5",
        "on-primary-fixed": "#001a41",
        "inverse-primary": "#005bc1",
        "primary": "#adc6ff",
        "primary-fixed-dim": "#adc6ff",
        "outline": "#8c90a1",
        "on-secondary-fixed-variant": "#005047",
        "tertiary-container": "#e30041",
        "on-tertiary": "#680018",
        "tertiary": "#ffb3b5",
        "on-error": "#690005",
        "secondary-container": "#03c6b2",
        "secondary": "#44e2cd",
        "on-secondary": "#003731",
        "surface-dim": "#131313"
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
