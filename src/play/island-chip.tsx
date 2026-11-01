// The Island Map's chip in the table's top bar (docs/design-system-table.md, The Island Map): a 5 × 3 grid of small cells with the Temple column at the right as printed, inside one 44 pt target. A cell shows its
// state: covered (faint), explored (bone), next to the active location (a bone ring), active (accent fill, where the marker stands). A tap opens the map panel (island-panel.tsx); the chip sends nothing.
import { Pressable, View } from "react-native";

import { CHIP, COLS, ROWS, chipWords, type IslandCell, type IslandReadout } from "./island-table.ts";
import { touch, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { withAlphaHex, type TableTokens } from "./tokens.ts";
import { Text } from "./text.tsx";

/** The fill and the ring of a cell by its state, from the table's tokens. */
export function cellLook(cell: Pick<IslandCell, "state" | "next" | "temple">, t: TableTokens): { fill: string; ring: string | null; edge: string | null } {
  const fill = cell.state === "active" ? t.accent : cell.state === "explored" ? withAlphaHex(t.bone, 0.62) : withAlphaHex(t.bone, 0.16);
  const ring = cell.next ? t.bone : null;
  const edge = cell.temple && cell.state === "covered" ? t.fellowship : null;
  return { fill, ring, edge };
}

export function IslandChip({ readout, onPress }: { readout: IslandReadout; onPress: () => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  const cell = CHIP.cell * s;
  const gap = CHIP.gap * s;
  const pad = CHIP.pad * s;
  const width = COLS * cell + (COLS - 1) * gap + 2 * pad;
  const height = ROWS * cell + (ROWS - 1) * gap + 2 * pad;
  return (
    <Pressable
      testID="island-map-chip"
      accessibilityRole="button"
      accessibilityLabel={chipWords(readout)}
      accessibilityHint="Opens the Island Map"
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: touch(s, 44), flexDirection: "row", alignItems: "center", gap: 6 * s, paddingHorizontal: 4 * s, borderRadius: 999, backgroundColor: pressed ? withAlphaHex(t.bone, 0.12) : "transparent" })}
    >
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={{ width, height, padding: pad, gap }}>
        {Array.from({ length: ROWS }, (_, row) => (
          <View key={row} style={{ flexDirection: "row", gap }}>
            {Array.from({ length: COLS }, (_, col) => {
              const found = readout.cells[row * COLS + col];
              const look = found ? cellLook(found, t) : { fill: "transparent", ring: null, edge: null };
              return <View key={col} style={{ width: cell, height: cell, borderRadius: 2 * s, backgroundColor: look.fill, borderWidth: look.ring || look.edge ? 1 : 0, borderColor: look.ring ?? look.edge ?? "transparent" }} />;
            })}
          </View>
        ))}
      </View>
      <Text className="text-label text-muted">Map</Text>
    </Pressable>
  );
}
