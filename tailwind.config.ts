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
        background: "#F3EFEC",
        surface: "#FAF9F7",
        primary: "#C96442",
        textMain: "#24211D",
        textMuted: "#7A7570",
        borderInner: "#E8E5E0",
        borderOuter: "#D4D0CA",
        accent: "#C96442",
        success: "#2F593F",
        error: "#8C2F2B",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        serif: ["var(--font-serif)", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
      },
      animation: {
        "slide-up": "slide-up 0.4s ease-out forwards",
        "fade-in": "fade-in 0.5s ease-out forwards",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "progress": "progress 1.5s ease-in-out infinite",
        "spin": "spin 1s linear infinite",
      },
      keyframes: {
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "pulse-soft": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: ".6" },
        },
        "progress": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(400%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;