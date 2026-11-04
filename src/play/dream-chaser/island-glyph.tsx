// The small 5 × 3 glyph of the Island Map (docs/design-system-table.md, The Island Map): the fifteen locations as cells with the one a travel row or a staging card names lit, and the marker's cell ringed when it is told.
// Drawn in a travel row of the choice tray; the staging card wears the same mark on the canvas (canvas/pieces.native.tsx, PlaceMarkView). Decoration: the row's words say the place.
import { View } from "react-native";

import { glyphCells, type PlaceMark } from "../store/island-place.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { withAlphaHex } from "../../ui/tokens.ts";

/** The glyph's cell size and gap (logical points at Medium): 5 across, 3 down. */
export const GLYPH = { cell: 6, gap: 1.5 } as const;

export function PlaceGlyph({ mark, surface }: { mark: PlaceMark; surface: "night" | "paper" }) {
  const t = useTableTokens();
  const s = useUiScale();
  const lit = glyphCells(mark);
  const here = mark.from ? glyphCells(mark.from) : null;
  const dim = withAlphaHex(surface === "night" ? t.bone : t.ink, 0.22);
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{ gap: GLYPH.gap * s }}>
      {lit.map((cells, row) => (
        <View key={row} style={{ flexDirection: "row", gap: GLYPH.gap * s }}>
          {cells.map((on, col) => (
            <View
              key={col}
              style={{ width: GLYPH.cell * s, height: GLYPH.cell * s, borderRadius: 1.5 * s, backgroundColor: on ? t.accent : dim, borderWidth: here?.[row]?.[col] ? 1 : 0, borderColor: surface === "night" ? t.bone : t.ink }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
