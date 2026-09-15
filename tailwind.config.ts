import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        ink: {
          DEFAULT: "var(--ink)",
          soft: "var(--ink-soft)",
        },
        rule: "var(--rule)",
        state: {
          open: "var(--state-open)",
          hold: "var(--state-hold)",
          break: "var(--state-break)",
          none: "var(--state-none)",
        },
        lcd: {
          bg: "var(--lcd-bg)",
          ink: "var(--lcd-ink)",
        },
        shell: "var(--shell)",
      },
    },
  },
  plugins: [],
};

export default config;
