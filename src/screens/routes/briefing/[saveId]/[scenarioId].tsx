import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { briefing, scenarioFacts, type BriefingInput, type BriefingSeat } from "../../../../campaign/briefing";
import { deal } from "../../../../campaign/session";
import { logCodes, loadWorld } from "../../../../campaign/world";
import type { Difficulty } from "../../../../catalog/scenario-data";
import { CATALOG_VERSION } from "../../../../catalog/version";
import { EFFECTS } from "../../../../effects";
import { BodyText, Label, Section, TextButton } from "../../../chrome";
import { bookletParams, campaignOf, scenarioOf } from "../../../campaign-data";
import { goBack } from "../../../go-back";
import { writeSave } from "../../../campaign-store";
import { useDatabases } from "../../../databases";
import { dealSeed } from "../../../e2e";
import { BriefingScreen, DealBar, DifficultyPicker, EncounterDetails, expand, ScenarioBanner, useBriefingDecks } from "../../../briefing-parts";
import { SeatPicker } from "../../../seat-picker";
import { routeCode } from "../../../route-code";
import { useSave } from "../../../use-save";

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
  const briefingDecks = useBriefingDecks(campaign?.saga ?? false);
  const { savedDecks, candidates } = briefingDecks;

  const seatCount = save?.seatCount ?? 1;
  const seats: BriefingSeat[] = useMemo(
    () =>
      Array.from({ length: seatCount }, (_, index) => {
        const deck = savedDecks.find((item) => item.id === picked[index]);
        return { deckId: deck?.id ?? null, heroes: deck?.heroes ?? [], deck: expand(deck) };
      }),
    [seatCount, savedDecks, picked],
  );

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

  const frame = {
    testID: "briefing",
    scenarioId,
    backLabel: "Path",
    onBack: () => goBack(router, saveId ? { pathname: "/path/[saveId]", params: { saveId } } : "/"),
    ...(save ? { onBooklet: () => router.push({ pathname: "/booklet/[id]", params: bookletParams(save.campaignId, scenarioId) }) } : {}),
  } as const;
  if (!loaded) {
    return (
      <BriefingScreen {...frame} banner={null}>
        <BodyText tone="muted" className="mt-4">
          Loading
        </BodyText>
      </BriefingScreen>
    );
  }
  if (!save || !campaign || !scenario || !world || !input || !result || !facts) {
    return (
      <BriefingScreen {...frame} banner={null}>
        <BodyText tone="danger" className="mt-4">
          That scenario is not on this phone.
        </BodyText>
      </BriefingScreen>
    );
  }

  const nameOf = (code: string) => world.cards.get(code)?.name ?? code;
  const completed = save.log.completed.includes(scenario.id);
  const fallen = save.log.fallenHeroesBySeat.flat();

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

  const changeLines = result.steps.filter((step) => step.n >= 3).flatMap((step) => step.did.map((line, index) => ({ key: `${step.n}-${index}`, line })));

  return (
    <BriefingScreen
      {...frame}
      banner={<ScenarioBanner facts={facts} eyebrow={`Scenario ${facts.number} · ${campaign.name}`} />}
      bar={
        <DealBar problems={result.problems} dealError={dealError} difficulty={difficulty} dropsOpen={save.loadout != null} dealable={result.dealable} onDeal={onDeal}>
          {result.penaltyAdded > 0 && !accepted ? (
            <View className="items-start">
              <TextButton label={`Accept +${result.penaltyAdded} threat for the campaign`} testID="accept-penalty" tone="gold" onPress={() => setAccepted(true)} />
            </View>
          ) : null}
        </DealBar>
      }
    >
      {completed ? (
        <BodyText tone="muted" className="mt-3" testID="briefing-replay">
          You have won this scenario. Playing it again does not grant its reward a second time.
        </BodyText>
      ) : null}

      {/* The difficulty first: it is decided before the deck, and it must be seen before Deal (it is named over Deal too). */}
      <DifficultyPicker facts={facts} difficulty={difficulty} onDifficulty={setDifficulty} />

      {seats.map((seat, index) => (
        <SeatPicker
          key={index}
          index={index}
          seatCount={seatCount}
          decks={briefingDecks}
          picked={seat.deckId}
          heroes={seat.heroes}
          fallen={fallen}
          needsRingBearer={result.needsRingBearer}
          saga={campaign?.saga ?? false}
          ringBearer={ringBearer}
          onPick={(deckId) => pick(index, deckId)}
          onRingBearer={setRingBearer}
          nameOf={nameOf}
        />
      ))}

      {result.needs ? (
        <View testID="briefing-choice" className="mt-5">
          <Section title={`Seat ${result.needs.seat + 1} chooses`} />
          {choices.length > 0 ? <TextButton label="Undo last choice" testID="choice-undo" onPress={() => setChoices((current) => current.slice(0, -1))} /> : null}
          {result.needs.options.map((option) => {
            const [code = "", host] = option.split(">");
            const label = option === "skip" ? "Skip" : host ? `${nameOf(code)} on ${nameOf(host)}` : nameOf(code);
            return <TextButton key={option} label={label} testID={`choice-${option}`} onPress={() => setChoices((current) => [...current, option])} />;
          })}
        </View>
      ) : null}

      {changeLines.length > 0 ? (
        <View testID="briefing-checklist" className="mt-5 gap-1">
          <Section title="Before the deal" />
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

      <EncounterDetails facts={facts} />
    </BriefingScreen>
  );
}
