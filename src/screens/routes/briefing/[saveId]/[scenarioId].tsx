import { inArray } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { briefing, scenarioFacts, type BriefingInput, type BriefingSeat } from "../../../../campaign/briefing";
import { deal } from "../../../../campaign/session";
import { isNightmarePlayable } from "../../../../campaign/playable";
import { logCodes, loadWorld } from "../../../../campaign/world";
import { xpUnspentOf, type ModeCard } from "../../../../campaign/xp";
import type { Difficulty } from "../../../../catalog/scenario-data";
import { cards } from "../../../../catalog/schema";
import { CATALOG_VERSION } from "../../../../catalog/version";
import { EFFECTS } from "../../../../effects";
import { BodyText, Label, Section, TextButton } from "../../../chrome";
import { bookletParams, campaignOf, scenarioOf } from "../../../campaign-data";
import { goBack } from "../../../go-back";
import { writeSave } from "../../../campaign-store";
import { useDatabases } from "../../../databases";
import { recordUnclosedRun } from "../../../table-session";
import { dealSeed } from "../../../e2e";
import { actionLine, needWords } from "../../../briefing-words";
import { BriefingScreen, DealBar, DifficultyPicker, EncounterDetails, expand, ModePicker, ScenarioBanner, useBriefingDecks } from "../../../briefing-parts";
import { SeatPicker } from "../../../seat-picker";
import { routeCode } from "../../../route-code";
import { useSave } from "../../../use-save";

// Runs a deal and returns what went wrong, or null. The try/catch lives here because the React Compiler cannot compile one in a component.
function attempt(run: () => string | null): string | null {
  try {
    return run();
  } catch (error: unknown) {
    return error instanceof Error ? error.message : "The scenario could not be dealt.";
  }
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
  // The Hard/Expert Mode card (a campaign with XP, dcce.hard-expert): until the players change it, the one the campaign setup offered.
  const [pickedMode, setPickedMode] = useState<ModeCard | null | undefined>(undefined);

  const campaign = save ? campaignOf(save.campaignId) : null;
  const modeCard: ModeCard | null = campaign?.xp ? (pickedMode === undefined ? (save?.log.modeDefault ?? null) : pickedMode) : null;
  const scenario = scenarioId ? scenarioOf(scenarioId) : null;
  const nightmare = scenarioId != null && isNightmarePlayable(scenarioId);
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

  // The world is built from the scenario and these codes (the log's cards, the Ring-bearers, every saved deck's heroes, the picked decks'
  // cards), as one string: a deck list read again on focus, or a pick of the same cards, keeps the world instead of loading it again.
  const hasSave = save != null;
  const codeKey = hasSave ? [...new Set([...logCodes(save.log), ...candidates.map((card) => card.code), ...savedDecks.flatMap((deck) => deck.heroes), ...seats.flatMap((seat) => seat.deck)])].sort().join("\0") : "";
  const world = useMemo(() => {
    if (!hasSave || !campaign || !scenario) return null;
    return loadWorld(catalog, campaign, scenario, EFFECTS, codeKey === "" ? [] : codeKey.split("\0"));
  }, [catalog, hasSave, campaign, scenario, codeKey]);

  const input: BriefingInput | null = useMemo(
    () => (save && world ? { world, log: save.log, seatCount: save.seatCount, seats, ringBearer, difficulty, choices, acceptPenalty: accepted, modeCard: modeCard ?? undefined } : null),
    [save, world, seats, ringBearer, difficulty, choices, accepted, modeCard],
  );
  const result = useMemo(() => (input ? briefing(input) : null), [input]);
  const facts = useMemo(() => (world ? scenarioFacts(world, difficulty) : null), [world, difficulty]);
  // The printed text of the cards a campaign choice offers, for the Action line under each option.
  const offered = useMemo(() => (result?.needs ? result.needs.options.flatMap((option) => (option === "skip" ? [] : [option.split(">")[0] ?? ""])) : []), [result]);
  const printedText = useMemo<Record<string, string | null>>(
    () => (offered.length === 0 ? {} : Object.fromEntries(catalog.select({ code: cards.code, text: cards.text }).from(cards).where(inArray(cards.code, offered)).all().map((row) => [row.code, row.text]))),
    [catalog, offered],
  );

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
  const asked = result.needs ? needWords(result.needs.seat, result.needs.options, (code) => world.cards.get(code)?.traits ?? []) : null;
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
      ...(modeCard ? { modeCard } : {}),
    };
    const problem = attempt(() => {
      const dealt = deal(save, world ?? input.world, stored, dealSeed(), CATALOG_VERSION, Date.now());
      if (!dealt.ok) return dealt.briefing.problems.map((problem) => problem.message).join(" ");
      // The open scenario this deal drops may be over (lost or won, not yet closed): it keeps its run.
      if (save.active) recordUnclosedRun(catalog, user, save.id);
      writeSave(user, dealt.save);
      router.replace({ pathname: "/table/[saveId]", params: { saveId: save.id } });
      return null;
    });
    if (problem != null) setDealError(problem);
  }

  const changeLines = result.steps.filter((step) => step.n >= 3).flatMap((step) => step.did.map((line, index) => ({ key: `${step.n}-${index}`, line })));

  return (
    <BriefingScreen
      {...frame}
      banner={<ScenarioBanner facts={facts} eyebrow={`Scenario ${facts.number} · ${campaign.name}`} />}
      bar={
        <DealBar problems={result.problems} dealError={dealError} dropsOpen={save.loadout != null} dealable={result.dealable} waiting={asked?.waiting ?? null} onDeal={onDeal}>
          {result.penaltyAdded > 0 && !accepted ? (
            <View className="items-start">
              <TextButton label={`Accept +${result.penaltyAdded} threat for the campaign`} testID="accept-penalty" tone="accent" onPress={() => setAccepted(true)} />
            </View>
          ) : null}
        </DealBar>
      }
      aside={
        <>
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
        </>
      }
    >
      {completed ? (
        <BodyText tone="muted" className="mt-3" testID="briefing-replay">
          You have won this scenario. Playing it again does not grant its reward a second time.
        </BodyText>
      ) : null}

      {/* Dream-chaser: XP is spent only before or after a scenario (dcce.scalable-upgradable), so the reminder comes before the deal. */}
      {campaign.xp && xpUnspentOf(save.log) > 0 ? (
        <BodyText className="mt-3" testID="briefing-xp-unspent">
          {`${xpUnspentOf(save.log)} XP unspent. Spend it on the path before you deal.`}
        </BodyText>
      ) : null}

      {/* The difficulty first: it is decided before the deck, and it must be seen before Deal (it is named over Deal too). */}
      <DifficultyPicker facts={facts} difficulty={difficulty} onDifficulty={setDifficulty} nightmare={nightmare} />
      {campaign.xp ? <ModePicker mode={modeCard} onMode={setPickedMode} testIDPrefix="mode" campaignName={campaign.name} /> : null}

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
          {asked?.intro ? (
            <Label tone="muted" testID="briefing-choice-intro">
              {asked.intro}
            </Label>
          ) : null}
          {choices.length > 0 ? <TextButton label="Undo last choice" testID="choice-undo" onPress={() => setChoices((current) => current.slice(0, -1))} /> : null}
          {result.needs.options.map((option) => {
            const [code = "", host] = option.split(">");
            const label = option === "skip" ? "Skip" : host ? `${nameOf(code)} on ${nameOf(host)}` : nameOf(code);
            // The card's Action line, so the choice is made knowing what the boon does.
            const action = option === "skip" ? null : actionLine(printedText[code]);
            return (
              <View key={option}>
                <TextButton label={label} testID={`choice-${option}`} onPress={() => setChoices((current) => [...current, option])} />
                {action ? (
                  <Label tone="muted" className="mb-1 text-center" testID={`choice-${option}-action`}>
                    {action}
                  </Label>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

    </BriefingScreen>
  );
}
