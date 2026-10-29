// The deck editor's head (docs/design-system.md, Deck builder): the fan of the heroes' cards, the deck's name, whether it is ready, the
// deck at a glance (the sphere donut and count, the cost curve, the counts by type), its notes and the jump chips to its headings.
import { View } from "react-native";

import { panelSurface } from "../play/surfaces";
import { withAlphaHex } from "../play/tokens";
import { useTableTokens } from "../play/use-table-tokens";
import { SPHERE_TINT } from "../play/icon-map";
import { BodyText, Eyebrow, Label, ToggleChip, sphereWord, useTitleShadow } from "./chrome";
import { CardThumb } from "./images/picture";
import { SphereDonut } from "./sphere-donut";
import { costCurve, CURVE_LABELS, deckCardCount, DECK_MINIMUM, sphereSplit, type DeckFace } from "./deck-status";
import type { HeroFace } from "./hero-tile";
import { usePalette } from "./palette-hook";
import { touch, useUiScale } from "../play/ui-scale";
import { Text, TextInput } from "../play/text";

// How far the head's top runs before the deck's own words: Back's row over the fan. The editor watches the scroll past it.
export const BANNER_HEIGHT = 196;

export type Jump = { key: string; title: string; count: number; index: number };

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
    <View importantForAccessibility="no-hide-descendants" style={{ height: h + 24 * s, alignItems: "center", justifyContent: "center" }}>
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
              borderRadius: 6 * s,
              overflow: "hidden",
              backgroundColor: palette.raised,
              zIndex: centre ? 2 : 1,
              boxShadow: `0 18px 30px ${withAlphaHex(palette.night, 0.9)}`,
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
 * The deck at a glance on one floating panel: a donut of the spheres' shares with the card count in it (green once the deck is legal),
 * the cost curve as silver bars over the costs, and the counts of allies, attachments and events.
 */
export function DeckAnalytics({ cards, faces, ready }: { cards: readonly { code: string; count: number }[]; faces: ReadonlyMap<string, Pick<DeckFace, "cost" | "sphereCode" | "sphereName" | "typeCode">>; ready: boolean }) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const cardCount = deckCardCount(cards);
  const curve = costCurve(cards, faces);
  const curveTop = Math.max(1, ...curve.counts);
  const split = sphereSplit(cards, faces);
  const splitTotal = split.reduce((sum, entry) => sum + entry.count, 0);
  const tint = (code: string) => palette[(SPHERE_TINT[code] ?? "faint") as keyof typeof palette];
  const parts = split.map((entry) => ({ key: entry.code, share: entry.count / Math.max(1, splitTotal), color: tint(entry.code) }));
  const typeCount = (type: string) => cards.reduce((sum, card) => sum + (faces.get(card.code)?.typeCode === type ? card.count : 0), 0);
  const types = [
    { word: "Allies", count: typeCount("ally") },
    { word: "Attachments", count: typeCount("attachment") },
    { word: "Events", count: typeCount("event") },
  ];
  return (
    <View className="flex-row items-center rounded-card" style={{ ...panelSurface(false, t), padding: 14 * s, gap: 14 * s }}>
      <View accessible accessibilityLabel={`${cardCount} of ${DECK_MINIMUM} cards. Spheres: ${split.map((entry) => `${sphereWord(entry.name)} ${entry.count}`).join(", ") || "none yet"}`}>
        <SphereDonut size={64 * s} parts={parts} track={withAlphaHex(palette.bone, 0.08)}>
          <Text testID="deck-card-count" className="font-display" style={{ fontSize: 22 * s, lineHeight: 26 * s, color: ready ? palette.ok : palette.bone }}>
            {String(cardCount)}
          </Text>
        </SphereDonut>
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
        <View className="mt-1.5 flex-row flex-wrap" style={{ columnGap: 12 * s }}>
          {types.map((type) => (
            <Text key={type.word} className="text-label text-muted">{`${type.word} ${type.count}`}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * The deck editor's head (docs/design-system.md, Deck builder): the fan of the heroes' cards, the deck's name, its heroes and starting
 * threat, whether it is ready, the analytics panel, the notes, and the jump chips to its headings. A view of the draft; the editor owns
 * the state.
 */
export function DeckGlance({
  heroes,
  cards,
  faces,
  name,
  onName,
  readiness,
  threat,
  countLine,
  notApplied,
  droppedNote,
  starterNote,
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
  readiness: { ready: boolean; text: string };
  threat: number | null;
  countLine: string;
  notApplied: string | null;
  droppedNote: string | null;
  starterNote: string | null;
  jumps: readonly Jump[];
  onJump: (jump: Jump) => void;
  // The status bar's inset, and the page's side padding.
  top: number;
  side: { paddingLeft: number; paddingRight: number };
  // The larger fan of a tablet.
  wide?: boolean;
}) {
  const palette = usePalette();
  const s = useUiScale();
  const shadow = useTitleShadow();
  const heroLine = [heroes.map((hero) => hero.name.split(" ")[0]).join(" · "), threat == null ? null : `Threat ${threat}`].filter(Boolean).join(" · ");
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
        {heroLine ? <Text className="text-center text-label text-muted">{heroLine}</Text> : null}
        <View className="mt-2 items-center">
          {/* Ready is the green word; not ready says what is missing in red. */}
          {readiness.ready ? (
            <Eyebrow testID="deck-ready" tone="moon">
              {readiness.text}
            </Eyebrow>
          ) : (
            <Text testID="deck-error" className="text-center text-label text-danger">{`Not ready to play: ${readiness.text}`}</Text>
          )}
        </View>
        <View className="mt-3">
          <DeckAnalytics cards={cards} faces={faces} ready={readiness.ready} />
        </View>
        <Label testID="deck-count" className="mt-3">
          {countLine}
        </Label>
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
        {/* Jump to a heading: the deck stays one list (every card reachable by scrolling), and these shorten the trip. */}
        <View className="mt-2 flex-row flex-wrap gap-x-1.5">
          {jumps.map((jump) => (
            <ToggleChip key={jump.key} testID={`deck-jump-${jump.key}`} label={`${jump.title} ${jump.count}`} accessibilityLabel={`Go to ${jump.title}, ${jump.count}`} onPress={() => onJump(jump)} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** The printed cost on a dark coin, at the head of a card row: solid, as everything inside a list row is. */
export function CostCoin({ cost }: { cost: string | null }) {
  const palette = usePalette();
  return (
    <View accessible={false} importantForAccessibility="no" className="h-7 w-7 items-center justify-center rounded-pill" style={{ backgroundColor: palette.raised }}>
      <Text className="font-display text-label text-bone">{cost ?? "–"}</Text>
    </View>
  );
}
