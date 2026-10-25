import { and, eq, like } from "drizzle-orm";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { ScrollView, Text, View } from "react-native";

import { briefing, scenarioFacts, type BriefingInput, type BriefingSeat } from "../../../../campaign/briefing";
import { deal } from "../../../../campaign/session";
import { logCodes, loadWorld } from "../../../../campaign/world";
import { cards } from "../../../../catalog/schema";
import type { Difficulty } from "../../../../catalog/scenario-data";
import { CATALOG_VERSION } from "../../../../catalog/version";
import { EFFECTS } from "../../../../effects";
import { BodyText, Eyebrow, Label, NavBar, PrimaryButton, Screen, Segmented, TextButton } from "../../../chrome";
import { FELLOWSHIP_ID } from "../../../../campaign/save";
import { bookletParams, campaignOf, scenarioOf } from "../../../campaign-data";
import { goBack } from "../../../go-back";
import { writeSave } from "../../../campaign-store";
import { useDatabases } from "../../../databases";
import { dealSeed } from "../../../e2e";
import { DeckCover, DeckRow, EmptyHeroSlot, HeroTile, heroFace, type HeroFace } from "../../../hero-tile";
import { palette } from "../../../palette.js";
import { routeCode } from "../../../route-code";
import { starterSeedReason, starterSeedStatus, subscribeStarterSeed } from "../../../starter-decks";
import { deckCountLine, deckReadiness } from "../../../deck-status";
import { deckListSpheres, emptyDeckListFilter, filterDecks, useDeckListView, type DeckListFilter } from "../../../deck-list";
import { DeckListBar } from "../../../deck-list-bar";
import { editSavedDeck } from "../../../deck-draft";
import { deckFaces, listDecks } from "../../../deck-store";
import { useSave } from "../../../use-save";

type SavedDeck = { id: string; name: string; heroes: string[]; cards: { code: string; count: number }[] };

const DIFFICULTIES = ["Easy", "Normal"] as const;
const COVER_HEIGHT = 120;

function expand(deck: SavedDeck | undefined): string[] {
  return deck ? deck.cards.flatMap((card) => Array.from({ length: card.count }, () => card.code)) : [];
}

export default function Briefing() {
  const router = useRouter();
  const params = useLocalSearchParams<{ saveId: string; scenarioId: string }>();
  const saveId = routeCode(params.saveId);
  const scenarioId = routeCode(params.scenarioId);
  const { catalog, user } = useDatabases();
  const { save, loaded } = useSave(saveId ?? undefined);

  const [difficulty, setDifficulty] = useState<Difficulty>("Normal");
  const [picked, setPicked] = useState<readonly (string | null)[]>([null, null]);
  const [ringBearer, setRingBearer] = useState<string | null>(null);
  const [choices, setChoices] = useState<readonly string[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [dealError, setDealError] = useState<string | null>(null);

  const campaign = save ? campaignOf(save.campaignId) : null;
  const scenario = scenarioId ? scenarioOf(scenarioId) : null;
  // The starter decks are inserted just after launch; read the list again when that finishes.
  const seeded = useSyncExternalStore(subscribeStarterSeed, starterSeedStatus, () => "pending");
  const seedReason = useSyncExternalStore(subscribeStarterSeed, starterSeedReason, () => null);
  // In the Decks tab's order: the deck saved last first, then the starters. Read again on focus: Open in Decks edits one.
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  useFocusEffect(
    useCallback(() => {
      setSavedDecks(seeded === "pending" ? [] : listDecks(user));
    }, [seeded, user]),
  );
  const candidates = useMemo(
    () => catalog.select({ code: cards.code, name: cards.name }).from(cards).where(and(eq(cards.typeCode, "hero"), eq(cards.sphereCode, "fellowship"), like(cards.traits, "%Ring-bearer%"))).all(),
    [catalog],
  );

  const seatCount = save?.seatCount ?? 1;
  const seats: BriefingSeat[] = useMemo(
    () =>
      Array.from({ length: seatCount }, (_, index) => {
        const deck = savedDecks.find((item) => item.id === picked[index]);
        return { deckId: deck?.id ?? null, heroes: deck?.heroes ?? [], deck: expand(deck) };
      }),
    [seatCount, savedDecks, picked],
  );

  const faces = useMemo(() => deckFaces(catalog, [...candidates.map((card) => card.code), ...savedDecks.flatMap((deck) => deck.heroes)]), [catalog, candidates, savedDecks]);

  // A deck saves before it is ready to play; the picker does not offer one that breaks a deckbuilding rule (rr.deckbuilding).
  const readiness = useMemo(() => {
    const facts = deckFaces(catalog, savedDecks.flatMap((deck) => [...deck.heroes, ...deck.cards.map((card) => card.code)]));
    return new Map(savedDecks.map((deck) => [deck.id, deckReadiness(deck, facts)]));
  }, [catalog, savedDecks]);

  // The picker filters and shows decks as the Decks tab does. A seat's picked deck stays in its list whatever the filter.
  const [filter, setFilter] = useState<DeckListFilter>(emptyDeckListFilter);
  const view = useDeckListView();
  const spheres = useMemo(() => deckListSpheres(savedDecks, faces), [savedDecks, faces]);
  const shownDecks = useMemo(
    () => filterDecks(savedDecks, filter, faces, (deck) => readiness.get(deck.id)?.ready ?? false),
    [savedDecks, filter, faces, readiness],
  );
  function seatDecks(seat: number): SavedDeck[] {
    const kept = savedDecks.find((deck) => deck.id === picked[seat]);
    return kept && !shownDecks.includes(kept) ? [kept, ...shownDecks] : shownDecks;
  }

  const world = useMemo(() => {
    if (!save || !campaign || !scenario) return null;
    const extra = [...logCodes(save.log), ...candidates.map((card) => card.code), ...savedDecks.flatMap((deck) => deck.heroes), ...seats.flatMap((seat) => seat.deck)];
    return loadWorld(catalog, campaign, scenario, EFFECTS, extra);
  }, [catalog, save, campaign, scenario, candidates, savedDecks, seats]);

  const input: BriefingInput | null = useMemo(
    () => (save && world ? { world, log: save.log, seatCount: save.seatCount, seats, ringBearer, difficulty, choices, acceptPenalty: accepted } : null),
    [save, world, seats, ringBearer, difficulty, choices, accepted],
  );
  const result = useMemo(() => (input ? briefing(input) : null), [input]);
  const facts = useMemo(() => (world ? scenarioFacts(world, difficulty) : null), [world, difficulty]);

  const back = (
    <NavBar
      onBack={() => goBack(router, saveId ? { pathname: "/path/[saveId]", params: { saveId } } : "/")}
      backTestID="briefing-back"
      right={<TextButton label="Booklet" accessibilityLabel="Open the booklet" testID="booklet-open" tone="gold" onPress={() => router.push({ pathname: "/booklet/[id]", params: bookletParams(save?.campaignId ?? FELLOWSHIP_ID, scenarioId) })} />}
    />
  );
  if (!loaded) {
    return (
      <Screen testID="briefing" scene="vale">
        {back}
        <BodyText tone="muted">Loading</BodyText>
      </Screen>
    );
  }
  if (!save || !campaign || !scenario || !world || !input || !result || !facts) {
    return (
      <Screen testID="briefing" scene="vale">
        {back}
        <BodyText tone="danger">That scenario is not on this phone.</BodyText>
      </Screen>
    );
  }

  const nameOf = (code: string) => world.cards.get(code)?.name ?? code;
  const faceOf = (code: string): HeroFace => heroFace(faces, code, nameOf(code));
  const completed = save.log.completed.includes(scenario.id);
  const heroNames = (codes: readonly string[]) => codes.map(nameOf).join(", ");

  function pick(seat: number, deckId: string): void {
    setPicked((current) => current.map((item, index) => (index === seat ? deckId : item)));
    setAccepted(false);
    setChoices([]);
  }

  function onDeal(): void {
    if (!input || !result?.dealable || !save) return;
    const stored = {
      scenarioId: scenario?.id ?? "",
      difficulty,
      seats: seats.map((seat) => ({ deckId: seat.deckId, heroes: [...seat.heroes], deck: [...seat.deck] })),
      ringBearer,
      choices: [...choices],
      acceptPenalty: accepted,
    };
    try {
      const dealt = deal(save, world ?? input.world, stored, dealSeed(), CATALOG_VERSION);
      if (!dealt.ok) {
        setDealError(dealt.briefing.problems.map((problem) => problem.message).join(" "));
        return;
      }
      writeSave(user, dealt.save);
      router.replace({ pathname: "/table/[saveId]", params: { saveId: save.id } });
    } catch (error: unknown) {
      setDealError(error instanceof Error ? error.message : "The scenario could not be dealt.");
    }
  }

  const toolHeight = 120;
  const changeLines = result.steps.filter((step) => step.n >= 3).flatMap((step) => step.did.map((line, index) => ({ key: `${step.n}-${index}`, line })));

  return (
    <Screen testID="briefing" scene="vale">
      {back}
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-6" keyboardShouldPersistTaps="handled">
        <Eyebrow>{`Scenario ${facts.number}`}</Eyebrow>
        <Text accessibilityRole="header" testID="briefing-title" className="mt-1 font-display text-display text-bone">
          {facts.name}
        </Text>
        <Text testID="briefing-stages" className="mt-3 text-body text-bone">
          {facts.stages.join(" › ")}
        </Text>

        <View className="mt-4 flex-row items-center justify-between">
          <Segmented options={DIFFICULTIES} value={difficulty} onChange={(next) => setDifficulty(next)} testIDPrefix="difficulty" />
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
        {completed ? (
          <BodyText tone="muted" className="mt-3" testID="briefing-replay">
            You have won this scenario. Playing it again does not grant its reward a second time.
          </BodyText>
        ) : null}

        {seeded !== "pending" && savedDecks.length > 0 ? (
          <View className="mt-6">
            <Eyebrow tone="muted">Decks</Eyebrow>
            <DeckListBar filter={filter} onFilter={setFilter} spheres={spheres} shown={shownDecks.length} total={savedDecks.length} testIDPrefix="briefing-decks" />
          </View>
        ) : null}
        {seats.map((seat, index) => (
          <View key={index} className="mt-6">
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
                {seatDecks(index).map((deck) => {
                  const selected = picked[index] === deck.id;
                  const fallen = deck.heroes.filter((code) => save.log.fallenHeroesBySeat.flat().includes(code));
                  const ready = readiness.get(deck.id) ?? { ready: false, text: "Not read yet" };
                  const summary = {
                    testID: `deck-pick-${index}-${deck.id}`,
                    name: deck.name,
                    heroes: deck.heroes.map(faceOf),
                    detail: deckCountLine(deck),
                    status: fallen.length > 0 ? { ready: false, text: `${heroNames(fallen)} fell and cannot be picked` } : ready,
                    onPress: () => pick(index, deck.id),
                    selected,
                    disabled: fallen.length > 0 || !ready.ready,
                  };
                  // A deck that is not ready to play cannot be picked; this opens it to be finished.
                  const open =
                    !ready.ready && fallen.length === 0 ? (
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
                {seatDecks(index).length === 0 ? (
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
            {seat.deckId ? (
              <View className="mt-3 flex-row gap-2">
                {seat.heroes.map((code) => (
                  <HeroTile key={code} hero={faceOf(code)} height={toolHeight} dense />
                ))}
                {index === 0 && result.needsRingBearer ? (
                  ringBearer ? (
                    <HeroTile hero={faceOf(ringBearer)} height={toolHeight} dense onRemove={() => setRingBearer(null)} />
                  ) : (
                    <View testID="ringbearer-slot" className="flex-1">
                      <EmptyHeroSlot height={toolHeight} label="Ring-bearer" />
                    </View>
                  )
                ) : null}
              </View>
            ) : null}
            {seat.deckId && index === 0 && result.needsRingBearer && !ringBearer ? (
              <View className="mt-2">
                {candidates.map((candidate) => (
                  <TextButton key={candidate.code} label={`Choose ${candidate.name} as Ring-bearer`} testID={`ringbearer-${candidate.code}`} onPress={() => setRingBearer(candidate.code)} />
                ))}
              </View>
            ) : null}
          </View>
        ))}

        {result.needs ? (
          <View testID="briefing-choice" className="mt-6">
            <Eyebrow tone="muted">{`Seat ${result.needs.seat + 1} chooses`}</Eyebrow>
            {choices.length > 0 ? <TextButton label="Undo last choice" testID="choice-undo" onPress={() => setChoices((current) => current.slice(0, -1))} /> : null}
            {result.needs.options.map((option) => {
              const [code = "", host] = option.split(">");
              const label = option === "skip" ? "Skip" : host ? `${nameOf(code)} on ${nameOf(host)}` : nameOf(code);
              return <TextButton key={option} label={label} testID={`choice-${option}`} onPress={() => setChoices((current) => [...current, option])} />;
            })}
          </View>
        ) : null}

        {changeLines.length > 0 ? (
          <View testID="briefing-checklist" className="mt-6 gap-1">
            <Eyebrow tone="muted">Before the deal</Eyebrow>
            {changeLines.map((item) => (
              <Label key={item.key} tone="muted">
                {item.line}
              </Label>
            ))}
          </View>
        ) : null}
        {result.penaltyWaived ? (
          <Label tone="muted" className="mt-2">
            The campaign card waives the hero-change penalty.
          </Label>
        ) : null}
      </ScrollView>
      <View testID="briefing-deal-bar" className="gap-2 pb-safe pt-3">
        {result.problems.map((problem, index) => (
          <BodyText key={`${index}-${problem.message}`} tone="danger" testID={`briefing-error-${index}`}>
            {problem.message}
          </BodyText>
        ))}
        {dealError ? (
          <BodyText tone="danger" testID="briefing-deal-error">
            {dealError}
          </BodyText>
        ) : null}
        {result.penaltyAdded > 0 && !accepted ? (
          <View className="items-start">
            <TextButton label={`Accept +${result.penaltyAdded} threat for the campaign`} testID="accept-penalty" tone="gold" onPress={() => setAccepted(true)} />
          </View>
        ) : null}
        <BodyText tone="muted" testID="briefing-deal-note">
          {save.loadout ? "A scenario is already open. Dealing again drops it." : "Dealing starts the scenario."}
        </BodyText>
        <PrimaryButton label="Deal" testID="deal" disabled={!result.dealable} onPress={onDeal} />
      </View>
    </Screen>
  );
}
