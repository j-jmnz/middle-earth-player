// The card pool's two ways to show a card (docs/design-system.md, Card pool): a row of the list, and a card of the grid. While adding to
// a deck each has the stepper. card-pool.tsx lays them out. Both are memoized: the pool re-renders on every keystroke and every
// change to the draft, and only the cards whose count or limit changed draw again.
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { ListRow, SphereMark, markedSphere } from "./chrome";
import { CountStepper } from "./count-stepper";
import { addDraftCard, announceDraftChange, takeDraftCard, type TitleLookup } from "./deck-draft";
import { CardThumbFrame, RowCardImage, useCardPreview } from "./images/picture";
import type { PictureSource } from "../play/table-canvas-types";
import { withAlphaHex } from "../play/tokens";
import { usePalette } from "./palette-hook";
import { useUiScale } from "../play/ui-scale";
import { poolDetail, type PoolCard } from "./pool-filter";
import { CARD_RATIO } from "./pool-grid";

export type PoolRowCard = PoolCard & {
  typeName: string;
  sphereName: string | null;
  deckLimit: number | null;
  deckLegal: boolean;
  imagesrc: string | null;
};

const thumb = { width: 32, height: 44 };

// The sphere's printed icon before the row's words ("Ally · Spirit · 2").
function RowIcons({ sphere }: { sphere: string | null }) {
  const mark = markedSphere(sphere);
  return mark ? <SphereMark sphere={mark} size={12} /> : null;
}

export const PoolCardRow = memo(function PoolCardRow({
  item,
  adding,
  count,
  full,
  lookup,
  onOpen,
  onPreview,
  loss = null,
}: {
  item: PoolRowCard;
  adding: boolean;
  // What the app does not apply of this card, in a few words ("Ability not applied"), or null.
  loss?: string | null;
  count: number;
  // Whether + would be refused: the title is at its copy limit (any printing), or the hero is taken or the slots are full.
  full: boolean;
  lookup: TitleLookup;
  onOpen: (code: string) => void;
  onPreview: (code: string, name: string, source: PictureSource | null) => void;
}) {
  const picture = useCardPreview(item.code, item.imagesrc);
  const s = useUiScale();
  const card = { code: item.code, name: item.name, typeCode: item.typeCode, deckLimit: item.deckLimit };
  return (
    <ListRow
      testID={`card-${item.code}`}
      label={item.name}
      detail={loss ? `${poolDetail(item)} · ${loss}` : poolDetail(item)}
      detailIcons={<RowIcons sphere={item.sphereCode} />}
      leading={<CardThumbFrame code={item.code} source={picture} width={thumb.width * s} height={thumb.height * s} />}
      onPress={() => onOpen(item.code)}
      onLongPress={() => onPreview(item.code, item.name, picture)}
      trailing={
        adding ? (
          <CountStepper
            code={item.code}
            name={item.name}
            count={count}
            full={full}
            minus={count > 0}
            ids={{ dec: `take-${item.code}`, count: `pool-count-${item.code}`, inc: `add-${item.code}` }}
            onChange={(delta) => announceDraftChange(delta > 0 ? addDraftCard(card, lookup) : takeDraftCard(card, lookup))}
          />
        ) : undefined
      }
    />
  );
});

// One card in the grid: its picture (the name and type on night while the file is missing), its name under it in label type, the
// count the deck holds (accent) and, while adding, − and + under it. A tap opens the card, a long press shows it large, as a row does.
// `offset` is how far it sits into its column (gridOffset).
export const PoolCardCell = memo(function PoolCardCell({
  item,
  width,
  offset,
  adding,
  count,
  full,
  lookup,
  onOpen,
  onPreview,
  loss = null,
}: {
  item: PoolRowCard;
  width: number;
  offset: number;
  adding: boolean;
  loss?: string | null;
  count: number;
  full: boolean;
  lookup: TitleLookup;
  onOpen: (code: string) => void;
  onPreview: (code: string, name: string, source: PictureSource | null) => void;
}) {
  const palette = usePalette();
  const s = useUiScale();
  const picture = useCardPreview(item.code, item.imagesrc);
  const card = { code: item.code, name: item.name, typeCode: item.typeCode, deckLimit: item.deckLimit };
  const height = Math.round(width * CARD_RATIO);
  return (
    <View style={{ width, marginLeft: offset, marginBottom: 14 * s }}>
      <Pressable
        testID={`card-${item.code}`}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${poolDetail(item)}${loss ? `, ${loss}` : ""}${adding && count > 0 ? `, ${count} in the deck` : ""}`}
        accessibilityHint="Opens the card. Hold to show it large"
        onPress={() => onOpen(item.code)}
        onLongPress={() => onPreview(item.code, item.name, picture)}
        delayLongPress={350}
      >
        {({ pressed }) => (
          <View className="rounded-chip" style={{ width, height, overflow: "hidden", opacity: pressed ? 0.75 : 1, borderWidth: adding && count > 0 ? 1.5 : 1, borderColor: adding && count > 0 ? palette.accent : withAlphaHex(palette.bone, 0.08), backgroundColor: palette.raised }}>
            {picture ? (
              <RowCardImage code={item.code} source={picture} width={width - 2} height={height - 2} />
            ) : (
              <View className="flex-1 justify-between p-2">
                <Text className="font-display text-label text-bone" numberOfLines={4}>
                  {item.name}
                </Text>
                <View className="flex-row items-center gap-1">
                  <RowIcons sphere={item.sphereCode} />
                  <Text className="text-micro text-muted" numberOfLines={1}>
                    {item.typeName}
                  </Text>
                </View>
              </View>
            )}
            {loss ? (
              <View className="absolute bottom-1 left-1 right-1 rounded px-1 py-0.5" style={{ backgroundColor: withAlphaHex(palette.night, 0.82) }}>
                <Text className="text-center text-micro text-muted" numberOfLines={1}>
                  {loss}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </Pressable>
      <Text className="mt-1 text-label text-bone" numberOfLines={1}>
        {item.name}
      </Text>
      {adding && count > 0 ? (
        <View pointerEvents="none" className="absolute right-1 top-1 h-6 min-w-6 items-center justify-center rounded-pill px-1.5" style={{ backgroundColor: palette.accent, borderWidth: 2, borderColor: palette.night }}>
          <Text className="font-display-bold text-label text-onAccent">{String(count)}</Text>
        </View>
      ) : null}
      {adding ? (
        <View className="mt-1.5 items-center">
          <CountStepper
            code={item.code}
            name={item.name}
            count={count}
            full={full}
            minus={count > 0}
            ids={{ dec: `take-${item.code}`, count: `pool-count-${item.code}`, inc: `add-${item.code}` }}
            onChange={(delta) => announceDraftChange(delta > 0 ? addDraftCard(card, lookup) : takeDraftCard(card, lookup))}
          />
        </View>
      ) : null}
    </View>
  );
});
