// Rules: rr.campaign-setup-checklist, ltp.campaign-setup-checklist, rr.fellowship-of-heroes, ltp.fellowship-of-heroes,
// mec109.setup (data/rules/entries.json). The briefing turns a loadout (one saved deck per seat and the Ring-bearer slot)
// into either the opening start the checklist produces or the sentences that refuse it. Pure: the screen shows what
// this returns and deals only when `dealable` is true.
import { deckRulesOf, heroLimit } from "../catalog/deck-rules.ts";
import { deckSaveRefusal, formatDeckRefusal } from "../catalog/deck-save.ts";
import { placementsAt, recordInstructions, type Difficulty } from "../catalog/scenario-data.ts";
import { printedOf } from "../rules/core/printed.ts";
import type { StartScenario } from "../rules/setup/setup.ts";

import { checklist, type ChecklistPlan, type ChecklistStep, type Need } from "./checklist.ts";
import { heroBansOf, validateLoadout, type HeroBan, type LoadoutSeat, type SagaRules } from "./loadout.ts";
import type { CampaignLog } from "./log.ts";
import { isNightmarePlayable, isPlayable } from "./playable.ts";
import { printedScenarioName } from "./printed-name.ts";
import { sagaRoleOf, titleBansOf, type SagaRole } from "./saga.ts";
import { buildStart, type PlayMode } from "./start.ts";
import type { World } from "./world.ts";
import { wilderlandFacts } from "./wilderland.ts";
import { xpFacts, type ModeCard } from "./xp.ts";

export type BriefingSeat = { deckId: string | null; heroes: readonly string[]; deck: readonly string[] };

export type BriefingInput = {
  world: World;
  log: CampaignLog;
  seatCount: 1 | 2;
  seats: readonly BriefingSeat[];
  // The Ring-bearer slot: a Fellowship hero with the Ring-bearer trait, for the first seat. Used only when the deck has none.
  ringBearer: string | null;
  difficulty: Difficulty;
  // Answers to the campaign card's own Setup choices, in the order the card asks them.
  choices?: readonly string[];
  // The player has read the threat penalty a hero change adds and accepts it.
  acceptPenalty?: boolean;
  // The Hard/Expert Mode card the players put next to the quest deck (dcce.hard-expert). Only a campaign with XP offers it.
  modeCard?: ModeCard | undefined;
};

export type Problem = { rule: string; message: string };

// The part of a briefing both modes read: the decks, the seat count and the Ring-bearer slot.
export type LoadoutInput = Pick<BriefingInput, "world" | "seatCount" | "seats" | "ringBearer">;

export type Briefing = {
  problems: Problem[];
  needs: Need | null;
  // The Ring-bearer slot is required: a saga campaign's first seat deck has no Fellowship Ring-bearer. Never outside a saga.
  needsRingBearer: boolean;
  // What the hero changes add to the permanent threat penalty. Zero when none, or when the campaign card waives it.
  penaltyAdded: number;
  penaltyWaived: boolean;
  steps: ChecklistStep[];
  dealable: boolean;
};

export function isRingBearerCard(world: World, code: string): boolean {
  const card = world.cards.get(code);
  return card != null && card.type === "hero" && card.sphere === "fellowship" && card.traits.includes("Ring-bearer");
}

/** The saga hero the scenario gives the first player (src/campaign/saga.ts): the Ring-bearer slot, a granted ☺ hero, or none. */
export function sagaRole(world: World): SagaRole {
  return sagaRoleOf(world.campaign, world.scenario);
}

/** The Ring-bearer slot is asked for only where the scenario's saga hero is a Ring-bearer, when the first seat's deck brings none. */
export function needsRingBearerSlot(world: World, seat: BriefingSeat | undefined): boolean {
  return sagaRole(world).kind === "ringBearer" && !deckHasRingBearer(world, seat);
}

export function deckHasRingBearer(world: World, seat: BriefingSeat | undefined): boolean {
  return (seat?.heroes ?? []).some((code) => isRingBearerCard(world, code));
}

// The loadout the saga rules and the checklist read: the saved deck's heroes, and in front of them the slot's hero when the
// deck brings no Ring-bearer, or the ☺ hero the scenario grants the first player (☺ Aragorn: mec112.setting-up-the-game). A fallen hero is
// not special-cased here: step 2 of the checklist names it.
export function loadoutOf(input: LoadoutInput): LoadoutSeat[] {
  const role = sagaRole(input.world);
  return input.seats.slice(0, input.seatCount).map((seat, index) => {
    const slot = role.kind === "ringBearer" && index === 0 && input.ringBearer && !deckHasRingBearer(input.world, seat) ? [input.ringBearer] : role.kind === "hero" && index === 0 && !seat.heroes.includes(role.hero) ? [role.hero] : [];
    return { heroes: [...slot, ...seat.heroes], deck: seat.deck };
  });
}

// What the scenario's saga start adds to the loadout rules: the granted ☺ hero, and the titles the box refuses in standalone play too.
function sagaRulesOf(world: World): SagaRules {
  const role = sagaRole(world);
  return { hero: role.kind === "hero" ? role.hero : undefined, titleBans: titleBansOf(world.campaign, world.scenario) };
}

const RULE_OF: Readonly<Record<string, string>> = {
  unknownCard: "Every card is in the catalog",
  fellowshipOutsideSaga: "Fellowship heroes only in a saga",
  twoFellowshipHeroes: "Only one Fellowship-sphere hero may start",
  secondFrodo: "One version of Frodo",
  secondVersion: "One version of the ☺ hero",
  bannedTitle: "A title the box refuses",
  noRingBearer: "A Ring-bearer is required",
  tooManyHeroes: "Three heroes besides the Ring-bearer",
  ringInDeck: "The One Ring is not a deck card",
  sameHero: "No two players use the same hero",
  bannedHero: "A hero the campaign refuses in this scenario",
  undiscoveredTreasure: "A treasure must be discovered first",
  treasureCopies: "One copy of a treasure",
};

// A seat's saved deck as the deckbuilding check reads it: its heroes, and its cards counted by code.
function deckCounts(deck: readonly string[]): { code: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const code of deck) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts].map(([code, count]) => ({ code, count }));
}

// What a loadout must satisfy before any deal, campaign or standalone: a saved deck per seat with one to three heroes
// (rr.deckbuilding), no fallen hero (the campaign's list; none in a standalone game), and the saga rules on the
// loadout (validateLoadout). A treasure in a deck is admitted when the log records it (`discovered`, emce.treasure).
export function loadoutProblems(input: LoadoutInput, fallen: readonly string[], bans: readonly HeroBan[] = [], discovered: readonly string[] = []): { problems: Problem[]; loadout: LoadoutSeat[] } {
  const problems: Problem[] = [];
  const { world } = input;
  const nameOf = (code: string) => world.cards.get(code)?.name ?? code;
  input.seats.slice(0, input.seatCount).forEach((seat, index) => {
    const label = input.seatCount === 1 ? "The deck" : `Seat ${index + 1}'s deck`;
    if (seat.deckId == null) problems.push({ rule: "Choose a deck", message: `Choose a saved deck for seat ${index + 1}.` });
    else if (seat.heroes.length < 1 || seat.heroes.length > heroLimit(deckRulesOf(world.effects, seat.deck))) {
      const limit = heroLimit(deckRulesOf(world.effects, seat.deck));
      problems.push({ rule: limit === 3 ? "One to three heroes" : `One to ${limit} heroes`, message: `${label} has ${seat.heroes.length} heroes. A saved deck has one to ${limit === 3 ? "three" : limit}.` });
    } else if (world.deckFacts) {
      // A deck saves before it is ready to play (rr.deckbuilding); it is not dealt until it is. A contract's deckbuilding rules apply.
      // A treasure the log records is no deck card for this check: it is outside the 50 card minimum (emce.treasure); validateLoadout admits or refuses it.
      const refusal = deckSaveRefusal(seat.heroes, deckCounts(seat.deck.filter((code) => world.cards.get(code)?.campaignKind !== "treasure")), world.deckFacts, [], deckRulesOf(world.effects, seat.deck));
      if (refusal) problems.push({ rule: "The deck is ready to play", message: `${label} is not ready to play: ${formatDeckRefusal(refusal)}` });
    }
    for (const code of seat.heroes) {
      if (fallen.includes(code)) problems.push({ rule: "A fallen hero cannot start", message: `${nameOf(code)} is a fallen hero and cannot start.` });
    }
  });
  const loadout = loadoutOf(input);
  if (problems.length === 0) {
    for (const error of validateLoadout(loadout, world.cards, world.campaign.saga, bans, discovered, sagaRulesOf(world))) problems.push({ rule: RULE_OF[error.rule] ?? error.rule, message: error.message });
  }
  return { problems, loadout };
}

/** A scenario the app cannot deal yet is coming soon (user decision, 2026-11-01): the one refusal of a campaign briefing, a standalone one and a deal, in the same words. */
export function comingSoonProblems(world: World): Problem[] {
  return isPlayable(world.scenario.id) ? [] : [{ rule: "Coming soon", message: `${printedScenarioName(world.scenario.name)} is coming soon.` }];
}

function check(input: BriefingInput): { problems: Problem[]; loadout: LoadoutSeat[] } {
  const { problems, loadout } = loadoutProblems(input, input.log.fallenHeroesBySeat.flat(), heroBansOf(input.world.campaign, input.world.scenario.id), input.log.treasures);
  return { problems: [...comingSoonProblems(input.world), ...difficultyProblems(input.world, input.difficulty), ...problems], loadout };
}

// Nightmare deals only where the scenario's Nightmare deck has an effect record for every printed line (NIGHTMARE_PLAYABLE).
export function difficultyProblems(world: World, difficulty: Difficulty): Problem[] {
  if (difficulty !== "Nightmare" || isNightmarePlayable(world.scenario.id)) return [];
  const name = printedScenarioName(world.scenario.name);
  return [{ rule: "Nightmare not playable yet", message: world.scenario.nightmare ? `${name} on Nightmare is not playable yet: some of its Nightmare cards have no effect record.` : `${name} has no Nightmare deck.` }];
}

export function briefing(input: BriefingInput): Briefing {
  const { world, log } = input;
  const { problems, loadout } = check(input);
  const needsRingBearer = needsRingBearerSlot(world, input.seats[0]);
  const waived = recordInstructions(world.effects, world.scenario.campaignCard, "campaignSetup").some((instruction) => instruction.verb === "WaiveThreatPenalty");
  const empty: Briefing = { problems, needs: null, needsRingBearer, penaltyAdded: 0, penaltyWaived: waived, steps: [], dealable: false };
  if (problems.length > 0) return empty;

  const plan = checklist({ log, scenario: world.scenario, seats: loadout, effects: world.effects, cards: world.cards, difficulty: input.difficulty, ...(input.choices ? { choices: input.choices } : {}) });
  if (!plan.ok) {
    return { ...empty, needs: plan.needs, problems: plan.errors.map((message) => ({ rule: "Campaign Setup Checklist", message })) };
  }
  // The +1 each player takes when a fallen Aragorn leaves the list (mec112.campaign-mode-aragorn) is not a hero change and needs no acceptance.
  const penaltyAdded = plan.threatModifier - log.threatPenalty - plan.forcedPenalty;
  const unaccepted = penaltyAdded > 0 && input.acceptPenalty !== true;
  return {
    ...empty,
    penaltyAdded,
    steps: plan.steps,
    problems: unaccepted ? [{ rule: "Hero change", message: `Changing heroes adds ${penaltyAdded} to the threat penalty for the rest of the campaign. Accept it to deal.` }] : [],
    dealable: !unaccepted,
  };
}

// The checklist plan of a briefing that is dealable. Throws when it is not, so a caller cannot deal a refused loadout.
export function checklistPlan(input: BriefingInput): Extract<ChecklistPlan, { ok: true }> {
  const { problems, loadout } = check(input);
  if (problems.length > 0) throw new Error(problems.map((problem) => problem.message).join(" "));
  const { world, log } = input;
  const plan = checklist({ log, scenario: world.scenario, seats: loadout, effects: world.effects, cards: world.cards, difficulty: input.difficulty, ...(input.choices ? { choices: input.choices } : {}) });
  if (!plan.ok) throw new Error(plan.errors.join(" ") || "The campaign card asks for a choice");
  return plan;
}

export function startFor(input: BriefingInput, seed: number): StartScenario {
  const plan = checklistPlan(input);
  const { world } = input;
  return buildStart({
    campaign: world.campaign,
    scenario: world.scenario,
    seatCount: input.seatCount,
    seed,
    threatModifier: plan.threatModifier,
    seats: plan.seats,
    difficulty: input.difficulty,
    effects: world.effects,
    poolEncounterCards: plan.poolEncounterCards,
    poolIntoPlay: plan.poolIntoPlay,
    removedFromEncounter: plan.removedFromEncounter,
    removedFromCaves: plan.removedFromCaves,
    ...(input.modeCard ? { modeCard: input.modeCard } : {}),
    // The log's structured facts (the pool as the checklist leaves it, with the cards the campaign card's Setup added); a Dream-chaser log adds its scalable cards' levels and its upgraded cards (buildStart adds the Hard/Expert card in play).
    facts: { prisoner: input.log.prisoner, usedOnce: input.log.usedOnce, counters: input.log.counters, ...xpFacts(input.log), ...wilderlandFacts(plan.log, world.campaign.id) },
  });
}

export type ScenarioFacts = {
  number: number;
  name: string;
  stages: string[];
  sets: { name: string; count: number }[];
  deckSize: number;
  rules: string[];
};

// What the briefing says about the scenario itself: the stages in order, the encounter sets with the cards each
// contributes at the difficulty, and the special rules the scenario's data declares, by name. A standalone game has no
// campaign card, so its rules are not named there.
export function scenarioFacts(world: World, difficulty: Difficulty, mode: PlayMode = "campaign"): ScenarioFacts {
  const { scenario } = world;
  const encounter = placementsAt(scenario, difficulty).filter((card) => card.pile === "encounter");
  const countOf = (card: (typeof encounter)[number]) => (difficulty === "Easy" ? card.easy : card.normal);
  const bySet = new Map<string, number>();
  for (const card of encounter) {
    const set = world.sets.get(card.code);
    if (set) bySet.set(set, (bySet.get(set) ?? 0) + countOf(card));
  }
  // A set the catalog has no rows for keeps the booklet's count; on Nightmare a set the recipe empties is 0, not the booklet's.
  const sets = scenario.encounterSets.map((set) => ({ name: set.name, count: bySet.get(set.name) ?? (difficulty === "Nightmare" ? 0 : set.count) }));
  // On Nightmare the deck's own set follows the booklet's, with the cards it shuffles in (the ones a Setup places are counted where
  // they replace a card, as the booklet's sets count theirs).
  const nightmareSet = difficulty === "Nightmare" ? world.sets.get(scenario.nightmare?.cards[0]?.code ?? "") : undefined;
  if (nightmareSet) sets.push({ name: nightmareSet, count: bySet.get(nightmareSet) ?? 0 });
  const rules: string[] = [];
  if (difficulty === "Nightmare") rules.push("Nightmare setup card");
  if (scenario.widgets.hide) rules.push("Hide");
  if (scenario.life != null) rules.push("Ring-bearer life");
  if (scenario.cards.some((card) => card.pile === "burden")) rules.push("Burden deck");
  if (scenario.widgets.secondActiveLocation) rules.push("Second active location");
  if (scenario.widgets.perSeatStaging) rules.push("Separate staging areas");
  if (mode === "campaign" && recordInstructions(world.effects, scenario.campaignCard, "campaignSetup").some((instruction) => instruction.verb === "WaiveThreatPenalty")) rules.push("No hero-change penalty");
  return {
    number: scenario.number,
    name: printedScenarioName(scenario.name),
    stages: scenario.stages.map((code) => (world.cards.has(code) ? printedOf(world.cards, code).name : code)),
    sets,
    deckSize: encounter.reduce((sum, card) => sum + countOf(card), 0),
    rules,
  };
}
