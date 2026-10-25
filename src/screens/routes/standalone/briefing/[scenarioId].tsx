// The briefing of a standalone game (src/campaign/standalone.ts): the scenario, the seats, the difficulty, one saved deck
// per seat and the Ring-bearer slot. No log, no checklist, no penalty, no boon or burden. Deal writes a new game and
// opens its table. `from` names a finished game whose seats, decks and difficulty are picked again (Play again).
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { scenarioFacts, type BriefingSeat } from "../../../../campaign/briefing";
import { FELLOWSHIP_ID } from "../../../../campaign/save";
import { dealStandalone, standaloneBriefing, type StandaloneInput, type StandaloneLoadout } from "../../../../campaign/standalone";
import { loadWorld } from "../../../../campaign/world";
import type { Difficulty } from "../../../../catalog/scenario-data";
import { CATALOG_VERSION } from "../../../../catalog/version";
import { EFFECTS } from "../../../../effects";
import { DeckFilter, expand, ScenarioHeader, SeatPicker, useBriefingDecks } from "../../../briefing-parts";
import { bookletParams, campaignOf, scenarioOf } from "../../../campaign-data";
import { BodyText, Label, NavBar, PrimaryButton, Screen, Segmented, TextButton } from "../../../chrome";
import { useDatabases } from "../../../databases";
import { dealSeed } from "../../../e2e";
import { goBack } from "../../../go-back";
import { routeCode } from "../../../route-code";
import { SEAT_WORDS, seatCountOf, seatWord } from "../../../seats";
import { newStandaloneId, readStandalone, writeStandalone } from "../../../standalone-store";

export default function StandaloneBriefing() {
  const router = useRouter();
  const params = useLocalSearchParams<{ scenarioId: string; from?: string }>();
  const scenarioId = routeCode(params.scenarioId);
  const fromId = routeCode(params.from);
  const { catalog, user } = useDatabases();
  const briefingDecks = useBriefingDecks();
  const { savedDecks, candidates } = briefingDecks;

  // Play again: the finished game's choices, read once. A deck deleted since is simply not picked.
  const previous = useMemo(() => (fromId ? (readStandalone(user, fromId)?.game ?? null) : null), [user, fromId]);
  const from = previous?.loadout ?? null;
  const [seatCount, setSeatCount] = useState<1 | 2>(previous?.seatCount ?? 1);
  const [difficulty, setDifficulty] = useState<Difficulty>(from?.difficulty ?? "Normal");
  const [picked, setPicked] = useState<readonly (string | null)[]>(() => [from?.seats[0]?.deckId ?? null, from?.seats[1]?.deckId ?? null]);
  const [ringBearer, setRingBearer] = useState<string | null>(from?.ringBearer ?? null);
  const [dealError, setDealError] = useState<string | null>(null);

  const campaign = campaignOf(FELLOWSHIP_ID);
  const scenario = scenarioId ? scenarioOf(scenarioId) : null;

  const seats: BriefingSeat[] = useMemo(
    () =>
      Array.from({ length: seatCount }, (_, index) => {
        const deck = savedDecks.find((item) => item.id === picked[index]);
        return { deckId: deck?.id ?? null, heroes: deck?.heroes ?? [], deck: expand(deck) };
      }),
    [seatCount, savedDecks, picked],
  );

  const world = useMemo(() => {
    if (!campaign || !scenario) return null;
    const extra = [...candidates.map((card) => card.code), ...savedDecks.flatMap((deck) => deck.heroes), ...seats.flatMap((seat) => seat.deck)];
    return loadWorld(catalog, campaign, scenario, EFFECTS, extra);
  }, [catalog, campaign, scenario, candidates, savedDecks, seats]);

  const input: StandaloneInput | null = useMemo(() => (world ? { world, seatCount, seats, ringBearer, difficulty } : null), [world, seatCount, seats, ringBearer, difficulty]);
  const result = useMemo(() => (input ? standaloneBriefing(input) : null), [input]);
  const facts = useMemo(() => (world ? scenarioFacts(world, difficulty, "standalone") : null), [world, difficulty]);

  const back = (
    <NavBar
      onBack={() => goBack(router, "/scenarios")}
      backTestID="briefing-back"
      backLabel="Scenarios"
      right={<TextButton label="Booklet" accessibilityLabel="Open the booklet" testID="booklet-open" tone="gold" onPress={() => router.push({ pathname: "/booklet/[id]", params: bookletParams(FELLOWSHIP_ID, scenarioId) })} />}
    />
  );
  if (!campaign || !scenario || !world || !input || !result || !facts) {
    return (
      <Screen testID="standalone-briefing" scene="vale">
        {back}
        <BodyText tone="danger">That scenario is not on this phone.</BodyText>
      </Screen>
    );
  }

  const ready = world;
  const nameOf = (code: string) => ready.cards.get(code)?.name ?? code;

  function pick(seat: number, deckId: string): void {
    setPicked((current) => current.map((item, index) => (index === seat ? deckId : item)));
  }

  function onDeal(): void {
    if (!result?.dealable || !scenario) return;
    const loadout: StandaloneLoadout = {
      scenarioId: scenario.id,
      difficulty,
      seats: seats.map((seat) => ({ deckId: seat.deckId, heroes: [...seat.heroes], deck: [...seat.deck] })),
      ringBearer,
    };
    try {
      const dealt = dealStandalone(newStandaloneId(), ready, seatCount, loadout, dealSeed(), CATALOG_VERSION);
      if (!dealt.ok) {
        setDealError(dealt.briefing.problems.map((problem) => problem.message).join(" "));
        return;
      }
      writeStandalone(user, dealt.game);
      router.replace({ pathname: "/standalone/table/[gameId]", params: { gameId: dealt.game.id } });
    } catch (error: unknown) {
      setDealError(error instanceof Error ? error.message : "The scenario could not be dealt.");
    }
  }

  return (
    <Screen testID="standalone-briefing" scene="vale">
      {back}
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="pb-6" keyboardShouldPersistTaps="handled">
        <ScenarioHeader facts={facts} difficulty={difficulty} onDifficulty={setDifficulty} eyebrow={`Standalone · Scenario ${facts.number}`} />
        <View className="mt-5">
          <Segmented
            options={SEAT_WORDS}
            value={seatWord(seatCount)}
            onChange={(next) => setSeatCount(seatCountOf(next))}
            testIDPrefix="seats"
          />
        </View>
        <Label tone="muted" className="mt-3">
          No campaign card, boons or burdens. A win is scored; nothing is written to a campaign.
        </Label>
        <DeckFilter decks={briefingDecks} />
        {seats.map((seat, index) => (
          <SeatPicker
            key={index}
            index={index}
            seatCount={seatCount}
            decks={briefingDecks}
            picked={seat.deckId}
            heroes={seat.heroes}
            fallen={[]}
            needsRingBearer={result.needsRingBearer}
            ringBearer={ringBearer}
            onPick={(deckId) => pick(index, deckId)}
            onRingBearer={setRingBearer}
            nameOf={nameOf}
          />
        ))}
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
        <PrimaryButton label="Deal" testID="deal" disabled={!result.dealable} onPress={onDeal} />
      </View>
    </Screen>
  );
}
