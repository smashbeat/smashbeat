import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0B0D12",
          50: "#F7F8FA",
          100: "#EEF0F4",
          200: "#DDE1E8",
          300: "#B9C0CC",
          400: "#8A93A3",
          500: "#5C6577",
          600: "#3E4654",
          700: "#272D38",
          800: "#161A21",
          900: "#0B0D12",
        },
        brand: {
          50: "#EEF1FF",
          100: "#DAE0FF",
          200: "#B7C2FF",
          300: "#8C9CFC",
          400: "#6677F5",
          500: "#4253E8",
          600: "#3140CC",
          700: "#2733A3",
          800: "#1F2980",
          900: "#161D5C",
        },
        success: "#1F9D55",
        warning: "#D97706",
        danger: "#DC2626",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,13,18,0.04), 0 1px 1px rgba(11,13,18,0.03)",
        pop: "0 8px 24px rgba(11,13,18,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
