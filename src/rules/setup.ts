// Rules: mec109.setting-up-the-game, rr.setup, rr.mulligan, ltp.easy-mode, easy-mode.easy-mode (data/rules/entries.json).
import type { ScenarioDefinition } from "../catalog/boundary.ts";
import type { Difficulty } from "../catalog/scenario-data.ts";

import { ruleCause } from "./cause.ts";
import { threatCostCut } from "./families/costs-stats.ts";
import type { EngineStep } from "./intents.ts";
import { recordStartingThreat } from "./families/quest-threat.ts";
import { questStageStart } from "./families/quest-setup.ts";
import { placeContracts } from "./families/sidequests-contract.ts";
import { setAsideEncounterCards } from "./families/sidequests-encounter.ts";
import { pushPlayerSetup } from "./families/sidequests-setup.ts";
import { drawOpeningHand, runInstruction, type ReduceContext } from "./interpret.ts";
import { printedOf } from "./printed.ts";
import { shuffleIds } from "./seed.ts";
import { handSetup, searchSetup } from "./setup-search.ts";
import { nightmareDuringSetup, nightmareSetup } from "./families/nightmare-setup.ts";
import { blankScenario, livingSeats, updateCard, withMode, withSeat, withThreat, type ScenarioState } from "./state.ts";
import type { CampaignFacts } from "./campaign-state.ts";
import { placeCampaignCard } from "./families/burden-campaign.ts";
import { snapshotOf } from "./undo.ts";
import { attachTo, moveCard, spawn } from "./zones.ts";
import { stampRoutes } from "./families/sea-routes.ts";

export type StartSeat = {
  heroes: readonly string[];
  deck: readonly string[];
  // Campaign Setup Checklist step 5 and the campaign card's Setup: boons and burdens attached to a hero at the start
  // (`host` is the hero's code), and cards a campaign card adds to the seat's hand before the opening hand is drawn.
  attachments?: readonly { host: string; code: string }[];
  hand?: readonly string[];
  // Cards a campaign card's Setup adds to the hand once the mulligan is over (AddToHandAfterMulligan): not drawn, not shuffled
  // back by a mulligan, not counted in the opening hand.
  afterMulligan?: readonly string[];
  // The 14 Item or Artifact attachments a Burglar's Turn player chose from their collection: their loot deck (families/sidequests-loot.ts).
  loot?: readonly string[];
};

export type StartScenario = {
  seatCount: 1 | 2;
  seed: number;
  threatModifier: number;
  definition: ScenarioDefinition;
  seats: readonly StartSeat[];
  encounterDeck: readonly string[];
  questDeck: readonly string[];
  // The burden deck of the scenario, when it has one. It is shuffled into a deck beside the quest deck.
  burdenDeck?: readonly string[];
  // The non-ship enemies the scenario deals as its Corsair deck (dcce.corsair-deck), when it has one; "Prepare the Corsair deck" shuffles it.
  corsairDeck?: readonly string[];
  // Easy adds one resource to each hero's resource pool in Setup step 2 (easy-mode.easy-mode). Nightmare adds nothing here: its
  // deck and setup card are in the definition and the encounter deck. Normal when absent.
  difficulty?: Difficulty;
  // The campaign log's structured facts (prisoner, once-per-campaign uses, counters), in Campaign Mode.
  facts?: CampaignFacts;
};

export function startScenario(input: StartScenario, ctx: ReduceContext): ScenarioState {
  let state = blankScenario({
    seatCount: input.seatCount,
    seed: input.seed,
    definition: input.definition,
  });
  // The campaign log's facts come first: an upgraded card is dealt on its Upgraded side wherever the campaign deals it (families/dreamchaser-facts.ts).
  if (input.facts) state = { ...state, campaignFacts: input.facts };
  input.questDeck.forEach((code, index) => {
    const spawned = spawn(state, code, index === 0 ? { zone: "questStage" } : { zone: "questDeck" }, "A");
    state = spawned.state;
  });
  for (const code of input.encounterDeck) {
    state = spawn(state, code, { zone: "encounterDeck" }).state;
  }
  state = shuffleZone(state, "encounter");
  if (input.burdenDeck && input.burdenDeck.length > 0) {
    for (const code of input.burdenDeck) state = spawn(state, code, { zone: "burdenDeck" }).state;
    const shuffled = shuffleIds(state.burdenDeck ?? [], state.seed, state.seedCursor);
    state = { ...state, burdenDeck: shuffled.ids, seedCursor: shuffled.cursor };
  }
  // The Corsair deck: dealt apart from the encounter deck, shuffled by its Setup step (families/sea-corsair.ts).
  if (input.corsairDeck && input.corsairDeck.length > 0) {
    state = { ...state, corsairDeck: [], corsairDiscard: [] };
    for (const code of input.corsairDeck) state = spawn(state, code, { zone: "corsairDeck" }).state;
  }
  state = placeCampaignCard(state, input.definition.campaignCard, ctx);
  // The Nightmare setup card, side A faceup next to the quest deck: its lines stay active all game (docs/plans/nightmare-mode.md).
  if (input.definition.nightmareCard) state = spawn(state, input.definition.nightmareCard, { zone: "nightmare" }, "A").state;
  if (input.seats.some((seat) => (seat.afterMulligan?.length ?? 0) > 0)) state = { ...state, afterMulligan: input.seats.slice(0, input.seatCount).map((seat) => seat.afterMulligan ?? []) };
  for (let index = 0; index < input.seatCount; index += 1) {
    const seat = input.seats[index];
    if (!seat) throw new Error(`Missing seat ${index}`);
    let threat = input.threatModifier;
    for (const code of seat.heroes) {
      const placed = spawn(state, code, { zone: "heroes", seat: index });
      // Easy mode: "During step 2 of Setup, 'Place Heroes and Set Initial Threat Levels', add one resource to each hero's
      // resource pool" (easy-mode.easy-mode; ltp.easy-mode step 1, which says only "during setup").
      state = input.difficulty === "Easy" ? updateCard(placed.state, placed.id, { resources: 1 }) : placed.state;
      threat += printedOf(ctx.cards, code).threat ?? 0;
    }
    for (const attached of seat.attachments ?? []) {
      const host = Object.values(state.cards).find((card) => card.code === attached.host && card.controller === index && card.zone === "heroes");
      if (!host) throw new Error(`Seat ${index} has no hero ${attached.host} to attach ${attached.code} to`);
      const spawned = spawn(state, attached.code, { zone: "play", seat: index });
      state = attachTo(spawned.state, spawned.id, host.id);
    }
    for (const code of seat.hand ?? []) state = spawn(state, code, { zone: "hand", seat: index }).state;
    for (const code of seat.deck) state = spawn(state, code, { zone: "deck", seat: index }).state;
    // The cards with the Encounter keyword are set aside, not drawn (families/sidequests-encounter.ts).
    state = setAsideEncounterCards(state, index, ctx);
    // A contract in the deck begins the game in its player's play area (families/sidequests-contract.ts).
    state = placeContracts(state, index, ctx);
    // Threat costs lowered by a card in play ("Each hero you control with a printed Lore resource icon gets -1 threat cost").
    threat -= threatCostCut(state, index, ctx);
    state = withThreat(state, index, threat);
    state = shuffleZone(state, index);
  }
  if (input.seats.some((seat) => (seat.loot?.length ?? 0) > 0)) state = { ...state, lootPlan: input.seats.slice(0, input.seatCount).map((seat) => seat.loot ?? []) };
  // The sea family's routes for the cards that do not go to the encounter discard pile (families/sea-routes.ts): only in a game with ships.
  state = stampRoutes(state, ctx.cards);
  // The starting threat level, for a card that reduces threat back to it (04053:A:2).
  state = recordStartingThreat(state, ctx);
  const quiet: EngineStep[] = [];
  state = searchSetup(state, "player", ctx, quiet);
  state = handSetup(state, ctx, quiet);
  for (const seat of livingSeats(state)) state = drawOpeningHand(state, seat, quiet);
  state = {
    ...withMode(state, "mulligan"),
    window: { kind: "mulligan" },
    activeSeat: state.firstPlayer,
  };
  return {
    ...state,
    undo: snapshotOf(state),
  };
}

export function finishSetup(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // The Setup lines of the players' heroes and contracts resolve first, in frames that can ask (families/sidequests-setup.ts).
  const players = pushPlayerSetup(state, ctx, steps);
  if (players !== state) return players;
  let next = searchSetup(state, "encounter", ctx, steps);
  // The Nightmare setup card's own Setup lines (families/nightmare-setup.ts).
  next = nightmareSetup(next, ctx, steps);
  if (next.failure || next.lost) return next;
  for (const instruction of next.setup) {
    next = runInstruction(
      next,
      instruction,
      { seat: next.firstPlayer, sourceId: next.questStage },
      ctx,
      steps,
    );
    if (next.failure || next.lost) return next;
  }
  if (next.questStage) next = updateCard(next, next.questStage, { face: "B" });
  // The first quest card's own Setup that reveals cards, and its side B's When Revealed (families/quest-setup.ts).
  next = questStageStart(next, ctx, steps);
  // The Nightmare setup card's Forced effects "During setup" (families/nightmare-setup.ts), on top: they resolve first.
  next = nightmareDuringSetup(next, ctx, steps);
  // The Hard/Expert Mode card is put next to the quest deck at the end of setup, faceup on the side the players chose, and stays all game (dcce.hard-expert).
  if (next.modeCard) next = spawn(next, next.modeCard.code, { zone: "modeCard" }, next.modeCard.side).state;
  return withMode(next, "beginRound");
}

export function mulliganSeat(state: ScenarioState, seat: number, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const id of [...(next.seats[seat]?.hand ?? [])]) next = moveCard(next, id, { zone: "deck", seat });
  const seatState = next.seats[seat];
  if (!seatState) return next;
  const shuffled = shuffleIds(seatState.deck, next.seed, next.seedCursor);
  next = { ...withSeat(next, seat, { ...seatState, deck: shuffled.ids }), seedCursor: shuffled.cursor };
  return drawOpeningHand(next, seat, steps, ruleCause("rr.mulligan"));
}

export function finishMulliganChoice(state: ScenarioState, took: boolean): ScenarioState {
  const seat = state.activeSeat;
  const mulliganSeats = took && !state.mulliganSeats.includes(seat)
    ? [...state.mulliganSeats, seat]
    : state.mulliganSeats;
  const passed = state.passed.includes(seat) ? state.passed : [...state.passed, seat];
  const nextSeat = livingSeats(state).find((index) => !passed.includes(index));
  if (nextSeat == null) {
    return {
      ...withMode(dealAfterMulligan(state), "afterOpening"),
      window: null,
      passed: [],
      mulliganSeats,
      mulliganTaken: mulliganSeats.length > 0,
    };
  }
  return {
    ...state,
    passed,
    activeSeat: nextSeat,
    mulliganSeats,
    mulliganTaken: mulliganSeats.includes(nextSeat),
  };
}

// AddToHandAfterMulligan: once every seat has chosen, the cards a campaign card adds "after drawing the starting hand (including
// taking a mulligan)" join each hand, and the list is dropped.
function dealAfterMulligan(state: ScenarioState): ScenarioState {
  if (!state.afterMulligan) return state;
  let next = state;
  state.afterMulligan.forEach((codes, seat) => {
    for (const code of codes) next = spawn(next, code, { zone: "hand", seat }).state;
  });
  const { afterMulligan: _dealt, ...rest } = next;
  return rest;
}

function shuffleZone(state: ScenarioState, zone: "encounter" | number): ScenarioState {
  if (zone === "encounter") {
    const shuffled = shuffleIds(state.encounterDeck, state.seed, state.seedCursor);
    return { ...state, encounterDeck: shuffled.ids, seedCursor: shuffled.cursor };
  }
  const seat = state.seats[zone];
  if (!seat) return state;
  const shuffled = shuffleIds(seat.deck, state.seed, state.seedCursor);
  return {
    ...withSeat(state, zone, { ...seat, deck: shuffled.ids }),
    seedCursor: shuffled.cursor,
  };
}
