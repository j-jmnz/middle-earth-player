const { themeColors } = require("./src/screens/palette.js");

// One rem is 14 points times the UI scale (the root layout sets NativeWind's rem), so type and radii written through this resize with
// the setting and Medium draws the same points as before (user request, 2026-10-28). Write the Medium point value.
const rem = (px) => `${px / 14}rem`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/screens/**/*.{js,jsx,ts,tsx}", "./src/play/**/*.{js,jsx,ts,tsx}", "./src/ui/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // NativeWind's web runtime throws if a scheme is set while this stays "media".
  darkMode: "class",
  theme: {
    extend: {
      // Every color reads a CSS variable the root layout sets per theme (themeVars), so a class paints Dark and Light alike.
      colors: themeColors(),
      fontFamily: {
        // Embedded at build time by the expo-font config plugin (app.json). No runtime load. Carved Stone (docs/design-system.md, Type):
        // Marcellus SC for names, titles, buttons and the numbers the player watches; Barlow Semi Condensed for everything read in a
        // sentence. `Text` (src/ui/text.tsx) gives every text the body face unless it asks for the display one. Marcellus SC has one
        // weight, so it is named by its file; Barlow is one family with 400, 600, 700 and italic, so a weight class picks its file.
        display: ["MarcellusSC-Regular", "Marcellus SC", "serif"],
        body: ["Barlow Semi Condensed", "sans-serif"],
      },
      fontSize: {
        display: [rem(24), { lineHeight: rem(30), letterSpacing: rem(0.5) }],
        title: [rem(19), { lineHeight: rem(24), letterSpacing: rem(0.4) }],
        heading: [rem(17), { lineHeight: rem(22), letterSpacing: rem(0.2) }],
        body: [rem(15), { lineHeight: rem(20) }],
        label: [rem(13), { lineHeight: rem(17) }],
        eyebrow: [rem(11), { lineHeight: rem(16), letterSpacing: rem(2.6) }],
        micro: [rem(11), { lineHeight: rem(14), letterSpacing: rem(0.4) }],
      },
      // Four radii (docs/design-system.md, Spacing, radius, border; src/ui/radius.ts holds the same numbers for a style written by hand): a
      // control is a capsule, an item inside a container 12, a floating container 20, the top of a parchment sheet 24.
      borderRadius: {
        control: "999px",
        item: rem(12),
        container: rem(20),
        sheet: rem(24),
      },
      // A hit floor that does not scale: 44 points at every size (user request, 2026-10-28). Use min-h-touch / min-w-touch, not min-h-11.
      minHeight: { touch: "44px" },
      minWidth: { touch: "44px" },
    },
  },
  plugins: [],
};
