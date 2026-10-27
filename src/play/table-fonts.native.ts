// The faces the table canvas draws with: names and small words in the system face, numbers in the embedded Cinzel Bold (the system
// face stands in for the moment the font file takes to load). The combat spotlight's three sizes of Cinzel are loaded here too, once
// for the table, not once for each attack it plays; they are null while the file loads.
import { matchFont, useFont, type SkFont } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { Platform } from "react-native";

import type { Fonts } from "./canvas-pieces.native.tsx";

const CINZEL = require("../../assets/fonts/Cinzel-Bold.ttf") as number;

/** The spotlight's faces: the pills' numbers, the damage count in the target's corner, and the small words. */
export type SpotFonts = { pill: SkFont | null; count: SkFont | null; word: SkFont | null };

export function useTableFonts(): { fonts: Fonts; spotFonts: SpotFonts } {
  const family = Platform.select({ ios: "Helvetica", default: "sans-serif" });
  const names = useMemo(() => matchFont({ fontFamily: family, fontSize: 11 }), [family]);
  const small = useMemo(() => matchFont({ fontFamily: family, fontSize: 10, fontWeight: "bold" }), [family]);
  const badge = useMemo(() => matchFont({ fontFamily: family, fontSize: 11, fontWeight: "bold" }), [family]);
  const cinzel = useFont(CINZEL, 12);
  const pill = useFont(CINZEL, 24);
  const count = useFont(CINZEL, 19);
  const word = useFont(CINZEL, 14);
  const fonts: Fonts = { names, numbers: cinzel ?? names, small, badge };
  return { fonts, spotFonts: { pill, count, word } };
}
