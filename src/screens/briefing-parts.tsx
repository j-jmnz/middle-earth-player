// What the campaign briefing and the standalone briefing share: the screen's frame (the scenario's scene under a floating Back and
// Booklet), the saved decks and the Ring-bearer candidates, the scenario's details (stages, difficulty, sets, special rules) and the
// pinned Deal bar. One seat's fellowship is seat-picker.tsx.
import { and, eq, like } from "drizzle-orm";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Problem, ScenarioFacts } from "../campaign/briefing";
import { cards, packs } from "../catalog/schema";
import type { Difficulty } from "../catalog/scenario-data";
import { GroundedScene } from "./art";
import { dealSentence, problemWords } from "./briefing-words";
import { ActionBar, Chevron, Chip, Column, FloatingBarShade, IconButton, Label, NavBar, PrimaryButton, Screen, Section, Segmented, TwoPane, useTitleShadow } from "./chrome";
import { BRIEFING_SCENE_RANGE } from "./briefing-layout";
import { deckListSpheres, emptyDeckListFilter, filterDecks, type DeckListFilter } from "./deck-list";
import { deckReadiness, type DeckReadiness } from "./deck-status";
import { deckFaces, listDecks, notAppliedIn } from "./deck-store";
import { useDatabases } from "./databases";
import type { HeroFace } from "./hero-tile";
import { usePalette } from "./palette-hook";
import { starterSeedReason, starterSeedStatus, subscribeStarterSeed, type StarterSeed } from "./starter-decks";
import { capWidth } from "../play/size-class";
import { useTheme } from "../play/theme";
import { useSizeClass } from "../play/use-size-class";
import { Text } from "../play/text";

export type SavedDeck = { id: string; name: string; heroes: string[]; cards: { code: string; count: number }[] };

const DIFFICULTIES = ["Easy", "Normal"] as const;

// What each difficulty changes (ltp.easy-mode, easy-mode.easy-mode), in the briefing under the switch.
const DIFFICULTY_NOTES: Readonly<Record<Difficulty, string>> = {
  Easy: "Easy: each hero starts with 1 resource, and the encounter cards with the gold difficulty border are left out. Good for a first game.",
  Normal: "Normal: the full encounter deck, and no starting resources.",
};

const BANNER_HEIGHT = 330;

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
export function useBriefingDecks(saga: boolean): BriefingDecks {
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
  // The Ring-bearer candidates belong to a saga campaign; outside one the briefing has no such slot.
  const candidates = useMemo(
    () =>
      !saga
        ? []
        : catalog
        .select({ code: cards.code, name: cards.name, packName: packs.name })
        .from(cards)
        .leftJoin(packs, eq(packs.code, cards.packCode))
        .where(and(eq(cards.typeCode, "hero"), eq(cards.sphereCode, "fellowship"), like(cards.traits, "%Ring-bearer%")))
        .orderBy(cards.code)
        .all(),
    [catalog, saga],
  );
  const faces = useMemo(
    () => deckFaces(catalog, [...candidates.map((card) => card.code), ...savedDecks.flatMap((deck) => [...deck.heroes, ...deck.cards.map((card) => card.code)])]),
    [catalog, candidates, savedDecks],
  );
  const readiness = useMemo(() => new Map(savedDecks.map((deck) => [deck.id, deckReadiness(deck, faces, saga)])), [savedDecks, faces, saga]);
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
  aside,
  bar,
}: {
  testID: string;
  scenarioId: string | null;
  onBack: () => void;
  backLabel?: string;
  // Left out when there is no book to open (no playthrough or campaign yet): the button is not shown.
  onBooklet?: () => void;
  // The words over the scene (ScenarioBanner); null while the scenario is loading or missing.
  banner: ReactNode;
  children: ReactNode;
  // The reference matter (Before the deal, the encounter): after the content in compact and medium, under the scene when expanded.
  aside?: ReactNode;
  bar?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { size, s } = useSizeClass();
  const side = { paddingLeft: 24 * s + insets.left, paddingRight: 24 * s + insets.right };
  // Past the scene, a night bar shows behind Back and Booklet so they never sit on the words that scroll under them. The shade
  // belongs to the layout whose scroll set it: a window crossing 840 pt remounts the scroll, so the other layout starts clear.
  const expanded = size === "expanded";
  const [shade, setShade] = useState({ expanded, past: false });
  const past = shade.expanded === expanded && shade.past;
  const threshold = (BANNER_HEIGHT - 80) * s;
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > threshold;
    if (next !== past) setShade({ expanded, past: next });
  };
  // Medium keeps the phone's order in a reading column under the full-width scene.
  const cap = capWidth(size, "readable", s);
  const column = cap == null || expanded ? undefined : ({ width: "100%", maxWidth: cap, alignSelf: "center" } as const);
  const scene = (
    // Met to the ground at its foot, and in two panes at its right edge too, so it ends in the fog with no line (GroundedScene).
    <GroundedScene scenarioId={scenarioId} height={(expanded ? 560 : BANNER_HEIGHT) * s + insets.top} shade={0.4} fade={0.25} edge={expanded}>
      <View className="absolute bottom-0 left-0 right-0 pb-2" style={expanded ? { ...side, paddingRight: 24 * s } : side}>
        {column ? <View style={column}>{banner}</View> : banner}
      </View>
    </GroundedScene>
  );
  const navBar = (
    <View pointerEvents="box-none" className="absolute left-0 right-0" style={{ top: insets.top, paddingLeft: 16 * s + insets.left, paddingRight: expanded ? 16 * s : 16 * s + insets.right }}>
      <NavBar overlay onBack={onBack} backTestID="briefing-back" backLabel={backLabel} right={onBooklet ? <IconButton overlay icon="lore" label="Open the booklet" testID="booklet-open" onPress={onBooklet} /> : undefined} />
    </View>
  );

  // Expanded: the scene, Back, Booklet and the aside are the pane at the left (the shade and the buttons scoped to it); the choices
  // and the Deal bar are the pane at the right, the bar pinned at its foot.
  if (expanded) {
    const trailing = 24 * s + insets.right;
    return (
      <Screen testID={testID} scene="moon" bleed>
        <TwoPane
          kind="supporting"
          range={BRIEFING_SCENE_RANGE}
          start={
            <>
              <ScrollView className="min-h-0 flex-1" contentContainerStyle={{ paddingBottom: 24 * s }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEventThrottle={64} onScroll={onScroll}>
                {scene}
                {aside ? <View style={{ paddingLeft: side.paddingLeft, paddingRight: 24 * s }}>{aside}</View> : null}
              </ScrollView>
              <FloatingBarShade shown={past} top={insets.top} />
              {navBar}
            </>
          }
          end={
            <>
              <ScrollView className="min-h-0 flex-1" contentContainerStyle={{ paddingTop: insets.top + 8 * s, paddingBottom: 24 * s, paddingRight: trailing }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Column>{children}</Column>
              </ScrollView>
              {bar ? (
                <View style={{ paddingRight: trailing }}>
                  <ActionBar testID="briefing-deal-bar" align="fill">
                    {bar}
                  </ActionBar>
                </View>
              ) : null}
            </>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen testID={testID} scene="moon" bleed>
      <ScrollView className="min-h-0 flex-1" contentContainerStyle={{ paddingBottom: 24 * s }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEventThrottle={64} onScroll={onScroll}>
        {scene}
        <View style={side}>
          {column ? (
            <View style={column}>
              {children}
              {aside}
            </View>
          ) : (
            <>
              {children}
              {aside}
            </>
          )}
        </View>
      </ScrollView>
      {bar ? (
        <View style={side}>
          <ActionBar testID="briefing-deal-bar">{bar}</ActionBar>
        </View>
      ) : null}
      <FloatingBarShade shown={past} top={insets.top} />
      {navBar}
    </Screen>
  );
}

/** Over the scene: an overline with the scenario's number and its campaign, its name large, and its stages in order as chips. */
export function ScenarioBanner({ facts, eyebrow }: { facts: ScenarioFacts; eyebrow: string }) {
  const palette = usePalette();
  const titleShadow = useTitleShadow();
  const light = useTheme() === "light";
  const { size, s } = useSizeClass();
  const big = size === "compact" ? 36 : 56;
  return (
    <>
      {/* Every word over the scene carries the title's shadow: a long name pushes the overline up into the bright sky. */}
      {/* Light's moon is too faint over a picture: the overline there is ink. */}
      <Text className={`font-bold text-eyebrow uppercase ${light ? "text-bone" : "text-moon"}`} style={titleShadow}>
        {eyebrow}
      </Text>
      <Text accessibilityRole="header" testID="briefing-title" className="mt-1 font-display text-bone" style={{ fontSize: big * s, lineHeight: big * 1.12 * s, ...titleShadow }}>
        {facts.name}
      </Text>
      <View testID="briefing-stages" accessible accessibilityLabel={`Stages: ${facts.stages.join(", ")}`} className="mt-3 flex-row flex-wrap items-center gap-x-1.5 gap-y-1.5">
        {facts.stages.map((stage, index) => (
          <View key={`${stage}:${index}`} className="flex-row items-center gap-1.5">
            {/* The chevron trails its chip, so a wrapped line never opens on one. */}
            <Chip label={`${index + 1} ${stage}`} onArt />
            {index < facts.stages.length - 1 ? <Chevron direction="right" color={palette.faint} size={6} /> : null}
          </View>
        ))}
      </View>
    </>
  );
}

/** The difficulty, with what it changes and the encounter deck's size beside its heading. */
export function DifficultyPicker({ facts, difficulty, onDifficulty }: { facts: ScenarioFacts; difficulty: Difficulty; onDifficulty: (next: Difficulty) => void }) {
  return (
    <>
      <Section title="Difficulty" className="mt-4" right={<Chip label={`${facts.deckSize} encounter cards`} />} />
      <Segmented options={DIFFICULTIES} value={difficulty} onChange={onDifficulty} testIDPrefix="difficulty" stretch />
      {/* What the difficulty changes, for a first game (ltp.easy-mode, easy-mode.easy-mode). */}
      <Label testID="briefing-difficulty-note" tone="muted" className="mt-2">
        {DIFFICULTY_NOTES[difficulty]}
      </Label>
    </>
  );
}

/** The encounter sets with their counts, and the scenario's special rules as tags (words to read, not controls). */
export function EncounterDetails({ facts }: { facts: ScenarioFacts }) {
  return (
    <>
      <Section title="The encounter" className="mt-5" />
      <View testID="briefing-sets" className="gap-1.5">
        {facts.sets.map((set) => (
          <View key={set.name} className="flex-row items-center justify-between">
            <Text className="text-body text-bone">{set.name}</Text>
            <Text className="font-display text-body text-muted">{String(set.count)}</Text>
          </View>
        ))}
      </View>
      {facts.rules.length > 0 ? (
        <View testID="briefing-rules" className="mt-3 flex-row flex-wrap gap-2">
          {facts.rules.map((rule) => (
            <Chip key={rule} label={rule} />
          ))}
        </View>
      ) : null}
    </>
  );
}

/**
 * The briefing's Deal bar: the validator's sentences in danger (without collector codes), any extra control (the campaign's
 * Accept +1 threat), the sentence naming the difficulty and what Deal does, and DEAL, disabled until the loadout is legal.
 */
export function DealBar({
  problems,
  dealError,
  difficulty,
  dropsOpen = false,
  dealable,
  waiting = null,
  onDeal,
  children,
}: {
  problems: readonly Problem[];
  dealError: string | null;
  difficulty: Difficulty;
  dropsOpen?: boolean;
  dealable: boolean;
  // What the disabled Deal waits for (a choice the campaign card asks above), in a sentence of its own.
  waiting?: string | null;
  onDeal: () => void;
  children?: ReactNode;
}) {
  return (
    <View className="gap-2">
      {problems.map((problem, index) => (
        <Label key={`${index}-${problem.message}`} tone="danger" testID={`briefing-error-${index}`}>
          {problemWords(problem)}
        </Label>
      ))}
      {dealError ? (
        <Label tone="danger" testID="briefing-deal-error">
          {dealError}
        </Label>
      ) : null}
      {children}
      <Label tone="muted" testID="briefing-deal-note" className="text-center">
        {waiting ?? dealSentence(difficulty, dropsOpen)}
      </Label>
      <PrimaryButton label="Deal" testID="deal" disabled={!dealable} onPress={onDeal} />
    </View>
  );
}
