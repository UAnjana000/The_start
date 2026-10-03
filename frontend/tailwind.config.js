/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#182444', // Noticeably lighter, high-visibility executive slate-navy dark mode
        primary: '#93C5FD', // Ultra-luminous light electric blue (Blue 300, maximum PPT contrast)
        secondary: '#67E8F9', // Ultra-bright cyan (Cyan 300)
        healthy: '#4ADE80', // Brighter vibrant emerald (Green 400)
        warning: '#FCD34D', // Light bright amber
        failure: '#FB7185', // Light coral rose
        panel: 'rgba(32, 48, 86, 0.92)', // Lighter, crystal-clear tactical panel
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
