// The cards shown with a card in the preview (card-preview.tsx): a row of the wide column's list and a chip of the strip under an upright card.
// Each is one control that shows that card in the preview's place, and wears the focus ring while a keyboard holds focus (ui/focus-ring.ts).
// Names keep one line at the phone's default text size and grow with larger text (capLines, ui/ui-scale.ts).
import { Image } from "expo-image";
import { Pressable, useWindowDimensions, View } from "react-native";

import { cardCorner } from "../../ui/card-corner.ts";
import { useFocusRing } from "../../ui/focus-ring.ts";
import { cachePolicyFor } from "../../ui/image-cache.ts";
import { capLines, touch, useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";
import type { PictureSource } from "../canvas/table-canvas-types.ts";
import { chipLabel, EARLIER_STAGE, rowName } from "./preview-words.ts";

type Related = { code: string; name: string; title?: string; role?: string; source: PictureSource | null };

type Props = { item: Related; index: number; selected: boolean; onPress: () => void };

function Thumb({ item, index }: { item: Related; index: number }) {
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <View style={{ width: 24 * s, height: 34 * s, borderRadius: cardCorner(24 * s, 34 * s), overflow: "hidden", backgroundColor: t.raised }}>
      {item.source ? <Image accessible={false} importantForAccessibility="no" source={item.source} cachePolicy={cachePolicyFor(item.source)} recyclingKey={`${item.code}:${index}:thumb`} contentFit="cover" style={{ width: 24 * s, height: 34 * s }} /> : null}
    </View>
  );
}

/** A row of the wide column's list: the thumbnail, the card's name and its role. */
export function RelatedRow({ item, index, selected, onPress }: Props) {
  const t = useTableTokens();
  const s = useUiScale();
  const ring = useFocusRing();
  const cap = capLines(1, useWindowDimensions().fontScale);
  return (
    <Pressable {...ring.props} testID={`card-preview-related-${index}`} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}>
      {/* Layout and fill are styles, not classes: a class on a Pressable with a style function can be dropped on the phone. */}
      {({ pressed }) => (
        <View className="mt-1 flex-row items-center gap-2 rounded-item px-2" style={{ minHeight: touch(s, 44), backgroundColor: pressed ? t.pressed : selected ? t.raised : "transparent", ...ring.style }}>
          <Thumb item={item} index={index} />
          <View className="shrink">
            <Text numberOfLines={cap} className="text-body text-bone">
              {rowName(item)}
            </Text>
            {item.role && item.role !== EARLIER_STAGE ? <Text className="text-label text-muted">{item.role}</Text> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** A chip of the strip under an upright card: the thumbnail and the card's role or name. */
export function RelatedChip({ item, index, selected, onPress }: Props) {
  const t = useTableTokens();
  const s = useUiScale();
  const ring = useFocusRing();
  const cap = capLines(1, useWindowDimensions().fontScale);
  return (
    <Pressable {...ring.props} testID={`card-preview-related-${index}`} accessibilityRole="button" accessibilityLabel={chipLabel(item)} accessibilityState={{ selected }} onPress={onPress}>
      {({ pressed }) => (
        <View className="flex-row items-center gap-2 rounded-item px-2" style={{ minHeight: touch(s, 44), backgroundColor: pressed ? t.pressed : selected ? t.raised : "transparent", ...ring.style }}>
          <Thumb item={item} index={index} />
          <Text numberOfLines={cap} className="text-label text-bone">
            {index > 0 && item.title ? item.title : (item.role ?? item.name)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
