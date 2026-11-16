// The faces the table canvas draws with (docs/design-system.md, Type): names and small words in Barlow Semi Condensed, numbers in
// Marcellus SC (Barlow semibold under the Title face setting's Plain), both embedded; the system face stands in for the moment a font file takes to load. The combat spotlight's faces
// (`useSpotFonts`) are loaded once by its layer, not once for each attack it plays; they are null while the file loads. Every file and size is loaded
// once for the app and shared by the canvas, its token layer and the spotlight's layer (table-assets.native.ts).
// Every size is Medium's times the UI scale (ui-scale.ts, user request, 2026-10-28), which the canvas root passes in.
import { matchFont, Skia, type SkFont } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { Platform } from "react-native";

import type { Fonts } from "./pieces.native.tsx";
import { SPOT } from "../spotlight/shape.ts";
import { useSharedFont } from "./table-assets.native.ts";

export const MARCELLUS = require("../../../assets/fonts/MarcellusSC-Regular.ttf") as number;
const BARLOW = require("../../../assets/fonts/BarlowSemiCondensed-SemiBold.ttf") as number;
const BARLOW_BOLD = require("../../../assets/fonts/BarlowSemiCondensed-Bold.ttf") as number;

/**
 * The spotlight's faces: the medallions' numbers, the damage count in the target's corner, the small words, the damage number
 * (Marcellus SC 64), the stamps (Marcellus SC 34) and the note chip (Barlow Bold 15).
 */
export type SpotFonts = { pill: SkFont | null; count: SkFont | null; word: SkFont | null; number: SkFont | null; stamp: SkFont | null; note: SkFont | null };

/** The title file: Marcellus SC, or Barlow semibold under the Title face setting's Plain (display-prefs.ts). */
export const titleFile = (plain: boolean): number => (plain ? BARLOW : MARCELLUS);

/** The spotlight's faces at a UI scale; each is null while its file loads. `plain` draws the numbers and stamps in Barlow semibold. */
export function useSpotFonts(scale = 1, plain = false): SpotFonts {
  const title = titleFile(plain);
  const pill = useSharedFont(title, 24 * scale);
  const count = useSharedFont(title, 19 * scale);
  const word = useSharedFont(title, 14 * scale);
  const number = useSharedFont(title, SPOT.numberSize * scale);
  const stamp = useSharedFont(title, SPOT.stampSize * scale);
  const note = useSharedFont(BARLOW_BOLD, SPOT.noteSize * scale);
  return useMemo(() => ({ pill, count, word, number, stamp, note }), [pill, count, word, number, stamp, note]);
}

// The face drawn while a file loads: the phone's system face. CanvasKit has no system font manager (matchFamilyStyle is not implemented on the web),
// so the web has none: a font with no typeface draws no text until the bundled files load.
function systemFont(family: string, fontSize: number, bold: boolean): SkFont {
  if (Platform.OS === "web") return Skia.Font(undefined, fontSize);
  return bold ? matchFont({ fontFamily: family, fontSize, fontWeight: "bold" }) : matchFont({ fontFamily: family, fontSize });
}

export function useTableFonts(scale = 1, plain = false): Fonts {
  const family = Platform.select({ ios: "Helvetica", default: "sans-serif" });
  const systemNames = useMemo(() => systemFont(family, 11 * scale, false), [family, scale]);
  const systemSmall = useMemo(() => systemFont(family, 10 * scale, true), [family, scale]);
  const systemBadge = useMemo(() => systemFont(family, 11 * scale, true), [family, scale]);
  const names = useSharedFont(BARLOW, 12 * scale);
  const small = useSharedFont(BARLOW_BOLD, 11 * scale);
  const badge = useSharedFont(BARLOW_BOLD, 12 * scale);
  const marcellus = useSharedFont(titleFile(plain), 12 * scale);
  return { names: names ?? systemNames, numbers: marcellus ?? systemNames, small: small ?? systemSmall, badge: badge ?? systemBadge };
}
