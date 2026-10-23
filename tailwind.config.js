/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/screens/**/*.{js,jsx,ts,tsx}", "./src/play/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // NativeWind's web runtime throws if a scheme is set while this stays "media".
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};
