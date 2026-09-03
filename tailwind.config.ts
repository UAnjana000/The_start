import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          bg: "#f8fafc",          // Stark slate-50 background (Palantir Light)
          surface: "#ffffff",     // Clean white surface
          panel: "#f1f5f9",       // Subtle slate-100 panel
          border: "#cbd5e1",      // 1px flat slate-300 border
          borderLight: "#e2e8f0", // 1px flat slate-200 border
          textMuted: "#64748b",   // Muted grey text
          textLight: "#334155",   // Dark slate body text
          textBright: "#0f172a",  // Jet black headers
          cyan: "#0284c7",        // Institutional Cobalt/Cyan
          amber: "#d97706",       // Stark Amber
          crimson: "#dc2626",     // Stark Crimson
          green: "#16a34a",       // Crisp Green
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
        sans: ['Inter', 'Roboto', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
export default config;
