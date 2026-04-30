/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      colors: {
        sand: "#efe1cf",
        ember: "#b94d23",
        ink: "#1c1713",
        moss: "#6e7d58",
        dusk: "#52463c"
      },
      boxShadow: {
        float: "0 24px 80px rgba(34, 25, 18, 0.12)"
      },
      borderRadius: {
        panel: "28px"
      }
    }
  },
  plugins: []
}
