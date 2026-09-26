/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#050A12',
        primary: '#0052FF',
        secondary: '#00E5FF',
        healthy: '#00E676',
        warning: '#FFC400',
        failure: '#FF1744',
        panel: 'rgba(10, 15, 30, 0.7)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
