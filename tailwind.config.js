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
        primary: "#0d6efd",
        success: "#198754",
        danger: "#dc3545",
        warning: "#ffc107",
        info: "#0dcaf0",
      }
    },
  },
  plugins: [],
}
