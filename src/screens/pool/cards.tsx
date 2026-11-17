// The card pool's two ways to show a card (docs/design-system.md, Card pool): a row of the list, and a card of the grid. While adding to
// a deck each has the stepper. card-pool.tsx lays them out. Both are memoized: the pool re-renders on every keystroke and every
// change to the draft, and only the cards whose count or limit changed draw again.
import { memo } from "react";
import { Pressable, View } from "react-native";

import { ListRow, SphereMark, markedSphere } from "../kit/chrome";
import { CountStepper } from "../kit/count-stepper";
import { addDraftCard, announceDraftChange, takeDraftCard, type TitleLookup } from "../deck/draft";
import { CardThumbFrame, RowCardImage, useCardPreview } from "../images/picture";
import { cardCorner } from "../../ui/card-corner";
import { longPressA11y } from "../../ui/long-press-action";
import type { PictureSource } from "../../play/canvas/table-canvas-types";
import { dropShadowOf, selectedRingOf } from "../../ui/surfaces";
import { withAlphaHex } from "../../ui/tokens";
import { useTableTokens } from "../../ui/use-table-tokens";
import { usePalette } from "../kit/palette-hook";
import { useUiScale } from "../../ui/ui-scale";
import { poolDetail, type PoolCard } from "./filter";
import { CARD_RATIO } from "./grid";
import { Text } from "../../ui/text";

export type PoolRowCard = PoolCard & {
  typeName: string;
  sphereName: string | null;
  deckLimit: number | null;
  deckLegal: boolean;
  imagesrc: string | null;
};

const thumb = { width: 32, height: 44 };

// A card outside the collection is drawn at this opacity, always with the words "Not owned", so the dimming is never the only cue.
const UNOWNED_OPACITY = 0.5;

export const NOT_OWNED = "Not owned";

// A row's line: "Ally · Spirit · 2", then what the app does not apply and "Not owned" when they hold.
function rowDetail(detail: string, loss: string | null, unowned: boolean): string {
  return [detail, loss, unowned ? NOT_OWNED : null].filter((part) => part != null).join(" · ");
}

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
  unowned = false,
  side = false,
}: {
  item: PoolRowCard;
  adding: boolean;
  // Adding to the side deck: the count and the stepper are the side deck's.
  side?: boolean;
  // What the app does not apply of this card, in a few words ("Ability not applied"), or null.
  loss?: string | null;
  // Outside the player's collection: the line ends "Not owned" and the picture is dimmed. It can still be added.
  unowned?: boolean;
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
      detail={rowDetail(poolDetail(item), loss, unowned)}
      detailIcons={<RowIcons sphere={item.sphereCode} />}
      leading={
        <View style={unowned ? { opacity: UNOWNED_OPACITY } : undefined}>
          <CardThumbFrame code={item.code} source={picture} width={thumb.width * s} height={thumb.height * s} />
        </View>
      }
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
            where={side ? "side deck" : undefined}
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
  unowned = false,
  selected = false,
  side = false,
}: {
  item: PoolRowCard;
  width: number;
  offset: number;
  // The card whose detail is open beside the grid (the Cards hub on a tablet in landscape): the silver ring.
  selected?: boolean;
  adding: boolean;
  // Adding to the side deck: the count, the badge and the stepper are the side deck's.
  side?: boolean;
  loss?: string | null;
  unowned?: boolean;
  count: number;
  full: boolean;
  lookup: TitleLookup;
  onOpen: (code: string) => void;
  onPreview: (code: string, name: string, source: PictureSource | null) => void;
}) {
  const palette = usePalette();
  const t = useTableTokens();
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
        accessibilityLabel={`${item.name}, ${poolDetail(item)}${loss ? `, ${loss}` : ""}${unowned ? `, ${NOT_OWNED.toLowerCase()}` : ""}${adding && count > 0 ? `, ${count} in the ${side ? "side deck" : "deck"}` : ""}`}
        {...longPressA11y("Show card", () => onPreview(item.code, item.name, picture))}
        accessibilityHint="Opens the card. Hold to show it large"
        onPress={() => onOpen(item.code)}
        onLongPress={() => onPreview(item.code, item.name, picture)}
        delayLongPress={350}
      >
        {({ pressed }) => (
          <View
            style={{ width, height, borderRadius: cardCorner(width, height), overflow: "hidden", opacity: pressed ? 0.75 : 1, backgroundColor: palette.raised, ...(selected ? { boxShadow: selectedRingOf(t) } : {}) }}
          >
            {picture ? (
              <View style={unowned ? { opacity: UNOWNED_OPACITY } : undefined}>
                <RowCardImage code={item.code} source={picture} width={width} height={height} />
              </View>
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
            {loss || unowned ? (
              <View className="absolute bottom-1 left-1 right-1 rounded-control px-1 py-0.5" style={{ backgroundColor: withAlphaHex(palette.night, 0.82) }}>
                {/* Not owned first: it is what the player is choosing by; a card can be both. */}
                <Text className={`text-center text-micro ${unowned ? "text-moon" : "text-muted"}`} numberOfLines={1}>
                  {unowned ? NOT_OWNED : loss}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </Pressable>
      <Text className={`mt-1 text-label ${selected ? "text-accentHigh" : "text-muted"}`} numberOfLines={1}>
        {item.name}
      </Text>
      {adding && count > 0 ? (
        <View pointerEvents="none" className="absolute h-6 min-w-6 items-center justify-center rounded-control px-1.5" style={{ right: -6 * s, top: -6 * s, backgroundColor: palette.night, boxShadow: `0 0 0 1.5px ${palette.accentHigh}, ${dropShadowOf(t, 2, 6, 0.9)}` }}>
          <Text className="font-display text-label text-bone">{String(count)}</Text>
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
            where={side ? "side deck" : undefined}
            onChange={(delta) => announceDraftChange(delta > 0 ? addDraftCard(card, lookup) : takeDraftCard(card, lookup))}
          />
        </View>
      ) : null}
    </View>
  );
});
