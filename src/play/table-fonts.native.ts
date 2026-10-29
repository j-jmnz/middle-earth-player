// The faces the table canvas draws with (docs/design-system.md, Type): names and small words in Barlow Semi Condensed, numbers in
// Marcellus SC, both embedded; the system face stands in for the moment a font file takes to load. The combat spotlight's three sizes
// of Marcellus SC are loaded here too, once for the table, not once for each attack it plays; they are null while the file loads.
// Every size is Medium's times the UI scale (ui-scale.ts, user request, 2026-10-28), which the canvas root passes in.
import { matchFont, useFont, type SkFont } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { Platform } from "react-native";

import type { Fonts } from "./canvas-pieces.native.tsx";

const MARCELLUS = require("../../assets/fonts/MarcellusSC-Regular.ttf") as number;
const BARLOW = require("../../assets/fonts/BarlowSemiCondensed-SemiBold.ttf") as number;
const BARLOW_BOLD = require("../../assets/fonts/BarlowSemiCondensed-Bold.ttf") as number;

/** The spotlight's faces: the pills' numbers, the damage count in the target's corner, and the small words. */
export type SpotFonts = { pill: SkFont | null; count: SkFont | null; word: SkFont | null };

export function useTableFonts(scale = 1): { fonts: Fonts; spotFonts: SpotFonts } {
  const family = Platform.select({ ios: "Helvetica", default: "sans-serif" });
  const systemNames = useMemo(() => matchFont({ fontFamily: family, fontSize: 11 * scale }), [family, scale]);
  const systemSmall = useMemo(() => matchFont({ fontFamily: family, fontSize: 10 * scale, fontWeight: "bold" }), [family, scale]);
  const systemBadge = useMemo(() => matchFont({ fontFamily: family, fontSize: 11 * scale, fontWeight: "bold" }), [family, scale]);
  const names = useFont(BARLOW, 12 * scale);
  const small = useFont(BARLOW_BOLD, 11 * scale);
  const badge = useFont(BARLOW_BOLD, 12 * scale);
  const marcellus = useFont(MARCELLUS, 12 * scale);
  const pill = useFont(MARCELLUS, 24 * scale);
  const count = useFont(MARCELLUS, 19 * scale);
  const word = useFont(MARCELLUS, 14 * scale);
  const fonts: Fonts = { names: names ?? systemNames, numbers: marcellus ?? systemNames, small: small ?? systemSmall, badge: badge ?? systemBadge };
  return { fonts, spotFonts: { pill, count, word } };
}
