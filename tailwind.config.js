/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  corePlugins: {
    preflight: false,
    visibility: false
  },
  theme: {
    extend: {
      colors: {
        primary: "#66FCF1",
        secondary: "#45A29E",
        brandbg: "#0B0C10",
        brandsurface: "#1F2833",
        brandtext: "#C5C6C7",
        success: "#22c55e",
        danger: "#ef4444",
        warning: "#f59e0b",
        info: "#46dff7",
      }
    },
  },
  plugins: [],
}
