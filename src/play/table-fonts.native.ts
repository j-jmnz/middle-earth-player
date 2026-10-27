// The faces the table canvas draws with: names and small words in the system face, numbers in the embedded Marcellus (the system face
// stands in for the moment the font file takes to load).
import { matchFont, useFont } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { Platform } from "react-native";

import type { Fonts } from "./canvas-pieces.native.tsx";

const MARCELLUS = require("../../assets/fonts/Marcellus-Regular.ttf") as number;

export function useTableFonts(): Fonts {
  const family = Platform.select({ ios: "Helvetica", default: "sans-serif" });
  const names = useMemo(() => matchFont({ fontFamily: family, fontSize: 11 }), [family]);
  const small = useMemo(() => matchFont({ fontFamily: family, fontSize: 10, fontWeight: "bold" }), [family]);
  const badge = useMemo(() => matchFont({ fontFamily: family, fontSize: 11, fontWeight: "bold" }), [family]);
  const marcellus = useFont(MARCELLUS, 12);
  return { names, numbers: marcellus ?? names, small, badge };
}
