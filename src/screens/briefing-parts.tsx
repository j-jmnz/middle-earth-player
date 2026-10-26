// What the campaign briefing and the standalone briefing share: the saved decks and the Ring-bearer candidates, the
// scenario's header (stages, difficulty, sets, special rules), the deck filter, and one seat's deck picker with the
// Ring-bearer slot. The picker is the Decks tab's list (user request, 2026-10-25): the same order, views and filters.
import { and, eq, like } from "drizzle-orm";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Text, View } from "react-native";

import type { ScenarioFacts } from "../campaign/briefing";
import { cards, packs } from "../catalog/schema";
import type { Difficulty } from "../catalog/scenario-data";
import { BodyText, Eyebrow, Label, Segmented, TextButton } from "./chrome";
import { editSavedDeck } from "./deck-draft";
import { deckListSpheres, emptyDeckListFilter, filterDecks, useDeckListView, type DeckListFilter } from "./deck-list";
import { DeckListBar } from "./deck-list-bar";
import { deckCountLine, deckReadiness, notAppliedCards, notAppliedLine, type DeckReadiness } from "./deck-status";
import { notAppliedWords } from "../play/not-applied";
import { deckFaces, listDecks, notAppliedIn } from "./deck-store";
import { useDatabases } from "./databases";
import { DeckCover, DeckRow, EmptyHeroSlot, HeroTile, heroFace, type HeroFace } from "./hero-tile";
import { palette } from "./palette.js";
import { starterSeedReason, starterSeedStatus, subscribeStarterSeed, type StarterSeed } from "./starter-decks";

export type SavedDeck = { id: string; name: string; heroes: string[]; cards: { code: string; count: number }[] };

const COVER_HEIGHT = 120;

const DIFFICULTIES = ["Easy", "Normal"] as const;

// What each difficulty changes (ltp.easy-mode, easy-mode.easy-mode), in the briefing under the switch.
const DIFFICULTY_NOTES: Readonly<Record<Difficulty, string>> = {
  Easy: "Easy: each hero starts with 1 resource, and the encounter cards with the gold difficulty border are left out. Good for a first game.",
  Normal: "Normal: the full encounter deck, and no starting resources.",
};

const TOOL_HEIGHT = 120;

/** A saved deck's cards, one code per copy. */
export function expand(deck: SavedDeck | undefined): string[] {
  return deck ? deck.cards.flatMap((card) => Array.from({ length: card.count }, () => card.code)) : [];
}

export type BriefingDecks = {
  savedDecks: SavedDeck[];
  seeded: StarterSeed;
  seedReason: string | null;
  // Fellowship-sphere heroes with the Ring-bearer trait, for the slot. Every saga box prints its own Frodo Baggins, so
  // each is named with the pack it came in.
  candidates: { code: string; name: string; packName: string | null }[];
  faces: ReadonlyMap<string, HeroFace>;
  // Whether each deck is ready to play (rr.deckbuilding): a deck saves before it is, and is not offered until it is.
  readiness: ReadonlyMap<string, DeckReadiness>;
  // The one filter over every seat's list, and the decks it keeps.
  filter: DeckListFilter;
  setFilter: (next: DeckListFilter) => void;
  spheres: { code: string; name: string }[];
  shown: SavedDeck[];
  // The codes whose printed text the app does not apply (src/play/not-applied.ts), and each card's type for its loss words.
  inactive: ReadonlySet<string>;
  typeOf: (code: string) => string | null;
};

/**
 * The saved decks in the Decks tab's order (read again on focus, so a deck finished through Open in Decks comes back
 * ready, and once the starter decks are inserted), the Ring-bearer candidates, the hero faces, readiness and the filter.
 */
export function useBriefingDecks(): BriefingDecks {
  const { catalog, user } = useDatabases();
  // The starter decks are inserted just after launch; read the list again when that finishes.
  const seeded = useSyncExternalStore(subscribeStarterSeed, starterSeedStatus, () => "pending" as const);
  const seedReason = useSyncExternalStore(subscribeStarterSeed, starterSeedReason, () => null);
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  useFocusEffect(
    useCallback(() => {
      setSavedDecks(seeded === "pending" ? [] : listDecks(user));
    }, [seeded, user]),
  );
  const candidates = useMemo(
    () =>
      catalog
        .select({ code: cards.code, name: cards.name, packName: packs.name })
        .from(cards)
        .leftJoin(packs, eq(packs.code, cards.packCode))
        .where(and(eq(cards.typeCode, "hero"), eq(cards.sphereCode, "fellowship"), like(cards.traits, "%Ring-bearer%")))
        .orderBy(cards.code)
        .all(),
    [catalog],
  );
  const faces = useMemo(
    () => deckFaces(catalog, [...candidates.map((card) => card.code), ...savedDecks.flatMap((deck) => [...deck.heroes, ...deck.cards.map((card) => card.code)])]),
    [catalog, candidates, savedDecks],
  );
  const readiness = useMemo(() => new Map(savedDecks.map((deck) => [deck.id, deckReadiness(deck, faces)])), [savedDecks, faces]);
  const [filter, setFilter] = useState<DeckListFilter>(emptyDeckListFilter);
  const spheres = useMemo(() => deckListSpheres(savedDecks, faces), [savedDecks, faces]);
  const shown = useMemo(() => filterDecks(savedDecks, filter, faces, (deck) => readiness.get(deck.id)?.ready ?? false), [savedDecks, filter, faces, readiness]);
  const inactive = useMemo(() => notAppliedIn(faces), [faces]);
  const typeOf = useCallback((code: string) => faces.get(code)?.typeCode ?? null, [faces]);
  return { savedDecks, seeded, seedReason, candidates, faces, readiness, filter, setFilter, spheres, shown, inactive, typeOf };
}

/** The deck list's search, Cards / List switch and filter chips, once above every seat's picker. */
export function DeckFilter({ decks: briefingDecks }: { decks: BriefingDecks }) {
  const { savedDecks, seeded, filter, setFilter, spheres, shown } = briefingDecks;
  if (seeded === "pending" || savedDecks.length === 0) return null;
  return (
    <View className="mt-6">
      <Eyebrow tone="muted">Decks</Eyebrow>
      <DeckListBar filter={filter} onFilter={setFilter} spheres={spheres} shown={shown.length} total={savedDecks.length} testIDPrefix="briefing-decks" />
    </View>
  );
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
      {/* What the difficulty changes, for a first game (ltp.easy-mode, easy-mode.easy-mode). */}
      <Label testID="briefing-difficulty-note" tone="muted" className="mt-1">
        {DIFFICULTY_NOTES[difficulty]}
      </Label>
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
 * One seat: its deck picker (the filtered decks as covers or rows, each a radio; a deck with a fallen hero, or one not
 * ready to play, is shown and cannot be picked; the seat's picked deck stays listed whatever the filter), the picked
 * deck's heroes, and for the first seat the Ring-bearer slot when the deck brings none.
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
  const router = useRouter();
  const view = useDeckListView();
  const { savedDecks, seeded, seedReason, candidates, faces, readiness, shown, setFilter, inactive, typeOf } = briefingDecks;
  const kept = savedDecks.find((deck) => deck.id === picked);
  const pickedDeck = kept ?? null;
  const listed = kept && !shown.includes(kept) ? [kept, ...shown] : shown;
  const faceOf = (code: string): HeroFace => heroFace(faces, code, nameOf(code));
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
          {listed.map((deck) => {
            const fell = deck.heroes.filter((code) => fallen.includes(code));
            const ready = readiness.get(deck.id) ?? { ready: false, text: "Not read yet" };
            const summary = {
              testID: `deck-pick-${index}-${deck.id}`,
              name: deck.name,
              heroes: deck.heroes.map(faceOf),
              detail: deckCountLine(deck),
              status: fell.length > 0 ? { ready: false, text: `${heroNames(fell)} fell and cannot be picked` } : ready,
              note: notAppliedLine(deck, inactive),
              onPress: () => onPick(deck.id),
              selected: picked === deck.id,
              disabled: fell.length > 0 || !ready.ready,
            };
            // A deck that is not ready to play cannot be picked; this opens it to be finished.
            const open =
              !ready.ready && fell.length === 0 ? (
                <View className="items-start px-1">
                  <TextButton
                    label="Open in Decks"
                    testID={`deck-open-${index}-${deck.id}`}
                    tone="gold"
                    accessibilityLabel={`Open ${deck.name} in Decks to finish it`}
                    onPress={() => {
                      editSavedDeck(deck);
                      router.push({ pathname: "/deck/[id]", params: { id: deck.id } });
                    }}
                  />
                </View>
              ) : null;
            return view === "List" ? (
              <DeckRow key={deck.id} {...summary}>
                {open}
              </DeckRow>
            ) : (
              <View key={deck.id} className="pb-3">
                <DeckCover {...summary} height={COVER_HEIGHT}>
                  {open}
                </DeckCover>
              </View>
            );
          })}
          {listed.length === 0 ? (
            <View className="items-start">
              <BodyText tone="muted" testID={`briefing-no-match-${index}`}>
                No decks match.
              </BodyText>
              <View className="-mx-3">
                <TextButton testID={`briefing-clear-filter-${index}`} label="Clear filter" tone="gold" onPress={() => setFilter(emptyDeckListFilter)} />
              </View>
            </View>
          ) : null}
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
      {/* The picked deck names each card whose text the app does not apply, and what that costs: say it before the deal. */}
      {pickedDeck && notAppliedCards(pickedDeck, inactive).length > 0 ? (
        <View testID={`briefing-not-applied-${index}`} className="mt-3">
          <Label tone="muted">Not applied in this deck:</Label>
          <Label tone="muted" className="mt-0.5">
            {notAppliedCards(pickedDeck, inactive)
              .map((card) => `${nameOf(card.code)}: ${notAppliedWords(card.code, typeOf(card.code)).toLowerCase()}`)
              .join(" · ")}
          </Label>
        </View>
      ) : null}
      {picked && slot && !ringBearer ? (
        <View className="mt-2">
          {candidates.map((candidate) => (
            <TextButton key={candidate.code} label={`Choose ${candidate.name}${candidate.packName ? ` (${candidate.packName})` : ""} as Ring-bearer`} testID={`ringbearer-${candidate.code}`} onPress={() => onRingBearer(candidate.code)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
