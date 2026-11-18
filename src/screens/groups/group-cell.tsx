// One card of a card group's grid (docs/design-system.md, Card groups): the picture (upright, or sideways for a quest or setup card), a badge on its
// foot with the copies ("×3", "×3 · Easy ×1"), the name under it and, where data says, where the card comes from or its stage. A tap opens the card, a long press shows it large, as in the pool.
import { memo } from "react";
import { Pressable, View } from "react-native";

import { cardCorner } from "../../ui/card-corner";
import { longPressA11y } from "../../ui/long-press-action";
import { Text } from "../../ui/text";
import { withAlphaHex } from "../../ui/tokens";
import { useUiScale } from "../../ui/ui-scale";
import { RowCardImage, useCardPreview } from "../images/picture";
import { usePalette } from "../kit/palette-hook";
import type { PictureSource } from "../../play/canvas/table-canvas-types";
import { CARD_RATIO } from "../pool/grid";
import { copyBadge, copyWords, type GroupCard } from "./group-types";

export const GroupCell = memo(function GroupCell({
  card,
  width,
  onOpen,
  onPreview,
}: {
  card: GroupCard;
  width: number;
  onOpen: (code: string) => void;
  onPreview: (code: string, name: string, source: PictureSource | null) => void;
}) {
  const palette = usePalette();
  const s = useUiScale();
  const picture = useCardPreview(card.code, card.imagesrc);
  const height = Math.round(card.landscape ? width / CARD_RATIO : width * CARD_RATIO);
  const badge = copyBadge(card);
  const words = [card.name, copyWords(card), card.note].filter((part) => part != null).join(", ");
  return (
    <View style={{ width, marginBottom: 14 * s }}>
      <Pressable
        testID={`group-card-${card.code}`}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={words}
        {...longPressA11y("Show card", () => onPreview(card.code, card.name, picture))}
        accessibilityHint="Opens the card. Hold to show it large"
        onPress={() => onOpen(card.code)}
        onLongPress={() => onPreview(card.code, card.name, picture)}
        delayLongPress={350}
      >
        {({ pressed }) => (
          <View style={{ width, height, borderRadius: cardCorner(width, height), overflow: "hidden", opacity: pressed ? 0.75 : 1, backgroundColor: palette.raised }}>
            {picture ? (
              <RowCardImage code={card.code} source={picture} width={width} height={height} />
            ) : (
              <View className="flex-1 p-2">
                <Text className="font-display text-label text-bone" numberOfLines={4}>
                  {card.name}
                </Text>
              </View>
            )}
            {badge ? (
              // The button's name already says the copies, so the badge's words are hidden from a reader (a name must start with the visible words).
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="absolute bottom-1 left-1 right-1 rounded-control px-1 py-0.5" style={{ backgroundColor: withAlphaHex(palette.night, 0.82) }}>
                <Text testID={`group-badge-${card.code}`} className="text-center text-micro text-moon" numberOfLines={1}>
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </Pressable>
      <Text className="mt-1 text-label text-muted" numberOfLines={1}>
        {card.name}
      </Text>
      {card.note ? (
        <Text className="text-micro text-muted" numberOfLines={4}>
          {card.note}
        </Text>
      ) : null}
    </View>
  );
});
