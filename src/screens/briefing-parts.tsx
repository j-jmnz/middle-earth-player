// What the campaign briefing and the standalone briefing share: the saved decks and the Ring-bearer candidates, the
// scenario's header (stages, difficulty, sets, special rules), and one seat's deck picker with the Ring-bearer slot.
import { and, eq, inArray, like } from "drizzle-orm";
import { useMemo, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";

import type { ScenarioFacts } from "../campaign/briefing";
import { cards } from "../catalog/schema";
import type { Difficulty } from "../catalog/scenario-data";
import { BodyText, Eyebrow, Label, RingMark, Segmented, TextButton, pressedNight } from "./chrome";
import { useDatabases } from "./databases";
import { EmptyHeroSlot, HeroTile, type HeroFace } from "./hero-tile";
import { palette } from "./palette.js";
import { starterSeedReason, starterSeedStatus, subscribeStarterSeed, type StarterSeed } from "./starter-decks";
import { decks } from "./user-schema";

export type SavedDeck = { id: string; name: string; heroes: string[]; cards: { code: string; count: number }[] };

export const DIFFICULTIES = ["Easy", "Normal"] as const;

const TOOL_HEIGHT = 120;

/** A saved deck's cards, one code per copy. */
export function expand(deck: SavedDeck | undefined): string[] {
  return deck ? deck.cards.flatMap((card) => Array.from({ length: card.count }, () => card.code)) : [];
}

export type BriefingDecks = {
  savedDecks: SavedDeck[];
  seeded: StarterSeed;
  seedReason: string | null;
  // Fellowship-sphere heroes with the Ring-bearer trait, for the slot.
  candidates: { code: string; name: string }[];
  faces: ReadonlyMap<string, HeroFace>;
};

/** The saved decks (read again once the starter decks are inserted), the Ring-bearer candidates and the hero faces. */
export function useBriefingDecks(): BriefingDecks {
  const { catalog, user } = useDatabases();
  // The starter decks are inserted just after launch; read the list again when that finishes.
  const seeded = useSyncExternalStore(subscribeStarterSeed, starterSeedStatus, () => "pending" as const);
  const seedReason = useSyncExternalStore(subscribeStarterSeed, starterSeedReason, () => null);
  const savedDecks = useMemo<SavedDeck[]>(
    () => (seeded === "pending" ? [] : user.select({ id: decks.id, name: decks.name, heroes: decks.heroes, cards: decks.cards }).from(decks).all()),
    [user, seeded],
  );
  const candidates = useMemo(
    () => catalog.select({ code: cards.code, name: cards.name }).from(cards).where(and(eq(cards.typeCode, "hero"), eq(cards.sphereCode, "fellowship"), like(cards.traits, "%Ring-bearer%"))).all(),
    [catalog],
  );
  const faces = useMemo(() => {
    const codes = [...new Set([...candidates.map((card) => card.code), ...savedDecks.flatMap((deck) => deck.heroes)])];
    if (codes.length === 0) return new Map<string, HeroFace>();
    const rows = catalog
      .select({ code: cards.code, name: cards.name, sphereCode: cards.sphereCode, sphereName: cards.sphereName, imagesrc: cards.imagesrc })
      .from(cards)
      .where(inArray(cards.code, codes))
      .all();
    return new Map(rows.map((row) => [row.code, row]));
  }, [catalog, candidates, savedDecks]);
  return { savedDecks, seeded, seedReason, candidates, faces };
}

/** The scenario: its number, name and stages, the difficulty, the encounter sets with their counts, and its special rules. */
export function ScenarioHeader({ facts, difficulty, onDifficulty, eyebrow }: { facts: ScenarioFacts; difficulty: Difficulty; onDifficulty: (next: Difficulty) => void; eyebrow: string }) {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text accessibilityRole="header" testID="briefing-title" className="mt-1 font-display text-display text-bone">
        {facts.name}
      </Text>
      <Text testID="briefing-stages" className="mt-3 text-body text-bone">
        {facts.stages.join(" › ")}
      </Text>
      <View className="mt-4 flex-row items-center justify-between">
        <Segmented options={DIFFICULTIES} value={difficulty} onChange={onDifficulty} testIDPrefix="difficulty" />
        <Label className="ml-3">{`${facts.deckSize} encounter cards`}</Label>
      </View>
      <View testID="briefing-sets" className="mt-3 gap-1">
        {facts.sets.map((set) => (
          <Label key={set.name} tone="muted">{`${set.name} · ${set.count}`}</Label>
        ))}
      </View>
      {facts.rules.length > 0 ? (
        <View testID="briefing-rules" className="mt-3 flex-row flex-wrap gap-2">
          {facts.rules.map((rule) => (
            <View key={rule} className="rounded-pill px-3 py-1" style={{ borderWidth: 1, borderColor: palette.gold }}>
              <Text className="text-label text-gold">{rule}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

/**
 * One seat: its deck picker (a radio list of the saved decks; a deck with a fallen hero is shown and cannot be picked),
 * the picked deck's heroes, and for the first seat the Ring-bearer slot when the deck brings none.
 */
export function SeatPicker({
  index,
  seatCount,
  decks: briefingDecks,
  picked,
  heroes,
  fallen,
  needsRingBearer,
  ringBearer,
  onPick,
  onRingBearer,
  nameOf,
}: {
  index: number;
  seatCount: number;
  decks: BriefingDecks;
  picked: string | null;
  heroes: readonly string[];
  // Heroes the campaign log lists as fallen; none in a standalone game.
  fallen: readonly string[];
  needsRingBearer: boolean;
  ringBearer: string | null;
  onPick: (deckId: string) => void;
  onRingBearer: (code: string | null) => void;
  nameOf: (code: string) => string;
}) {
  const { savedDecks, seeded, seedReason, candidates, faces } = briefingDecks;
  const faceOf = (code: string): HeroFace => faces.get(code) ?? { code, name: nameOf(code), sphereCode: null, sphereName: null, imagesrc: null };
  const heroNames = (codes: readonly string[]) => codes.map(nameOf).join(", ");
  const slot = index === 0 && needsRingBearer;
  return (
    <View className="mt-6">
      <Eyebrow tone="muted">{seatCount === 1 ? "Deck" : `Seat ${index + 1}`}</Eyebrow>
      {seeded === "pending" ? (
        <BodyText tone="muted" className="mt-2">
          Loading
        </BodyText>
      ) : savedDecks.length === 0 ? (
        <View className="mt-2 gap-2">
          <BodyText tone={seeded === "missing" ? "danger" : "muted"} testID="briefing-no-deck">
            {seeded === "missing" ? "The starter decks are missing. Save a deck in Decks first." : "No saved deck. Save one in Decks first."}
          </BodyText>
          {seeded === "missing" && seedReason ? (
            <BodyText tone="danger" testID="briefing-starter-reason">
              {seedReason}
            </BodyText>
          ) : null}
        </View>
      ) : (
        <View className="mt-2">
          {savedDecks.map((deck) => {
            const selected = picked === deck.id;
            const fell = deck.heroes.filter((code) => fallen.includes(code));
            return (
              <Pressable
                key={deck.id}
                testID={`deck-pick-${index}-${deck.id}`}
                collapsable={false}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: fell.length > 0 }}
                disabled={fell.length > 0}
                onPress={() => onPick(deck.id)}
                className="min-h-14 flex-row items-center gap-3 border-b border-hairline py-2"
                style={({ pressed }) => (pressed ? pressedNight : undefined)}
              >
                {/* The selected deck is a filled ring and the others an empty one, so the mark does not rest on color. */}
                <RingMark size={14} state={selected ? "done" : "locked"} />
                <View className="flex-1">
                  <Text className={selected ? "text-body font-semibold text-gold" : fell.length > 0 ? "text-body text-faint" : "text-body text-bone"}>{deck.name}</Text>
                  <Text className="text-label text-muted">{fell.length > 0 ? `${heroNames(fell)} fell and cannot be picked` : heroNames(deck.heroes)}</Text>
                </View>
                {selected ? <Text className="text-label text-gold">Selected</Text> : null}
              </Pressable>
            );
          })}
        </View>
      )}
      {picked ? (
        <View className="mt-3 flex-row gap-2">
          {heroes.map((code) => (
            <HeroTile key={code} hero={faceOf(code)} height={TOOL_HEIGHT} dense />
          ))}
          {slot ? (
            ringBearer ? (
              <HeroTile hero={faceOf(ringBearer)} height={TOOL_HEIGHT} dense onRemove={() => onRingBearer(null)} />
            ) : (
              <View testID="ringbearer-slot" className="flex-1">
                <EmptyHeroSlot height={TOOL_HEIGHT} label="Ring-bearer" />
              </View>
            )
          ) : null}
        </View>
      ) : null}
      {picked && slot && !ringBearer ? (
        <View className="mt-2">
          {candidates.map((candidate) => (
            <TextButton key={candidate.code} label={`Choose ${candidate.name} as Ring-bearer`} testID={`ringbearer-${candidate.code}`} onPress={() => onRingBearer(candidate.code)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
