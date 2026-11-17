// The deck editor's head (docs/design-system.md, Deck builder): the fan of the heroes' cards, the deck's name, the
// deck at a glance (the sphere donut and count, the cost curve), its notes and the jump chips to its headings, which carry the counts by type.
import { View } from "react-native";

import { cardCorner } from "../../ui/card-corner";
import { dropShadowOf } from "../../ui/surfaces";
import { withAlphaHex } from "../../ui/tokens";
import { useTableTokens } from "../../ui/use-table-tokens";
import { SPHERE_TINT } from "../../ui/icon-map";
import { BodyText, Label, markedSphere, SphereMark, sphereWord, TextButton, useTitleShadow } from "../kit/chrome";
import { CardThumb } from "../images/picture";
import { ArcRing } from "../../ui/arc-ring";
import { costCurve, CURVE_LABELS, deckCardCount, DECK_MINIMUM, sphereSplit, type DeckFace } from "./status";
import { JumpChips, type Jump } from "./grid";
import type { HeroFace } from "../art/hero-tile";
import { usePalette } from "../kit/palette-hook";
import { touch, useUiScale } from "../../ui/ui-scale";
import { Text, TextInput } from "../../ui/text";

// How far the head's top runs before the deck's own words: Back's row over the fan. The editor watches the scroll past it.
export const BANNER_HEIGHT = 196;

// A hero card in the fan, at Medium's size: 112 × 156 on a phone, 150 × 209 on a tablet.
const FAN_CARD = { width: 112, height: 156 };
const FAN_CARD_WIDE = { width: 150, height: 209 };

/**
 * The deck's heroes as a fan of their cards: the outer two turned 9° out and set back, the middle one raised and on top, a glow of the
 * fellowship's sphere behind them. Four heroes (a Fellowship deck) spread a little wider. A drawing of the heroes; the list below holds
 * them as buttons.
 */
export function HeroFan({ heroes, wide }: { heroes: readonly HeroFace[]; wide: boolean }) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const card = wide ? FAN_CARD_WIDE : FAN_CARD;
  const w = card.width * s;
  const h = card.height * s;
  const shown = heroes.slice(0, 4);
  const middle = (shown.length - 1) / 2;
  const spread = shown.length > 3 ? 0.62 : 0.78;
  const lead = shown[Math.floor(middle)] ?? shown[0];
  const glow = lead ? palette[(SPHERE_TINT[lead.sphereCode ?? ""] ?? "accent") as keyof typeof palette] : palette.accent;
  return (
    <View accessible accessibilityLabel={`Heroes: ${heroes.map((hero) => hero.name).join(", ")}`} style={{ height: h + 24 * s, alignItems: "center", justifyContent: "center" }}>
      <View pointerEvents="none" style={{ position: "absolute", width: w * 3.2, height: h * 1.3, backgroundImage: `radial-gradient(50% 50% at 50% 55%, ${withAlphaHex(glow, 0.32)}, ${withAlphaHex(glow, 0)})` }} />
      {shown.map((hero, index) => {
        const offset = index - middle;
        const centre = Math.abs(offset) < 0.6;
        return (
          <View
            key={hero.code}
            style={{
              position: "absolute",
              width: w,
              height: h,
              borderRadius: cardCorner(w, h),
              overflow: "hidden",
              backgroundColor: palette.raised,
              zIndex: centre ? 2 : 1,
              boxShadow: dropShadowOf(t, 18, 30, 0.9),
              transform: [{ translateX: offset * w * spread }, { translateY: centre ? -8 * s : 6 * s }, { rotate: `${offset * 9}deg` }],
            }}
          >
            <CardThumb code={hero.code} imagesrc={hero.imagesrc} width={w} height={h} />
          </View>
        );
      })}
    </View>
  );
}

/**
 * The deck at a glance, on the ground: a donut of the spheres' shares with the card count in it (green once the deck is legal) and
 * the cost curve as silver bars over the costs. The counts by type are on the jump chips.
 */
export function DeckAnalytics({
  cards,
  faces,
  ready,
  countLine,
}: {
  cards: readonly { code: string; count: number }[];
  faces: ReadonlyMap<string, Pick<DeckFace, "cost" | "sphereCode" | "sphereName" | "typeCode">>;
  ready: boolean;
  // "3 heroes · 50 cards": spoken with the ring, which shows the count alone.
  countLine: string;
}) {
  const palette = usePalette();
  const s = useUiScale();
  const cardCount = deckCardCount(cards);
  const curve = costCurve(cards, faces);
  const curveTop = Math.max(1, ...curve.counts);
  const split = sphereSplit(cards, faces);
  const splitTotal = split.reduce((sum, entry) => sum + entry.count, 0);
  const tint = (code: string) => palette[(SPHERE_TINT[code] ?? "faint") as keyof typeof palette];
  const parts = split.map((entry) => ({ key: entry.code, share: entry.count / Math.max(1, splitTotal), color: tint(entry.code) }));
  return (
    <View className="flex-row items-center" style={{ gap: 14 * s }}>
      <View className="items-center" style={{ gap: 4 * s }}>
        <View accessible accessibilityLabel={`${countLine}. Spheres: ${split.map((entry) => `${sphereWord(entry.name)} ${entry.count}`).join(", ") || "none yet"}`}>
          <ArcRing size={68 * s} parts={parts} track={withAlphaHex(palette.bone, 0.08)}>
            <Text testID="deck-card-count" className="font-display" style={{ fontSize: 22 * s, lineHeight: 24 * s, color: ready ? palette.ok : palette.bone }}>
              {String(cardCount)}
            </Text>
            {/* "cards" under the number; "of 50" instead while the deck is short of its minimum. */}
            <Text testID="deck-card-count-word" className="text-micro text-muted" style={{ lineHeight: 12 * s }}>
              {cardCount < DECK_MINIMUM ? `of ${DECK_MINIMUM}` : "cards"}
            </Text>
          </ArcRing>
        </View>
        {/* The ring's colours are not the only cue: each sphere present is named by its icon and its count under the ring. The ring's label says it, so a reader skips this. */}
        {split.length > 0 ? (
          <View testID="deck-sphere-legend" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden className="flex-row flex-wrap justify-center" style={{ gap: 6 * s, maxWidth: 96 * s }}>
            {split.map((entry) => {
              const mark = markedSphere(entry.code);
              return (
                <View key={entry.code} className="flex-row items-center" style={{ gap: 2 * s }}>
                  {mark ? <SphereMark sphere={mark} size={12} /> : null}
                  <Text className="text-micro text-muted">{String(entry.count)}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
      <View className="min-w-0 flex-1">
        <View
          className="flex-row items-end"
          style={{ height: 44 * s, gap: 5 * s }}
          accessible
          accessibilityLabel={`Cost curve: ${CURVE_LABELS.map((label, at) => `${curve.counts[at]} at cost ${label}`).join(", ")}${curve.average != null ? `, average ${curve.average}` : ""}`}
        >
          {CURVE_LABELS.map((label, at) => (
            <View key={label} className="flex-1 items-center justify-end" style={{ height: "100%", gap: 3 * s }}>
              <View
                className="w-full"
                style={{
                  height: Math.max(2, Math.round((curve.counts[at] / curveTop) * 30 * s)),
                  borderTopLeftRadius: 1,
                  borderTopRightRadius: 1,
                  backgroundColor: curve.counts[at] > 0 ? palette.accent : withAlphaHex(palette.bone, 0.1),
                  ...(curve.counts[at] > 0 ? { backgroundImage: `linear-gradient(180deg, ${palette.accentHigh}, ${palette.accentDeep})` } : {}),
                }}
              />
              <Text className="text-micro text-faint">{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * The deck editor's head (docs/design-system.md, Deck builder): the fan of the heroes' cards, the deck's name, its starting
 * threat, the analytics, the notes, and the jump chips to its headings. Whether it is ready is said once, beside Save. A view of
 * the draft; the editor owns the state.
 */
export function DeckGlance({
  heroes,
  cards,
  faces,
  name,
  onName,
  ready,
  threat,
  countLine,
  notApplied,
  droppedNote,
  starterNote,
  notOwnedNote,
  onEditCollection,
  jumps,
  onJump,
  top,
  side,
  wide = false,
}: {
  heroes: readonly HeroFace[];
  cards: readonly { code: string; count: number }[];
  faces: ReadonlyMap<string, Pick<DeckFace, "cost" | "sphereCode" | "sphereName" | "typeCode">>;
  name: string;
  onName: (next: string) => void;
  ready: boolean;
  threat: number | null;
  // "3 heroes · 50 cards": spoken with the analytics' ring, not shown (the fan shows the heroes, the ring the count).
  countLine: string;
  notApplied: string | null;
  droppedNote: string | null;
  starterNote: string | null;
  // The cards outside the player's collection, named (notOwnedNote in src/screens/collection/view.ts), and Edit collection's tap.
  notOwnedNote: string | null;
  onEditCollection: () => void;
  jumps: readonly Jump[];
  onJump: (jump: Jump) => void;
  // The top inset (useTopInset), and the page's side padding.
  top: number;
  side: { paddingLeft: number; paddingRight: number };
  // The larger fan of a tablet.
  wide?: boolean;
}) {
  const palette = usePalette();
  const s = useUiScale();
  const shadow = useTitleShadow();
  return (
    <View style={{ paddingTop: top + 56 * s }}>
      <View style={side}>
        {heroes.length > 0 ? <HeroFan heroes={heroes} wide={wide} /> : null}
        <TextInput
          testID="deck-name"
          value={name}
          onChangeText={onName}
          placeholder="Name this deck"
          placeholderTextColor={palette.faint}
          accessibilityLabel="Deck name"
          selectTextOnFocus
          returnKeyType="done"
          className="mt-3 text-center font-display text-bone"
          style={{ minHeight: touch(s, 44), fontSize: 26 * s, lineHeight: 32 * s, ...shadow }}
        />
        {threat == null ? null : (
          <Text className="text-center text-label text-muted">
            {`Threat ${threat}`}
          </Text>
        )}
        {/* A tablet in portrait keeps the analytics to a reading width, so its bars and words stay in proportion. */}
        <View className="mt-3" style={{ width: "100%", maxWidth: 560 * s, alignSelf: "center" }}>
          <DeckAnalytics cards={cards} faces={faces} ready={ready} countLine={countLine} />
        </View>
        {notApplied ? (
          <Label testID="deck-not-applied" tone="muted" className="mt-1">
            {`${notApplied}. Each card says what the app leaves out.`}
          </Label>
        ) : null}
        {droppedNote ? (
          <BodyText testID="deck-import-dropped" tone="muted" className="mt-2">
            {droppedNote}
          </BodyText>
        ) : null}
        {starterNote ? (
          <Label testID="starter-note" className="mt-2">
            {starterNote}
          </Label>
        ) : null}
        {/* A note, not a rule: the deck stays ready and keeps every card. */}
        {notOwnedNote ? (
          <View className="mt-2 items-start">
            <Label testID="deck-not-owned" tone="muted">
              {notOwnedNote}
            </Label>
            <TextButton testID="deck-edit-collection" label="Edit collection" tone="accent" small onPress={onEditCollection} />
          </View>
        ) : null}
        {/* Jump to a heading: the deck stays one list (every card reachable by scrolling), and these shorten the trip. */}
        <View className="mt-2 flex-row flex-wrap gap-x-1.5">
          <JumpChips jumps={jumps} onJump={onJump} />
        </View>
      </View>
    </View>
  );
}

/** The printed cost on a dark coin, at the head of a card row: solid, as everything inside a list row is. */
export function CostCoin({ cost }: { cost: string | null }) {
  const palette = usePalette();
  return (
    <View accessible={false} importantForAccessibility="no" className="h-7 w-7 items-center justify-center rounded-control" style={{ backgroundColor: palette.raised }}>
      <Text className="font-display text-label text-bone">{cost ?? "–"}</Text>
    </View>
  );
}
