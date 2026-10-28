const { themeColors } = require("./src/screens/palette.js");

// One rem is 14 points times the UI scale (the root layout sets NativeWind's rem), so type and radii written through this resize with
// the setting and Medium draws the same points as before (user request, 2026-10-28). Write the Medium point value.
const rem = (px) => `${px / 14}rem`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/screens/**/*.{js,jsx,ts,tsx}", "./src/play/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // NativeWind's web runtime throws if a scheme is set while this stays "media".
  darkMode: "class",
  theme: {
    extend: {
      // Every color reads a CSS variable the root layout sets per theme (themeVars), so a class paints Dark and Light alike.
      colors: themeColors(),
      fontFamily: {
        // Embedded at build time by the expo-font config plugin (app.json). No runtime load. Cinzel's lower case is small capitals,
        // so a name reads as engraved capitals: titles and names in SemiBold, buttons, tags and the numbers the player watches in Bold.
        display: ["Cinzel-SemiBold", "Cinzel", "serif"],
        "display-bold": ["Cinzel-Bold", "Cinzel", "serif"],
      },
      fontSize: {
        display: [rem(24), { lineHeight: rem(30), letterSpacing: rem(0.6) }],
        title: [rem(19), { lineHeight: rem(24), letterSpacing: rem(0.4) }],
        heading: [rem(14), { lineHeight: rem(20), letterSpacing: rem(0.3) }],
        body: [rem(15), { lineHeight: rem(21) }],
        label: [rem(13), { lineHeight: rem(18) }],
        eyebrow: [rem(11), { lineHeight: rem(16), letterSpacing: rem(2) }],
        micro: [rem(11), { lineHeight: rem(14), letterSpacing: rem(0.6) }],
      },
      borderRadius: {
        chip: rem(8),
        tile: rem(12),
        button: rem(14),
        card: rem(16),
        hero: rem(20),
        sheet: rem(28),
        pill: "999px",
      },
      // A hit floor that does not scale: 44 points at every size (user request, 2026-10-28). Use min-h-touch / min-w-touch, not min-h-11.
      minHeight: { touch: "44px" },
      minWidth: { touch: "44px" },
    },
  },
  plugins: [],
};
