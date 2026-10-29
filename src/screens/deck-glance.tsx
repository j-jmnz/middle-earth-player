// The deck editor's head (docs/design-system.md, Deck editor): the heroes' paintings under the deck's name, whether it is ready, and
// the deck at a glance (starting threat, the count against 50, the spheres, the cost curve), then its notes and the jump chips to
// its headings. A view of the draft; the editor owns the state.
import { Text, TextInput, View } from "react-native";

import { nightFade, tileSurface, topShade } from "../play/surfaces";
import { useTableTokens } from "../play/use-table-tokens";
import { SPHERE_TINT } from "../play/icon-map";
import { CroppedArt } from "./art";
import { PAINTING } from "./art-crop";
import { BodyText, Eyebrow, Label, ProgressBar, SphereMark, StatTile, ToggleChip, markedSphere, sphereWord } from "./chrome";
import { costCurve, CURVE_LABELS, deckCardCount, DECK_MINIMUM, sphereSplit, type DeckFace } from "./deck-status";
import type { HeroFace } from "./hero-tile";
import { usePalette } from "./palette-hook";
import { touch, useUiScale } from "../play/ui-scale";

export const BANNER_HEIGHT = 196;

export type Jump = { key: string; title: string; count: number; index: number };

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
}: {
  heroes: readonly HeroFace[];
  cards: readonly { code: string; count: number }[];
  faces: ReadonlyMap<string, Pick<DeckFace, "cost" | "sphereCode" | "sphereName">>;
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
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const bannerHeight = BANNER_HEIGHT * s + top;
  const cardCount = deckCardCount(cards);
  const curve = costCurve(cards, faces);
  const curveTop = Math.max(1, ...curve.counts);
  const split = sphereSplit(cards, faces);
  const splitTotal = split.reduce((sum, entry) => sum + entry.count, 0);
  const heroSpheres = [...new Set(heroes.map((hero) => markedSphere(hero.sphereCode)).filter((mark) => mark != null))];
  // A deck with no hero yet has no paintings: its head starts under Back, with no empty banner.
  const banner = heroes.length > 0;
  const tint = (code: string) => palette[(SPHERE_TINT[code] ?? "faint") as keyof typeof palette];
  return (
    <View>
      {banner ? (
        <View style={{ height: bannerHeight, flexDirection: "row", gap: 1, backgroundColor: palette.night }}>
          {heroes.slice(0, 4).map((hero) => (
            <View key={hero.code} className="flex-1">
              <CroppedArt card={hero} region={PAINTING} height={bannerHeight} />
            </View>
          ))}
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...topShade(0.35, t) }} />
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...nightFade(0.3, 1, undefined, t) }} />
        </View>
      ) : (
        <View style={{ height: top + 64 * s }} />
      )}
      <View style={{ ...side, marginTop: banner ? -64 * s : 0 }}>
        {/* Ready is the accent eyebrow; not ready is the rule in danger with its ring, as the deck list says it. */}
        {readiness.ready ? (
          <Eyebrow testID="deck-ready">{readiness.text}</Eyebrow>
        ) : (
          <View className="flex-row items-center gap-1.5">
            <View style={{ width: 8 * s, height: 8 * s, borderRadius: 4 * s, borderWidth: 1.5, borderColor: palette.danger }} />
            <Text testID="deck-error" className="shrink text-label text-danger">{`Not ready to play: ${readiness.text}`}</Text>
          </View>
        )}
        <TextInput
          testID="deck-name"
          value={name}
          onChangeText={onName}
          placeholder="Name this deck"
          placeholderTextColor={palette.faint}
          accessibilityLabel="Deck name"
          selectTextOnFocus
          returnKeyType="done"
          className="mt-1 border-b border-hairline pb-1 font-display text-title text-bone"
          style={{ minHeight: touch(s, 44) }}
        />
        <View className="mt-3 flex-row gap-2">
          <StatTile label="Threat" value={threat == null ? "–" : String(threat)} icon="threat" iconTint="danger" />
          <StatTile label="Cards" value={String(cardCount)} detail={`/ ${DECK_MINIMUM}`}>
            <View className="mt-1.5">
              <ProgressBar value={cardCount} max={DECK_MINIMUM} />
            </View>
          </StatTile>
          <View className="flex-1 rounded-tile px-3 py-2.5" style={tileSurface(false, t)} accessible accessibilityLabel={`Spheres: ${split.map((entry) => `${sphereWord(entry.name)} ${entry.count}`).join(", ") || "none yet"}`}>
            <Text className="text-label text-muted">Spheres</Text>
            <View className="mt-1 h-5 flex-row items-center gap-1.5">
              {heroSpheres.map((mark) => (
                <SphereMark key={mark} sphere={mark} size={14} />
              ))}
            </View>
            <View className="mt-1.5 h-1 flex-row gap-0.5 overflow-hidden rounded-pill" style={{ backgroundColor: palette.hairline }}>
              {split.map((entry) => (
                <View key={entry.code} style={{ flex: entry.count / Math.max(1, splitTotal), backgroundColor: tint(entry.code) }} />
              ))}
            </View>
          </View>
        </View>
        {/* The cost curve: the copies at each cost, so the deck's shape reads before its rows. */}
        <View className="mt-2 rounded-tile px-3.5 py-2.5" style={tileSurface(false, t)} accessible accessibilityLabel={`Cost curve: ${CURVE_LABELS.map((label, at) => `${curve.counts[at]} at cost ${label}`).join(", ")}${curve.average != null ? `, average ${curve.average}` : ""}`}>
          <View className="flex-row justify-between">
            <Text className="text-label text-muted">Cost curve</Text>
            {curve.average != null ? <Text className="text-label text-muted">{`average ${curve.average}`}</Text> : null}
          </View>
          <View className="mt-2 h-14 flex-row items-end gap-1.5">
            {CURVE_LABELS.map((label, at) => (
              <View key={label} className="flex-1 items-center justify-end gap-1" style={{ height: "100%" }}>
                <View className="w-full rounded-t" style={{ height: Math.max(2, Math.round((curve.counts[at] / curveTop) * 34 * s)), backgroundColor: curve.counts[at] > 0 ? palette.accentDeep : palette.hairline }} />
                <Text className="text-micro text-faint">{label}</Text>
              </View>
            ))}
          </View>
        </View>
        <Label testID="deck-count" className="mt-3">
          {countLine}
        </Label>
        {notApplied ? (
          <Label testID="deck-not-applied" tone="muted" className="mt-1">
            {`${notApplied}. Each row says what the app leaves out.`}
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
        {/* Jump to a heading: the deck stays one list (every row reachable by scrolling), and these shorten the trip. */}
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
    <View accessible={false} importantForAccessibility="no" className="h-7 w-7 items-center justify-center rounded-pill" style={{ backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.hairline }}>
      <Text className="font-display-bold text-label text-bone">{cost ?? "–"}</Text>
    </View>
  );
}
