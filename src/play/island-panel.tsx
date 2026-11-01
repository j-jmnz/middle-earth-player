// The Island Map panel a tap on the chip opens (docs/design-system-table.md, The Island Map): the fifteen locations as laid out, the marker, the locations next to it and the secrets under the Temple column, with the words
// (where the marker stands, the legend) beside the grid when the panel is wide. A reading panel on paper: text and tiles that show a card large; it sends nothing (travel is picked on the staging row). A tile is a covered
// location ("?"), a revealed one (its progress), an explored one (a check over its quest points) or the active one (the marker over its progress).
import { Pressable, ScrollView, View } from "react-native";

import { CloseButton } from "./buttons.tsx";
import { COLS, LEGEND, ROWS, TEMPLE_LABEL_WORD, standingWords, tileMarks, type IslandCell, type IslandFit, type IslandReadout, type IslandState } from "./island-table.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { withAlphaHex, type TableTokens } from "./tokens.ts";
import { Text } from "./text.tsx";

const CLOSE_CLEAR = 44;

export function IslandPanel({ readout, fit, onRead, onClose }: { readout: IslandReadout; fit: IslandFit; onRead: (cardId: string) => void; onClose: () => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  const beside = fit.layout === "beside";
  return (
    <View testID="island-map" collapsable={false} style={{ flexShrink: 1 }}>
      <View accessible accessibilityRole="header" accessibilityLabel={`Island Map, ${readout.explored} of ${readout.cells.length} locations explored`} className="flex-row flex-wrap items-baseline justify-center" style={{ paddingHorizontal: CLOSE_CLEAR * s, columnGap: 8 * s }}>
        <Text className="font-display text-title text-ink">Island Map</Text>
        <Text className="font-display text-eyebrow uppercase text-inkLabel">{`${readout.explored} of ${readout.cells.length} explored`}</Text>
      </View>
      <View style={{ position: "absolute", top: -6 * s, right: -6 * s }}>
        <CloseButton testID="island-map-close" onPress={onClose} paper />
      </View>
      <ScrollView style={{ flexGrow: 0, flexShrink: 1, marginTop: 4 * s }} contentContainerStyle={{ alignItems: beside ? "flex-start" : "center", flexDirection: beside ? "row" : "column", justifyContent: "center", gap: beside ? 12 * s : 8 * s }}>
        <View>
          {/* The word over the Temple column, as printed: the three Temple of the Deceived locations are the last column. */}
          <View style={{ height: 17 * s }}>
            <Text className="absolute text-center text-label text-inkLabel" style={{ right: 0, width: fit.tileW }}>{TEMPLE_LABEL_WORD}</Text>
          </View>
          <View style={{ gap: fit.gap }}>
            {Array.from({ length: ROWS }, (_, row) => (
              <View key={row} style={{ flexDirection: "row", gap: fit.gap }}>
                {Array.from({ length: COLS }, (_, col) => {
                  const cell = readout.cells[row * COLS + col];
                  return cell ? <Tile key={cell.id} cell={cell} fit={fit} row={row} col={col} onRead={onRead} /> : null;
                })}
              </View>
            ))}
          </View>
        </View>
        <View style={{ width: fit.textW }}>
          <Text className={beside ? "text-body text-ink" : "text-center text-body text-ink"}>{standingWords(readout)}</Text>
          <View className="flex-row flex-wrap" style={{ marginTop: 8 * s, gap: 6 * s, columnGap: 10 * s, justifyContent: beside ? "flex-start" : "center" }}>
            {LEGEND.map((item) => (
              <View key={item.state} className="flex-row items-center" style={{ gap: 4 * s }}>
                <View style={swatch(item.state, t, s)} />
                <Text className="text-label text-inkMuted">{item.word}</Text>
              </View>
            ))}
            <View className="flex-row items-center" style={{ gap: 4 * s }}>
              <View style={{ width: 12 * s, height: 12 * s, borderRadius: 2 * s, borderWidth: 1, borderColor: t.inkLine, borderRightWidth: 4 * s, borderRightColor: t.inkLabel }} />
              <Text className="text-label text-inkMuted">{TEMPLE_LABEL_WORD}</Text>
            </View>
            {readout.cells.some((cell) => cell.secret) ? (
              <View className="flex-row items-center" style={{ gap: 4 * s }}>
                <View style={{ width: 6 * s, height: 6 * s, borderRadius: 3 * s, backgroundColor: t.inkLabel }} />
                <Text className="text-label text-inkMuted">Secret</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// A legend swatch: the tile's fill and edge in miniature.
function swatch(state: IslandState | "next", t: TableTokens, s: number) {
  const fill = state === "active" ? t.accentDeep : state === "explored" ? withAlphaHex(t.ink, 0.22) : state === "revealed" ? withAlphaHex(t.ink, 0.1) : "transparent";
  return { width: 12 * s, height: 12 * s, borderRadius: 2 * s, borderWidth: state === "next" ? 2 : 1, borderStyle: state === "covered" ? ("dashed" as const) : ("solid" as const), borderColor: state === "next" ? t.ink : t.inkLine, backgroundColor: fill };
}

// One tile: a thumb at least in both directions (islandFit). Its tap shows the card large; a heavy ink edge says it is next to the marker.
function Tile({ cell, fit, row, col, onRead }: { cell: IslandCell; fit: IslandFit; row: number; col: number; onRead: (cardId: string) => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  const [top, below] = tileMarks(cell);
  const dark = cell.state === "active";
  return (
    <Pressable
      testID={`island-map-cell-${row + 1}-${col + 1}`}
      accessibilityRole="button"
      accessibilityLabel={cell.words}
      accessibilityHint="Shows the card"
      onPress={() => onRead(cell.id)}
      style={({ pressed }) => ({
        width: fit.tileW,
        height: fit.tileH,
        borderRadius: 4 * s,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? withAlphaHex(t.ink, 0.2) : dark ? t.accentDeep : cell.state === "explored" ? withAlphaHex(t.ink, 0.22) : cell.state === "revealed" ? withAlphaHex(t.ink, 0.1) : withAlphaHex(t.ink, 0.04),
        borderWidth: cell.next ? 2 : 1,
        borderColor: cell.next ? t.ink : t.inkLine,
        borderStyle: cell.state === "covered" ? "dashed" : "solid",
      })}
    >
      <Text className={`font-display text-body ${dark ? "text-onAccent" : "text-ink"}`}>{top}</Text>
      {below ? <Text className={`font-display text-label ${dark ? "text-onAccent" : "text-inkMuted"}`}>{below}</Text> : null}
      {cell.secret ? <View pointerEvents="none" style={{ position: "absolute", bottom: 3 * s, right: 4 * s, width: 6 * s, height: 6 * s, borderRadius: 3 * s, backgroundColor: t.inkLabel }} /> : null}
    </Pressable>
  );
}
