// The briefing of a standalone game (src/campaign/standalone.ts): the scenario, the seats, the difficulty, one saved deck
// per seat and the Ring-bearer slot. No log, no checklist, no penalty, no boon or burden. Deal writes a new game and
// opens its table. `from` names a finished game whose seats, decks and difficulty are picked again (Play again).
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";

import { scenarioFacts, type BriefingSeat } from "../../../../campaign/briefing";
import { dealStandalone, standaloneBriefing, type StandaloneInput, type StandaloneLoadout } from "../../../../campaign/standalone";
import { loadWorld } from "../../../../campaign/world";
import type { Difficulty } from "../../../../catalog/scenario-data";
import { CATALOG_VERSION } from "../../../../catalog/version";
import { EFFECTS } from "../../../../effects";
import { BriefingScreen, DealBar, DifficultyPicker, EncounterDetails, expand, ScenarioBanner, useBriefingDecks } from "../../../briefing-parts";
import { SeatPicker } from "../../../seat-picker";
import { bookletParams, campaignOfScenario, scenarioOf } from "../../../campaign-data";
import { BodyText, Label, Section, Segmented } from "../../../chrome";
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

  // Play again: the finished game's choices, read once. A deck deleted since is simply not picked.
  const previous = useMemo(() => (fromId ? (readStandalone(user, fromId)?.game ?? null) : null), [user, fromId]);
  const from = previous?.loadout ?? null;
  const [seatCount, setSeatCount] = useState<1 | 2>(previous?.seatCount ?? 1);
  const [difficulty, setDifficulty] = useState<Difficulty>(from?.difficulty ?? "Normal");
  const [picked, setPicked] = useState<readonly (string | null)[]>(() => [from?.seats[0]?.deckId ?? null, from?.seats[1]?.deckId ?? null]);
  const [ringBearer, setRingBearer] = useState<string | null>(from?.ringBearer ?? null);
  const [dealError, setDealError] = useState<string | null>(null);

  const scenario = scenarioId ? scenarioOf(scenarioId) : null;
  // The box the scenario is printed in decides the campaign flags (saga, booklet) a standalone game follows.
  const campaign = scenarioId ? campaignOfScenario(scenarioId) : null;
  const briefingDecks = useBriefingDecks(campaign?.saga ?? false);
  const { savedDecks, candidates } = briefingDecks;

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

  const frame = {
    testID: "standalone-briefing",
    scenarioId,
    backLabel: "Scenarios",
    onBack: () => goBack(router, "/scenarios"),
    ...(campaign ? { onBooklet: () => router.push({ pathname: "/booklet/[id]", params: bookletParams(campaign.id, scenarioId) }) } : {}),
  } as const;
  if (!campaign || !scenario || !world || !input || !result || !facts) {
    return (
      <BriefingScreen {...frame} banner={null}>
        <BodyText tone="danger" className="mt-4">
          That scenario is not on this phone.
        </BodyText>
      </BriefingScreen>
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
    <BriefingScreen
      {...frame}
      banner={<ScenarioBanner facts={facts} eyebrow={`Standalone · Scenario ${facts.number}`} />}
      bar={<DealBar problems={result.problems} dealError={dealError} difficulty={difficulty} dealable={result.dealable} onDeal={onDeal} />}
    >
      <Section title="Players" className="mt-4" />
      <Segmented options={SEAT_WORDS} value={seatWord(seatCount)} onChange={(next) => setSeatCount(seatCountOf(next))} testIDPrefix="seats" stretch />
      <Label tone="muted" className="mt-2">
        No campaign card, boons or burdens. A win is scored; nothing is written to a campaign.
      </Label>
      <DifficultyPicker facts={facts} difficulty={difficulty} onDifficulty={setDifficulty} />
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
          saga={campaign.saga}
          ringBearer={ringBearer}
          onPick={(deckId) => pick(index, deckId)}
          onRingBearer={setRingBearer}
          nameOf={nameOf}
        />
      ))}
      <EncounterDetails facts={facts} />
    </BriefingScreen>
  );
}
