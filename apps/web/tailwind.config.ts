import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#10151d",
        panel2: "#151c27",
        line: "#273244",
        accent: "#38bdf8",
        danger: "#ef4444",
        warn: "#f59e0b"
      }
    }
  },
  plugins: []
};

export default config;
