// Rules: rr.campaign-setup-checklist, ltp.campaign-setup-checklist, rr.fellowship-of-heroes, ltp.fellowship-of-heroes,
// mec109.setup (data/rules/entries.json). The briefing turns a loadout (one saved deck per seat and the Ring-bearer slot)
// into either the opening start the checklist produces or the sentences that refuse it. Pure: the screen shows what
// this returns and deals only when `dealable` is true.
import { deckSaveRefusal, formatDeckRefusal } from "../catalog/deck-save.ts";
import { recordInstructions, type Difficulty } from "../catalog/scenario-data.ts";
import { printedOf } from "../rules/printed.ts";
import type { StartScenario } from "../rules/setup.ts";

import { checklist, type ChecklistPlan, type ChecklistStep, type Need } from "./checklist.ts";
import { validateLoadout, type LoadoutSeat } from "./loadout.ts";
import type { CampaignLog } from "./log.ts";
import { buildStart } from "./start.ts";
import type { World } from "./world.ts";

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
};

export type Problem = { rule: string; message: string };

export type Briefing = {
  problems: Problem[];
  needs: Need | null;
  // The Ring-bearer slot is required: the first seat's deck has no Fellowship Ring-bearer.
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

export function deckHasRingBearer(world: World, seat: BriefingSeat | undefined): boolean {
  return (seat?.heroes ?? []).some((code) => isRingBearerCard(world, code));
}

// The loadout the saga rules and the checklist read: the saved deck's heroes, and the slot's hero in front when the
// deck brings no Ring-bearer. A fallen hero is not special-cased here: step 2 of the checklist names it.
export function loadoutOf(input: BriefingInput): LoadoutSeat[] {
  return input.seats.slice(0, input.seatCount).map((seat, index) => {
    const slot = index === 0 && input.ringBearer && !deckHasRingBearer(input.world, seat) ? [input.ringBearer] : [];
    return { heroes: [...slot, ...seat.heroes], deck: seat.deck };
  });
}

const RULE_OF: Readonly<Record<string, string>> = {
  unknownCard: "Every card is in the catalog",
  twoFellowshipHeroes: "Only one Fellowship-sphere hero may start",
  secondFrodo: "One version of Frodo",
  noRingBearer: "A Ring-bearer is required",
  tooManyHeroes: "Three heroes besides the Ring-bearer",
  ringInDeck: "The One Ring is not a deck card",
  sameHero: "No two players use the same hero",
};

// A seat's saved deck as the deckbuilding check reads it: its heroes, and its cards counted by code.
function deckCounts(deck: readonly string[]): { code: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const code of deck) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts].map(([code, count]) => ({ code, count }));
}

function check(input: BriefingInput): { problems: Problem[]; loadout: LoadoutSeat[] } {
  const problems: Problem[] = [];
  const { world } = input;
  const nameOf = (code: string) => world.cards.get(code)?.name ?? code;
  // The hero count (1 to 3, rr.deckbuilding) runs on the saved deck.
  input.seats.slice(0, input.seatCount).forEach((seat, index) => {
    const label = input.seatCount === 1 ? "The deck" : `Seat ${index + 1}'s deck`;
    if (seat.deckId == null) problems.push({ rule: "Choose a deck", message: `Choose a saved deck for seat ${index + 1}.` });
    else if (seat.heroes.length < 1 || seat.heroes.length > 3) problems.push({ rule: "One to three heroes", message: `${label} has ${seat.heroes.length} heroes. A saved deck has one to three.` });
    else if (world.deckFacts) {
      // A deck saves before it is ready to play (rr.deckbuilding); it is not dealt until it is.
      const refusal = deckSaveRefusal(seat.heroes, deckCounts(seat.deck), world.deckFacts);
      if (refusal) problems.push({ rule: "The deck is ready to play", message: `${label} is not ready to play: ${formatDeckRefusal(refusal)}` });
    }
    for (const code of seat.heroes) {
      const fell = (input.log.fallenHeroesBySeat.flat()).includes(code);
      if (fell) problems.push({ rule: "A fallen hero cannot start", message: `${nameOf(code)} is a fallen hero and cannot start.` });
    }
  });
  const loadout = loadoutOf(input);
  if (problems.length === 0) {
    for (const error of validateLoadout(loadout, world.cards)) problems.push({ rule: RULE_OF[error.rule] ?? error.rule, message: error.message });
  }
  return { problems, loadout };
}

export function briefing(input: BriefingInput): Briefing {
  const { world, log } = input;
  const { problems, loadout } = check(input);
  const needsRingBearer = !deckHasRingBearer(world, input.seats[0]);
  const waived = recordInstructions(world.effects, world.scenario.campaignCard, "campaignSetup").some((instruction) => instruction.verb === "WaiveThreatPenalty");
  const empty: Briefing = { problems, needs: null, needsRingBearer, penaltyAdded: 0, penaltyWaived: waived, steps: [], dealable: false };
  if (problems.length > 0) return empty;

  const plan = checklist({ log, scenario: world.scenario, seats: loadout, effects: world.effects, cards: world.cards, ...(input.choices ? { choices: input.choices } : {}) });
  if (!plan.ok) {
    return { ...empty, needs: plan.needs, problems: plan.errors.map((message) => ({ rule: "Campaign Setup Checklist", message })) };
  }
  const penaltyAdded = plan.threatModifier - log.threatPenalty;
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
  const plan = checklist({ log, scenario: world.scenario, seats: loadout, effects: world.effects, cards: world.cards, ...(input.choices ? { choices: input.choices } : {}) });
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
// contributes at the difficulty, and the special rules the scenario's data declares, by name.
export function scenarioFacts(world: World, difficulty: Difficulty): ScenarioFacts {
  const { scenario } = world;
  const encounter = scenario.cards.filter((card) => card.pile === "encounter");
  const countOf = (card: (typeof encounter)[number]) => (difficulty === "Easy" ? card.easy : card.normal);
  const bySet = new Map<string, number>();
  for (const card of encounter) {
    const set = world.sets.get(card.code);
    if (set) bySet.set(set, (bySet.get(set) ?? 0) + countOf(card));
  }
  const sets = scenario.encounterSets.map((set) => ({ name: set.name, count: bySet.get(set.name) ?? set.count }));
  const rules: string[] = [];
  if (scenario.widgets.hide) rules.push("Hide");
  if (scenario.life != null) rules.push("Ring-bearer life");
  if (scenario.cards.some((card) => card.pile === "burden")) rules.push("Burden deck");
  if (scenario.widgets.secondActiveLocation) rules.push("Second active location");
  if (scenario.widgets.perSeatStaging) rules.push("Separate staging areas");
  if (recordInstructions(world.effects, scenario.campaignCard, "campaignSetup").some((instruction) => instruction.verb === "WaiveThreatPenalty")) rules.push("No hero-change penalty");
  return {
    number: scenario.number,
    name: scenario.name,
    stages: scenario.stages.map((code) => (world.cards.has(code) ? printedOf(world.cards, code).name : code)),
    sets,
    deckSize: encounter.reduce((sum, card) => sum + countOf(card), 0),
    rules,
  };
}
