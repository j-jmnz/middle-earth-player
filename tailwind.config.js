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
      fontSize: {
        display: ["36px", { lineHeight: "44px" }],
        title: ["28px", { lineHeight: "36px" }],
        body: ["24px", { lineHeight: "32px" }],
        label: ["18px", { lineHeight: "24px" }],
      },
      borderRadius: {
        control: "8px",
        sheet: "12px",
      },
    },
  },
  plugins: [],
};
