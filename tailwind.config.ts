import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", md: "2rem" }, screens: { "2xl": "1200px" } },
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: { DEFAULT: "hsl(var(--card) / <alpha-value>)", foreground: "hsl(var(--foreground) / <alpha-value>)" },
        primary: { DEFAULT: "hsl(var(--primary) / <alpha-value>)", foreground: "hsl(var(--primary-foreground) / <alpha-value>)" },
        muted: { DEFAULT: "hsl(var(--muted) / <alpha-value>)", foreground: "hsl(var(--muted-foreground) / <alpha-value>)" },
        fern: { DEFAULT: "hsl(var(--primary) / <alpha-value>)", soft: "hsl(var(--fern-soft) / <alpha-value>)", ink: "hsl(var(--fern-ink) / <alpha-value>)" },
        sun: { DEFAULT: "hsl(var(--sun) / <alpha-value>)", soft: "hsl(var(--sun-soft) / <alpha-value>)", ink: "hsl(var(--sun-ink) / <alpha-value>)" },
        rain: { DEFAULT: "hsl(var(--rain) / <alpha-value>)", soft: "hsl(var(--rain-soft) / <alpha-value>)" },
        danger: { DEFAULT: "hsl(var(--danger) / <alpha-value>)", soft: "hsl(var(--danger-soft) / <alpha-value>)" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 4px)", sm: "calc(var(--radius) - 8px)" },
      boxShadow: {
        card: "0 1px 0 hsl(var(--foreground) / 0.04), 0 8px 24px -12px hsl(var(--foreground) / 0.16)",
        lift: "0 2px 0 hsl(var(--foreground) / 0.05), 0 18px 40px -18px hsl(var(--foreground) / 0.28)",
      },
      keyframes: {
        "rise-in": { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        drive: { from: { transform: "translateX(-8%)" }, to: { transform: "translateX(108%)" } },
        "iris-drift": { from: { backgroundPosition: "0% 50%" }, to: { backgroundPosition: "100% 50%" } },
        rain: { from: { transform: "translateY(-20%)", opacity: "0" }, "20%": { opacity: "1" }, to: { transform: "translateY(120%)", opacity: "0" } },
      },
      animation: {
        "rise-in": "rise-in 500ms cubic-bezier(0.22,0.61,0.36,1) both",
        "fade-in": "fade-in 400ms ease both",
        drive: "drive 14s linear infinite",
        rain: "rain 1.6s linear infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
