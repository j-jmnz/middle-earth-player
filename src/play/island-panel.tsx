// The Island Map panel a tap on the chip opens (docs/design-system-table.md, The Island Map): the fifteen locations as laid out, the marker, the locations next to it and the secrets under the Temple column. A reading panel
// on paper: text and tiles that show a card large; it sends nothing (travel is picked on the staging row). A tile is a covered location ("?"), an explored one (its progress) or the active one (the marker).
import { Pressable, ScrollView, View } from "react-native";

import { CloseButton } from "./buttons.tsx";
import { cellLook } from "./island-chip.tsx";
import { COLS, LEGEND, ROWS, standingWords, type IslandReadout, type IslandFit } from "./island-table.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { withAlphaHex } from "./tokens.ts";
import { Text } from "./text.tsx";

const CLOSE_CLEAR = 44;

export function IslandPanel({ readout, fit, onRead, onClose }: { readout: IslandReadout; fit: IslandFit; onRead: (cardId: string) => void; onClose: () => void }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View testID="island-map" collapsable={false} style={{ flexShrink: 1 }}>
      <View accessible accessibilityRole="header" accessibilityLabel={`Island Map, ${readout.covered} of ${readout.cells.length} locations not explored`} className="items-center" style={{ paddingHorizontal: CLOSE_CLEAR * s }}>
        <Text className="font-display text-eyebrow uppercase text-inkLabel">{`${readout.cells.length - readout.covered} of ${readout.cells.length} explored`}</Text>
        <Text className="mt-1 font-display text-title text-ink">Island Map</Text>
      </View>
      <View style={{ position: "absolute", top: -6 * s, right: -6 * s }}>
        <CloseButton testID="island-map-close" onPress={onClose} paper />
      </View>
      <ScrollView className="mt-2" style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ alignItems: "center" }}>
        <View style={{ gap: fit.gap }}>
          {Array.from({ length: ROWS }, (_, row) => (
            <View key={row} style={{ flexDirection: "row", gap: fit.gap }}>
              {Array.from({ length: COLS }, (_, col) => {
                const cell = readout.cells[row * COLS + col];
                if (!cell) return null;
                const look = cellLook(cell, t);
                const mark = cell.state === "covered" ? "?" : cell.state === "active" ? "●" : cell.points != null ? `${cell.progress}/${cell.points}` : "";
                return (
                  <Pressable
                    key={cell.id}
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
                      backgroundColor: pressed ? withAlphaHex(t.ink, 0.2) : cell.state === "active" ? t.accentDeep : cell.state === "explored" ? withAlphaHex(t.ink, 0.16) : withAlphaHex(t.ink, 0.06),
                      borderWidth: look.ring || look.edge ? 2 : 1,
                      borderColor: cell.next ? t.ink : look.edge ? t.inkLabel : t.inkLine,
                      borderStyle: cell.state === "covered" ? "dashed" : "solid",
                    })}
                  >
                    <Text className={`font-display text-body ${cell.state === "active" ? "text-onAccent" : "text-ink"}`}>{mark}</Text>
                    {cell.secret ? <View pointerEvents="none" style={{ position: "absolute", bottom: 3 * s, width: 6 * s, height: 6 * s, borderRadius: 3 * s, backgroundColor: t.inkLabel }} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <Text className="mt-2 text-center text-body text-ink">{standingWords(readout)}</Text>
        <View className="mt-2 flex-row flex-wrap justify-center" style={{ gap: 10 * s }}>
          {LEGEND.map((item) => (
            <View key={item.state} className="flex-row items-center" style={{ gap: 4 * s }}>
              <View style={{ width: 12 * s, height: 12 * s, borderRadius: 2 * s, borderWidth: item.state === "next" ? 2 : 1, borderStyle: item.state === "covered" ? "dashed" : "solid", borderColor: item.state === "next" ? t.ink : t.inkLine, backgroundColor: item.state === "active" ? t.accentDeep : item.state === "explored" ? withAlphaHex(t.ink, 0.16) : "transparent" }} />
              <Text className="text-label text-inkMuted">{item.word}</Text>
            </View>
          ))}
          {readout.cells.some((cell) => cell.secret) ? (
            <View className="flex-row items-center" style={{ gap: 4 * s }}>
              <View style={{ width: 6 * s, height: 6 * s, borderRadius: 3 * s, backgroundColor: t.inkLabel }} />
              <Text className="text-label text-inkMuted">Secret</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
