import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { bg: "#07090f", panel: "#0d1220", card: "#111830", line: "#1f2a48", neon: "#4da3ff", violet: "#8b5cf6" },
    fontFamily: { sans: ["Inter", "system-ui", "Segoe UI", "sans-serif"] },
    boxShadow: { glow: "0 0 30px -8px rgba(77,163,255,.45)" },
  } },
  plugins: [],
} satisfies Config;
