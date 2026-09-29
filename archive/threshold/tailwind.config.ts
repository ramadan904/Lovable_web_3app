import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.5rem", md: "2.5rem" },
      screens: { "2xl": "1240px" },
    },
    extend: {
      fontFamily: {
        serif: ['"Instrument Serif"', '"Cormorant Garamond"', "Georgia", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        // Threshold's own vocabulary
        charcoal: {
          950: "hsl(var(--charcoal-950) / <alpha-value>)",
          900: "hsl(var(--charcoal-900) / <alpha-value>)",
          850: "hsl(var(--charcoal-850) / <alpha-value>)",
          800: "hsl(var(--charcoal-800) / <alpha-value>)",
          700: "hsl(var(--charcoal-700) / <alpha-value>)",
        },
        bone: {
          DEFAULT: "hsl(var(--bone) / <alpha-value>)",
          dim: "hsl(var(--bone-dim) / <alpha-value>)",
          faint: "hsl(var(--bone-faint) / <alpha-value>)",
          ghost: "hsl(var(--bone-ghost) / <alpha-value>)",
        },
        copper: {
          DEFAULT: "hsl(var(--copper) / <alpha-value>)",
          bright: "hsl(var(--copper-bright) / <alpha-value>)",
          deep: "hsl(var(--copper-deep) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      letterSpacing: {
        ritual: "0.22em",
      },
      transitionTimingFunction: {
        quiet: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
      transitionDuration: {
        slow: "700ms",
        ritual: "1200ms",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "draw-line": {
          from: { transform: "scaleX(0)", opacity: "0" },
          "30%": { opacity: "1" },
          to: { transform: "scaleX(1)", opacity: "1" },
        },
        "draw-path": {
          from: { strokeDashoffset: "1" },
          to: { strokeDashoffset: "0" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.9" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 700ms cubic-bezier(0.22,0.61,0.36,1) both",
        "rise-in": "rise-in 700ms cubic-bezier(0.22,0.61,0.36,1) both",
        "draw-line": "draw-line 2400ms cubic-bezier(0.22,0.61,0.36,1) both",
        breathe: "breathe 5s ease-in-out infinite",
        shimmer: "shimmer 2.8s linear infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
