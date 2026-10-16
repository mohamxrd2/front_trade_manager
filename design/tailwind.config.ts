// Waelly — configuration Tailwind (Tailwind v3).
// Si le projet utilise Tailwind v4 (pas de tailwind.config, `@import "tailwindcss"` dans le CSS),
// utilisez plutôt waelly-theme.css qui contient le même thème au format @theme.
import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  darkMode: "class", // compatible next-themes (attribute="class")
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-jakarta)", "Plus Jakarta Sans", "Helvetica Neue", "sans-serif"],
      },
      colors: {
        canvas: { DEFAULT: "#F3F3F7", desktop: "#F1F2F7" },
        surface: { DEFAULT: "#FFFFFF", soft: "#F6F5FB" },
        ink: { DEFAULT: "#0E0E1A", 2: "#3F3F50", 3: "#4B4B5C" },
        subtle: "#6B6B7B", // texte gris → text-subtle (≠ muted de shadcn, qui est un fond)
        line: { DEFAULT: "#ECECF2", strong: "#E2E2EA", divider: "#F0F0F4" },
        brand: {
          50: "#F4F1FF",
          100: "#EEEAFE",
          200: "#C9BDFB",
          300: "#A58CFF",
          400: "#6A4CF0",
          500: "#5B3FE6",
          600: "#4B2FD6",
          700: "#3A20B8",
          glow: "#8C74FF",
          deep: "#3420B8",
          DEFAULT: "#5B3FE6",
        },
        navy: { 400: "#3A3AF0", 600: "#1717A0", 800: "#0A0A4A", 950: "#06062A", text: "#C8C8F0", "text-2": "#DCDCF7" },
        success: { DEFAULT: "#0B8A43", strong: "#0B6B39", bg: "#E3F5EA" },
        danger: { DEFAULT: "#D92D20", strong: "#A3213A", bg: "#FDE8EC", dot: "#E5484D", border: "#F3C7CF" },
        warning: { DEFAULT: "#8A4B00", bg: "#FFF0E0" },
        info: { DEFAULT: "#1F3FB8", bg: "#E6EEFF" },
        neutral: { DEFAULT: "#3F3F50", bg: "#EDEDF2" },
        chart: { 1: "#2A1A9E", 2: "#6A4CF0", 3: "#A58CFF", 4: "#DCD4FF", line: "#5B3FE6", grid: "#ECECF2" },
      },
      borderRadius: {
        field: "14px",
        tile: "18px",
        card: "22px",
        panel: "26px",
        hero: "28px",
        nav: "36px",
      },
      boxShadow: {
        card: "0 4px 18px rgba(17,17,80,0.05)",
        hero: "0 18px 40px rgba(16,16,120,0.28)",
        button: "0 8px 20px rgba(75,47,214,0.35)",
        float: "0 14px 34px rgba(17,17,80,0.18), 0 2px 6px rgba(17,17,80,0.08)",
        seg: "0 2px 6px rgba(17,17,80,0.1)",
      },
      backgroundImage: {
        hero: "radial-gradient(120% 90% at 100% 100%, #3A3AF0 0%, #1717A0 35%, #0A0A4A 70%, #06062A 100%)",
        button: "radial-gradient(100% 140% at 20% 0%, #8C74FF 0%, #5B3FE6 50%, #3420B8 100%)",
        orb: "radial-gradient(100% 100% at 30% 20%, #8C74FF, #3420B8)",
        violet: "linear-gradient(160deg, #5B3FE6 0%, #7A5CF5 55%, #C8B8FF 100%)",
        "desktop-halos":
          "radial-gradient(700px 480px at 0% 0%, rgba(106,76,240,0.22), rgba(106,76,240,0) 70%), radial-gradient(800px 560px at 100% 10%, rgba(58,58,240,0.14), rgba(58,58,240,0) 70%)",
      },
      fontSize: {
        caption: ["12px", { lineHeight: "1.4" }],
        label: ["13px", { lineHeight: "1.4", fontWeight: "600" }],
        kpi: ["28px", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
        page: ["28px", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
        hero: ["46px", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "700" }],
      },
      spacing: { "nav-safe": "112px" },
    },
  },
  plugins: [
    plugin(({ addComponents }) => {
      addComponents({
        ".glass": {
          background: "linear-gradient(180deg, rgba(255,255,255,0.66), rgba(255,255,255,0.36))",
          backdropFilter: "blur(22px) saturate(180%)",
          WebkitBackdropFilter: "blur(22px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.8)",
          boxShadow:
            "inset 0 1px 1px rgba(255,255,255,0.95), inset 0 -1px 1px rgba(255,255,255,0.35), 0 14px 34px rgba(17,17,80,0.18), 0 2px 6px rgba(17,17,80,0.08)",
        },
        ".glass-panel": {
          background: "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.44))",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.88)",
          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95), 0 20px 50px rgba(17,17,80,0.10)",
        },
        ".glass-active": {
          color: "#3A20B8",
          fontWeight: "700",
          background: "linear-gradient(180deg, rgba(106,76,240,0.20), rgba(106,76,240,0.08))",
          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.9), inset 0 0 0 1px rgba(106,76,240,0.16)",
        },
      });
    }),
  ],
};

export default config;
