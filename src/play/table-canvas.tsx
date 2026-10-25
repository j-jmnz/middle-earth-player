// The web build has no Skia canvas (the same split as src/screens/backdrop.tsx): it lists each zone's cards by name, a
// tap opens the inspect route and a long press the preview. The phone draws the canvas in table-canvas.native.tsx.
// Choices still go through the sheets.
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useStore } from "zustand";

import { TABLE_ZONES, shownSeat, zoneSelector, type ZoneId } from "./selectors.ts";
import type { TableCanvasProps } from "./table-canvas-types.ts";
import { tableTokens as t } from "./tokens.ts";

const ZONE_WORD: Record<ZoneId, string> = {
  questStage: "Quest",
  staging: "Staging",
  activeLocation: "Active location",
  secondActiveLocation: "Second active location",
  engaged: "Engaged",
  play: "Play area",
  hand: "Hand",
};

function ZoneRow({ store, zone, seat, nameOf, inactive, onInspect, onPreview }: Pick<TableCanvasProps, "store" | "nameOf" | "inactive" | "onInspect" | "onPreview"> & { zone: ZoneId; seat: number }) {
  const select = useMemo(() => zoneSelector(zone, seat), [zone, seat]);
  const view = useStore(store, (state) => select(state.game));
  if (view.entries.length === 0) return null;
  return (
    <View className="mb-2">
      <Text className="text-label text-muted">{ZONE_WORD[zone]}</Text>
      <View className="flex-row flex-wrap gap-1">
        {view.entries.map(({ card }) => (
          <Pressable
            key={card.id}
            accessibilityRole="button"
            onPress={() => onInspect(card.id)}
            onLongPress={card.face === "down" ? undefined : () => onPreview(card.id)}
            delayLongPress={350}
            className="min-h-11 justify-center rounded-tile bg-raised px-2"
            style={({ pressed }) => (pressed ? { backgroundColor: t.hairline } : undefined)}
          >
            <Text className={card.face === "down" ? "text-label text-faint" : "text-label text-bone"}>
              {card.face === "down" ? "Face down" : `${nameOf(card.code)}${card.exhausted ? " (exhausted)" : ""}${inactive(card.code) ? " · Inactive" : ""}`}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function TableCanvas({ store, width, height, nameOf, inactive, onInspect, onPreview }: TableCanvasProps) {
  const seat = useStore(store, (state) => shownSeat(state.game));
  return (
    <View style={{ width, height, backgroundColor: t.felt, padding: 12 }}>
      {TABLE_ZONES.map((zone) => (
        <ZoneRow key={zone} store={store} zone={zone} seat={seat} nameOf={nameOf} inactive={inactive} onInspect={onInspect} onPreview={onPreview} />
      ))}
    </View>
  );
}
