import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#26213a",
        lavender: {
          50: "#fbfaff",
          100: "#f5f1ff",
          200: "#e8e0ff",
          300: "#d5c7ff",
          400: "#b8a2f5",
          500: "#9273e6",
          600: "#7354c7",
          700: "#5c40a8",
        },
        blush: {
          50: "#fff8fa",
          100: "#ffedf2",
          200: "#ffd9e4",
        },
      },
      boxShadow: {
        card: "0 12px 35px rgba(74, 52, 117, 0.07)",
        soft: "0 4px 18px rgba(74, 52, 117, 0.08)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [forms],
};

export default config;
