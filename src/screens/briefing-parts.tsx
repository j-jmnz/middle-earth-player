// What the campaign briefing and the standalone briefing share: the screen's frame (the scenario's scene under a floating Back and
// Booklet, the pinned Deal bar), the saved decks and the Ring-bearer candidates, the scenario's details (stages, difficulty,
// sets, special rules), and one seat's fellowship: the picked deck as a party card, or, until one is picked or while it is being
// changed, the Decks tab's list (user request, 2026-10-25): the same order, views and filters.
import { and, eq, like } from "drizzle-orm";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ScenarioFacts } from "../campaign/briefing";
import { cards, packs } from "../catalog/schema";
import type { Difficulty } from "../catalog/scenario-data";
import { nightFade, panelSurface, topShade } from "../play/surfaces";
import { Portrait, SceneArt } from "./art";
import { ActionBar, BodyText, Chevron, Chip, Corners, Eyebrow, FloatingBarShade, IconButton, Label, NavBar, Screen, Section, Segmented, SecondaryButton, TextButton } from "./chrome";
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

const COVER_HEIGHT = 112;

const DIFFICULTIES = ["Easy", "Normal"] as const;

// What each difficulty changes (ltp.easy-mode, easy-mode.easy-mode), in the briefing under the switch.
const DIFFICULTY_NOTES: Readonly<Record<Difficulty, string>> = {
  Easy: "Easy: each hero starts with 1 resource, and the encounter cards with the gold difficulty border are left out. Good for a first game.",
  Normal: "Normal: the full encounter deck, and no starting resources.",
};

const TOOL_HEIGHT = 124;
const BANNER_HEIGHT = 280;

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

/**
 * The briefing's frame. The scenario's scene runs under the status bar at the top, with Back and Booklet floating over it so
 * they stay in reach as the page scrolls; the content scrolls under them; the Deal bar is pinned at the foot in thumb reach.
 */
export function BriefingScreen({
  testID,
  scenarioId,
  onBack,
  backLabel,
  onBooklet,
  banner,
  children,
  bar,
}: {
  testID: string;
  scenarioId: string | null;
  onBack: () => void;
  backLabel?: string;
  onBooklet: () => void;
  // The words over the scene (ScenarioBanner); null while the scenario is loading or missing.
  banner: ReactNode;
  children: ReactNode;
  bar?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const side = { paddingLeft: 24 + insets.left, paddingRight: 24 + insets.right };
  // Past the scene, a night bar shows behind Back and Booklet so they never sit on the words that scroll under them.
  const [past, setPast] = useState(false);
  const threshold = BANNER_HEIGHT - 80;
  return (
    <Screen testID={testID} scene="vale" bleed>
      <ScrollView
        className="min-h-0 flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={64}
        onScroll={(event) => {
          const next = event.nativeEvent.contentOffset.y > threshold;
          if (next !== past) setPast(next);
        }}
      >
        <SceneArt scenarioId={scenarioId} height={BANNER_HEIGHT + insets.top}>
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...topShade(0.4) }} />
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...nightFade(0.3, 1) }} />
          <View className="absolute bottom-0 left-0 right-0 pb-2" style={side}>
            {banner}
          </View>
        </SceneArt>
        <View style={side}>{children}</View>
      </ScrollView>
      {bar ? (
        <View style={side}>
          <ActionBar testID="briefing-deal-bar">{bar}</ActionBar>
        </View>
      ) : null}
      <FloatingBarShade shown={past} top={insets.top} />
      <View className="absolute left-0 right-0" style={{ top: insets.top, paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right }}>
        <NavBar overlay onBack={onBack} backTestID="briefing-back" backLabel={backLabel} right={<IconButton overlay icon="lore" label="Open the booklet" testID="booklet-open" onPress={onBooklet} />} />
      </View>
    </Screen>
  );
}

/** Over the scene: the scenario's number, its name and its stages in order. */
export function ScenarioBanner({ facts, eyebrow }: { facts: ScenarioFacts; eyebrow: string }) {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text accessibilityRole="header" testID="briefing-title" className="mt-1 font-display text-display text-bone" style={{ textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 14, textShadowOffset: { width: 0, height: 2 } }}>
        {facts.name}
      </Text>
      <View testID="briefing-stages" accessible accessibilityLabel={`Stages: ${facts.stages.join(", ")}`} className="mt-3 flex-row flex-wrap items-center gap-x-2 gap-y-1.5">
        {facts.stages.map((stage, index) => (
          <View key={`${stage}:${index}`} className="flex-row items-center gap-2">
            {index > 0 ? <Chevron direction="right" color={palette.faint} size={6} /> : null}
            <View className="h-5 w-5 items-center justify-center rounded-pill" style={{ borderWidth: 1, borderColor: palette.goldLine }}>
              <Text className="font-display-bold text-micro text-gold">{String(index + 1)}</Text>
            </View>
            <Text className="text-label text-bone">{stage}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

/** The difficulty, with what it changes and the encounter deck's size, then the encounter sets and the special rules. */
export function ScenarioDetails({ facts, difficulty, onDifficulty }: { facts: ScenarioFacts; difficulty: Difficulty; onDifficulty: (next: Difficulty) => void }) {
  return (
    <>
      <Section title="Difficulty" className="mt-5" right={<Chip label={`${facts.deckSize} encounter cards`} />} />
      <Segmented options={DIFFICULTIES} value={difficulty} onChange={onDifficulty} testIDPrefix="difficulty" stretch />
      {/* What the difficulty changes, for a first game (ltp.easy-mode, easy-mode.easy-mode). */}
      <Label testID="briefing-difficulty-note" tone="muted" className="mt-2">
        {DIFFICULTY_NOTES[difficulty]}
      </Label>
      <Section title="The encounter" className="mt-5" />
      <View testID="briefing-sets" className="gap-1.5">
        {facts.sets.map((set) => (
          <View key={set.name} className="flex-row items-center justify-between">
            <Text className="text-body text-bone">{set.name}</Text>
            <Text className="font-display-bold text-body text-muted">{String(set.count)}</Text>
          </View>
        ))}
      </View>
      {facts.rules.length > 0 ? (
        <View testID="briefing-rules" className="mt-3 flex-row flex-wrap gap-2">
          {facts.rules.map((rule) => (
            <Chip key={rule} tone="gold" label={rule} />
          ))}
        </View>
      ) : null}
    </>
  );
}

/**
 * One seat's fellowship. Until a deck is picked, and while it is being changed, the seat lists the saved decks with the Decks
 * tab's search and chips, each a radio (a deck with a fallen hero, or one not ready to play, is shown and cannot be picked; the
 * seat's picked deck stays listed whatever the filter). Picked, it folds to a framed party card: the deck, its heroes as
 * pictures, the Ring-bearer, and Change. For the first seat the Ring-bearer slot shows when the deck brings none.
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
  const [changing, setChanging] = useState(false);
  const { savedDecks, seeded, seedReason, candidates, faces, readiness, filter, setFilter, spheres, shown, inactive, typeOf } = briefingDecks;
  const kept = savedDecks.find((deck) => deck.id === picked);
  const pickedDeck = kept ?? null;
  const listed = kept && !shown.includes(kept) ? [kept, ...shown] : shown;
  const faceOf = (code: string): HeroFace => heroFace(faces, code, nameOf(code));
  const heroNames = (codes: readonly string[]) => codes.map(nameOf).join(", ");
  const slot = index === 0 && needsRingBearer;
  const choosing = !pickedDeck || changing;
  const title = seatCount === 1 ? "Your fellowship" : `Seat ${index + 1}`;
  // A Ring-bearer the deck brings itself is one of the candidates (a Fellowship hero with the Ring-bearer trait).
  const carries = (code: string) => candidates.some((candidate) => candidate.code === code);

  function choose(deckId: string): void {
    onPick(deckId);
    setChanging(false);
  }

  return (
    <View className="mt-5">
      <Section
        title={title}
        right={pickedDeck && changing ? <TextButton label="Done" testID={`deck-choose-done-${index}`} tone="muted" accessibilityLabel={`Keep ${pickedDeck.name}`} onPress={() => setChanging(false)} /> : null}
      />
      {seeded === "pending" ? (
        <BodyText tone="muted">Loading</BodyText>
      ) : savedDecks.length === 0 ? (
        <View className="gap-2">
          <BodyText tone={seeded === "missing" ? "danger" : "muted"} testID="briefing-no-deck">
            {seeded === "missing" ? "The starter decks are missing. Save a deck in Decks first." : "No saved deck. Save one in Decks first."}
          </BodyText>
          {seeded === "missing" && seedReason ? (
            <BodyText tone="danger" testID="briefing-starter-reason">
              {seedReason}
            </BodyText>
          ) : null}
        </View>
      ) : choosing ? (
        <View>
          <Label>{pickedDeck ? "Pick another deck for this seat." : "Choose the deck this seat plays."}</Label>
          <DeckListBar filter={filter} onFilter={setFilter} spheres={spheres} shown={shown.length} total={savedDecks.length} testIDPrefix={`briefing-decks-${index}`} />
          <View className="mt-3">
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
                onPress: () => choose(deck.id),
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
        </View>
      ) : (
        <View testID={`briefing-party-${index}`} className="rounded-card p-4" style={{ ...panelSurface(), borderWidth: 1, borderColor: palette.goldLine }}>
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="font-display text-title text-bone">{pickedDeck.name}</Text>
              <Label>{deckCountLine(pickedDeck)}</Label>
            </View>
            <SecondaryButton label="Change" testID={`deck-change-${index}`} compact accessibilityLabel={`Change the deck of ${title.toLowerCase()}, now ${pickedDeck.name}`} onPress={() => setChanging(true)} />
          </View>
          <View className="mt-3.5 flex-row gap-2">
            {heroes.map((code) => (
              <HeroTile key={code} hero={faceOf(code)} height={TOOL_HEIGHT} dense ringBearer={!slot && carries(code)} />
            ))}
            {slot ? (
              ringBearer ? (
                <HeroTile hero={faceOf(ringBearer)} height={TOOL_HEIGHT} dense ringBearer onRemove={() => onRingBearer(null)} />
              ) : (
                <View testID="ringbearer-slot" className="flex-1">
                  <EmptyHeroSlot height={TOOL_HEIGHT} label="Ring-bearer" />
                </View>
              )
            ) : null}
          </View>
          {/* The picked deck names each card whose text the app does not apply, and what that costs: say it before the deal. */}
          {notAppliedCards(pickedDeck, inactive).length > 0 ? (
            <View testID={`briefing-not-applied-${index}`} className="mt-3">
              <Label tone="muted">Not applied in this deck:</Label>
              <Label tone="muted" className="mt-0.5">
                {notAppliedCards(pickedDeck, inactive)
                  .map((card) => `${nameOf(card.code)}: ${notAppliedWords(card.code, typeOf(card.code)).toLowerCase()}`)
                  .join(" · ")}
              </Label>
            </View>
          ) : null}
          <Corners />
        </View>
      )}
      {pickedDeck && !choosing && slot && !ringBearer ? (
        <View className="mt-3">
          <Label>Choose the Ring-bearer</Label>
          <View className="mt-1.5 gap-2">
            {candidates.map((candidate) => (
              <Pressable
                key={candidate.code}
                testID={`ringbearer-${candidate.code}`}
                collapsable={false}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${candidate.name}${candidate.packName ? ` (${candidate.packName})` : ""} as Ring-bearer`}
                onPress={() => onRingBearer(candidate.code)}
              >
                {({ pressed }) => (
                  <View className="min-h-14 flex-row items-center gap-3 rounded-tile px-3 py-2" style={{ ...panelSurface(pressed), borderWidth: 1, borderColor: palette.hairline }}>
                    <Portrait card={faceOf(candidate.code)} size={36} />
                    <View className="flex-1">
                      <Text className="font-display text-heading text-bone">{candidate.name}</Text>
                      {candidate.packName ? <Text className="text-label text-muted">{candidate.packName}</Text> : null}
                    </View>
                    <Text className="font-display-bold text-label text-gold">Choose</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
