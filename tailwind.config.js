/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17212b",
        moss: "#286f5d",
        coral: "#d84c4c",
        paper: "#f7f6f0",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 33, 43, 0.12)",
      },
    },
  },
  plugins: [],
};
