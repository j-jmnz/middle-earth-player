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
        // Embedded at build time by the expo-font config plugin (app.json). No runtime load. Cinzel's lower case is small capitals,
        // so a name reads as engraved capitals: titles and names in SemiBold, buttons, tags and the numbers the player watches in Bold.
        display: ["Cinzel-SemiBold", "Cinzel", "serif"],
        "display-bold": ["Cinzel-Bold", "Cinzel", "serif"],
      },
      fontSize: {
        display: ["28px", { lineHeight: "34px", letterSpacing: "0.6px" }],
        title: ["22px", { lineHeight: "28px", letterSpacing: "0.4px" }],
        heading: ["15px", { lineHeight: "22px", letterSpacing: "0.3px" }],
        body: ["17px", { lineHeight: "24px" }],
        label: ["13px", { lineHeight: "18px" }],
        eyebrow: ["11px", { lineHeight: "16px", letterSpacing: "2px" }],
        micro: ["11px", { lineHeight: "14px", letterSpacing: "0.6px" }],
      },
      borderRadius: {
        chip: "8px",
        tile: "12px",
        button: "14px",
        card: "16px",
        hero: "20px",
        sheet: "28px",
        pill: "999px",
      },
    },
  },
  plugins: [],
};
