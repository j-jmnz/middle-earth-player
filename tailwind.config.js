const { palette } = require("./src/screens/palette.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/screens/**/*.{js,jsx,ts,tsx}", "./src/play/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // NativeWind's web runtime throws if a scheme is set while this stays "media".
  darkMode: "class",
  theme: {
    extend: {
      colors: palette,
      fontFamily: {
        // Embedded at build time by the expo-font config plugin (app.json). No runtime load.
        display: ["Marcellus-Regular", "Marcellus", "serif"],
      },
      fontSize: {
        display: ["34px", { lineHeight: "40px" }],
        title: ["24px", { lineHeight: "30px" }],
        body: ["17px", { lineHeight: "24px" }],
        label: ["13px", { lineHeight: "18px" }],
        eyebrow: ["12px", { lineHeight: "16px", letterSpacing: "2.4px" }],
      },
      borderRadius: {
        tile: "12px",
        card: "20px",
        sheet: "28px",
        pill: "999px",
      },
    },
  },
  plugins: [],
};
