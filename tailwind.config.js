/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Both palettes are variable-driven so the dark/light toggle flips
        // every panel and every piece of text, not just the page background.
        surface: {
          950: "rgb(var(--s-950) / <alpha-value>)",
          900: "rgb(var(--s-900) / <alpha-value>)",
          850: "rgb(var(--s-850) / <alpha-value>)",
          800: "rgb(var(--s-800) / <alpha-value>)",
          700: "rgb(var(--s-700) / <alpha-value>)",
          600: "rgb(var(--s-600) / <alpha-value>)",
        },
        zinc: {
          100: "rgb(var(--t-100) / <alpha-value>)",
          200: "rgb(var(--t-200) / <alpha-value>)",
          300: "rgb(var(--t-300) / <alpha-value>)",
          400: "rgb(var(--t-400) / <alpha-value>)",
          500: "rgb(var(--t-500) / <alpha-value>)",
          600: "rgb(var(--t-600) / <alpha-value>)",
          700: "rgb(var(--t-700) / <alpha-value>)",
          800: "rgb(var(--t-800) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "#3b82f6",
          soft: "#60a5fa",
        },
        cube: {
          yellow: "#f5d020",
          blue: "#1668d6",
          red: "#d92b1f",
          orange: "#ee7a17",
          green: "#17a94a",
          white: "#f2f2f2",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "ui-monospace", "monospace"],
      },
      keyframes: {
        "fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
        "pop-in": {
          from: { opacity: 0, transform: "scale(.96) translateY(8px)" },
          to: { opacity: 1, transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in .15s ease-out",
        "pop-in": "pop-in .18s cubic-bezier(.22,1,.36,1)",
      },
    },
  },
  plugins: [],
};
