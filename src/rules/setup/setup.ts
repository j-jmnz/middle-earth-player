// Rules: mec109.setting-up-the-game, rr.setup, rr.mulligan, ltp.easy-mode, easy-mode.easy-mode (data/rules/entries.json).
import type { ScenarioDefinition } from "../../catalog/boundary.ts";
import type { Difficulty } from "../../catalog/scenario-data.ts";

import { ruleCause } from "../core/cause.ts";
import { threatCostCut } from "../families/costs/stats.ts";
import type { EngineStep } from "../core/intents.ts";
import { recordStartingThreat } from "../families/quest/threat.ts";
import { questStageStart } from "../families/quest/setup.ts";
import { pushCardEffects } from "../interpret/effect-frames.ts";
import { timeOnReveal } from "../families/angmar/time.ts";
import { placeContracts } from "../families/sidequests/contract.ts";
import { setAsideEncounterCards } from "../families/sidequests/encounter.ts";
import { pushPlayerSetup } from "../families/sidequests/setup.ts";
import { drawOpeningHand, runInstruction, type ReduceContext } from "../interpret/interpret.ts";
import type { PileZone } from "../core/piles.ts";
import { printedOf } from "../core/printed.ts";
import { shuffleIds } from "../core/seed.ts";
import { modeAddsEasyResource, modeCardSetup, placeModeCard } from "./mode-card.ts";
import { handSetup, searchSetup } from "./search.ts";
import { attachPending } from "../families/angmar/burdens.ts";
import { nightmareDuringSetup, nightmareSetup } from "../families/nightmare/setup.ts";
import { blankScenario, livingSeats, updateCard, withMode, withSeat, withThreat, type ScenarioState } from "../core/state.ts";
import type { CampaignFacts } from "../core/campaign-state.ts";
import { placeCampaignCard } from "../families/burden/campaign.ts";
import { snapshotOf } from "../engine/undo.ts";
import { attachTo, moveCard, spawn } from "../core/zones.ts";
import { corsairTrait, stampRoutes } from "../families/sea/routes.ts";
import { markSideQuests } from "../families/wilderland/night-quest.ts";
import { markProgressNoted } from "../families/angmar/progress.ts";
import { markProgressHeld } from "../families/long-dark/hold.ts";
import { markCapture } from "../families/captured/entry.ts";
import { markEnemyDamage } from "../families/encounter/patrol.ts";
import { markSeatedRows } from "../families/encounter/seated.ts";
import { dealDoubleSided, dealUnchartedDeck, type DoubleSidedCard } from "../families/uncharted/deal.ts";

/** The prefix of an `afterMulligan` entry that is shuffled into the deck, not added to the hand, once the opening hands are final. */
export const AFTER_HAND = "deck:";

export type StartSeat = {
  heroes: readonly string[];
  deck: readonly string[];
  // Campaign Setup Checklist step 5 and the campaign card's Setup: boons and burdens attached to a hero at the start
  // (`host` is the hero's code), and cards a campaign card adds to the seat's hand before the opening hand is drawn.
  attachments?: readonly { host: string; code: string }[];
  hand?: readonly string[];
  // The permanent starting threat penalty this seat takes of its own, on top of the table's `threatModifier` (The Passage of the Marshes, docs/scenarios/the-two-towers.md, The Two Towers).
  threatPenalty?: number;
  // A raise of this seat's threat that step 7 of Setup makes after the initial threat level is set (the first player's search for Andúril, 145066:A:1: "raise each player's threat"), so it is not part of the starting threat level (rr.setup, rr.initial-threat-level).
  threatRaise?: number;
  // Resources each of this seat's heroes starts with beyond the usual (The Two Towers: "add 1 resource to each of his heroes' pools", 144069:A:2).
  resources?: number;
  // Cards a campaign card's Setup adds to the hand once the mulligan is over (AddToHandAfterMulligan): not drawn, not shuffled
  // back by a mulligan, not counted in the opening hand.
  // A code with the prefix AFTER_HAND is shuffled into the seat's deck instead ("shuffles that Recurring Nightmare into their deck after they draw their starting hand", 11197:B:1).
  afterMulligan?: readonly string[];
  // The cards the campaign card's Setup let this seat choose and a Resolution earns (ChooseCards `unearned`): recorded as a game fact (ScenarioState.chosenAtSetup).
  chosen?: readonly string[];
  // The boons this seat set aside, out of play, at Setup (SetAsideBoon, 146069:A:1): dealt to the set-aside area as the seat's own, so a later effect (GuardWithSetAside) can find and return them.
  setAside?: readonly string[];
  // The 14 Item or Artifact attachments a Burglar's Turn player chose from their collection: their loot deck (families/sidequests/loot.ts).
  loot?: readonly string[];
};

// The zones a scenario deals: every pile but the Evil Creatures discard pile, which starts empty.
type DealtZone = Exclude<PileZone, "evilCreaturesDiscard" | "smaugDiscard">;

export type StartScenario = {
  seatCount: 1 | 2;
  seed: number;
  threatModifier: number;
  definition: ScenarioDefinition;
  seats: readonly StartSeat[];
  encounterDeck: readonly string[];
  // Encounter-deck copies the campaign pool recorded for a seat (one entry per copy): the copy's controller, which its Setup line reads as the acting seat (search.ts).
  encounterOwners?: readonly { code: string; seat: number }[];
  questDeck: readonly string[];
  // The burden deck of the scenario, when it has one. It is shuffled into a deck beside the quest deck.
  burdenDeck?: readonly string[];
  // The non-ship enemies the scenario deals as its Corsair deck (dcce.corsair-deck), when it has one; "Prepare the Corsair deck" shuffles it.
  corsairDeck?: readonly string[];
  // The decks of Ered Mithrin the scenario deals (emce.caves-deck, emce.evil-creatures-deck), by zone; the quest card's Setup shuffles them.
  piles?: Readonly<Partial<Record<DealtZone, readonly string[]>>>;
  // The double-sided locations the scenario deals as its Uncharted deck (dcce.uncharted-deck), Lost Island side up; "Prepare the Uncharted deck" shuffles it.
  unchartedDeck?: readonly string[];
  // The cards with two sides that are two catalog cards: the Grotto deck the scenario deals (dcce.grotto-deck), each Grotto side up, and the Underwater side of a Grotto card the Setup sets aside; "Prepare the Grotto deck" shuffles it.
  doubleSided?: readonly DoubleSidedCard[];
  // Easy adds one resource to each hero's resource pool in Setup step 2 (easy-mode.easy-mode). Nightmare adds nothing here: its
  // deck and setup card are in the definition and the encounter deck. Normal when absent.
  difficulty?: Difficulty;
  // The campaign log's structured facts (prisoner, once-per-campaign uses, counters), in Campaign Mode.
  facts?: CampaignFacts;
};

// Each recorded copy takes the next encounter-deck card of its code that has no controller yet.
function ownEncounterCopies(state: ScenarioState, owners: readonly { code: string; seat: number }[]): ScenarioState {
  let next = state;
  for (const owner of owners) {
    const id = next.encounterDeck.find((candidate) => next.cards[candidate]?.code === owner.code && next.cards[candidate]?.controller == null);
    if (id) next = updateCard(next, id, { controller: owner.seat });
  }
  return next;
}

export function startScenario(input: StartScenario, ctx: ReduceContext): ScenarioState {
  let state = blankScenario({
    seatCount: input.seatCount,
    seed: input.seed,
    definition: input.definition,
  });
  // The campaign log's facts come first: an upgraded card is dealt on its Upgraded side wherever the campaign deals it (families/dreamchaser/facts.ts).
  if (input.facts) state = { ...state, campaignFacts: input.facts };
  input.questDeck.forEach((code, index) => {
    const spawned = spawn(state, code, index === 0 ? { zone: "questStage" } : { zone: "questDeck" }, "A");
    state = spawned.state;
  });
  for (const code of input.encounterDeck) {
    state = spawn(state, code, { zone: "encounterDeck" }).state;
  }
  state = ownEncounterCopies(state, input.encounterOwners ?? []);
  state = shuffleZone(state, "encounter");
  if (input.burdenDeck && input.burdenDeck.length > 0) {
    for (const code of input.burdenDeck) state = spawn(state, code, { zone: "burdenDeck" }).state;
    const shuffled = shuffleIds(state.burdenDeck ?? [], state.seed, state.seedCursor);
    state = { ...state, burdenDeck: shuffled.ids, seedCursor: shuffled.cursor };
  }
  // The Corsair deck: dealt apart from the encounter deck, shuffled by its Setup step (families/sea/corsair.ts).
  if (input.corsairDeck && input.corsairDeck.length > 0) {
    state = { ...state, corsairDeck: [], corsairDiscard: [] };
    for (const code of input.corsairDeck) state = spawn(state, code, { zone: "corsairDeck" }).state;
  }
  for (const [zone, codes] of Object.entries(input.piles ?? {}) as [DealtZone, readonly string[]][]) {
    for (const code of codes) state = spawn(state, code, { zone }).state;
    // The Evil Creatures deck has a discard pile of its own, which exists from the start (emce.evil-creatures-deck).
    if (zone === "evilCreaturesDeck") state = { ...state, piles: { ...state.piles, evilCreaturesDiscard: state.piles?.evilCreaturesDiscard ?? [] } };
    // So does the Smaug deck (docs/scenarios/standalone-scenarios.md, The Battle of Lake-town).
    if (zone === "smaugDeck") state = { ...state, piles: { ...state.piles, smaugDiscard: state.piles?.smaugDiscard ?? [] } };
  }
  if (input.unchartedDeck && input.unchartedDeck.length > 0) state = dealUnchartedDeck(state, input.unchartedDeck, ctx);
  if (input.doubleSided && input.doubleSided.length > 0) state = dealDoubleSided(state, input.doubleSided, ctx);
  // A game that deals encounter side quests in its encounter deck reads the side quest rules (families/wilderland/night-quest.ts).
  state = markSideQuests(state, ctx.cards);
  state = markProgressNoted(state, ctx);
  state = markProgressHeld(state, ctx);
  state = placeCampaignCard(state, input.definition.campaignCard, ctx);
  state = markCapture(state, ctx);
  state = markEnemyDamage(state, ctx);
  state = markSeatedRows(state, ctx);
  // The Nightmare setup card, side A faceup next to the quest deck: its lines stay active all game (docs/scenarios/nightmare.md, Nightmare).
  if (input.definition.nightmareCard) state = spawn(state, input.definition.nightmareCard, { zone: "nightmare" }, "A").state;
  const chosen = input.seats.slice(0, input.seatCount).flatMap((seat, at) => (seat.chosen ?? []).map((code) => ({ code, seat: at })));
  if (chosen.length > 0) state = { ...state, chosenAtSetup: chosen };
  if (input.seats.some((seat) => (seat.afterMulligan?.length ?? 0) > 0)) state = { ...state, afterMulligan: input.seats.slice(0, input.seatCount).map((seat) => seat.afterMulligan ?? []) };
  for (let index = 0; index < input.seatCount; index += 1) {
    const seat = input.seats[index];
    if (!seat) throw new Error(`Missing seat ${index}`);
    let threat = input.threatModifier + (seat.threatPenalty ?? 0);
    for (const code of seat.heroes) {
      const placed = spawn(state, code, { zone: "heroes", seat: index });
      // Easy mode: "During step 2 of Setup, 'Place Heroes and Set Initial Threat Levels', add one resource to each hero's
      // resource pool" (easy-mode.easy-mode; ltp.easy-mode step 1, which says only "during setup").
      const starting = (input.difficulty === "Easy" && !modeAddsEasyResource(input.definition, ctx) ? 1 : 0) + (seat.resources ?? 0);
      state = starting > 0 ? updateCard(placed.state, placed.id, { resources: starting }) : placed.state;
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
    for (const code of seat.setAside ?? []) {
      const aside = spawn(state, code, { zone: "setAside" }, "down");
      state = updateCard(aside.state, aside.id, { owner: index });
    }
    // The cards with the Encounter keyword are set aside, not drawn (families/sidequests/encounter.ts).
    state = setAsideEncounterCards(state, index, ctx);
    // A contract in the deck begins the game in its player's play area (families/sidequests/contract.ts).
    state = placeContracts(state, index, ctx);
    // Threat costs lowered by a card in play ("Each hero you control with a printed Lore resource icon gets -1 threat cost").
    threat -= threatCostCut(state, index, ctx);
    // A campaign's reduction of the starting threat (Fend Off Despair, 10173:A:2) never takes a seat below 0.
    state = withThreat(state, index, Math.max(0, threat));
    state = shuffleZone(state, index);
  }
  if (input.seats.some((seat) => (seat.loot?.length ?? 0) > 0)) state = { ...state, lootPlan: input.seats.slice(0, input.seatCount).map((seat) => seat.loot ?? []) };
  // The sea family's routes for the cards that do not go to the encounter discard pile (families/sea/routes.ts): only in a game with ships.
  state = stampRoutes(state, ctx.cards, corsairTrait(ctx.effects, input.definition.modeCard?.code));
  // The starting threat level, for a card that reduces threat back to it (04053:A:2).
  state = recordStartingThreat(state, ctx);
  // The raises of Setup step 7 come after the initial threat level is recorded.
  for (let index = 0; index < input.seatCount; index += 1) {
    const raise = input.seats[index]?.threatRaise ?? 0;
    if (raise > 0) state = withThreat(state, index, (state.seats[index]?.threat ?? 0) + raise);
  }
  const quiet: EngineStep[] = [];
  state = searchSetup(state, "player", ctx, quiet);
  state = handSetup(state, ctx, quiet);
  for (const seat of livingSeats(state)) state = drawOpeningHand(state, seat, quiet, ctx);
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
  // The Setup lines of the players' heroes and contracts resolve first, in frames that can ask (families/sidequests/setup.ts).
  const players = pushPlayerSetup(state, ctx, steps);
  if (players !== state) return players;
  let next = searchSetup(state, "encounter", ctx, steps);
  // The Nightmare setup card's own Setup lines (families/nightmare/setup.ts).
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
  // The scenario's mode card with a Setup of its own comes before the quest card's, once the piles have put Annúminas in the staging area (setup/mode-card.ts).
  next = modeCardSetup(next, ctx, steps);
  if (next.failure || next.lost) return next;
  // The quest card's Setup can deal a card that reads progress on a side quest (Lie Low, shuffled in by Into the Ettenmoors, 10064:A:1): the game notes it now.
  next = markProgressNoted(next, ctx);
  if (next.questStage) next = timeOnReveal(updateCard(next, next.questStage, { face: "B" }), next.questStage, ctx);
  // A pool card's Setup that waited for a host the quest card's Setup puts into play, and the campaign card's Setup that needs the quest card's Setup done first (ScenarioDefinition.afterSetup), go down first, so they resolve after it.
  next = attachPending(next, ctx, steps);
  next = campaignAfterSetup(next, ctx, steps);
  // The first quest card's own Setup that reveals cards, and its side B's When Revealed (families/quest/setup.ts).
  next = questStageStart(next, ctx, steps, (current) => campaignBeforeReveal(current, ctx, steps));
  // The Nightmare setup card's Forced effects "During setup" (families/nightmare/setup.ts), on top: they resolve first.
  next = nightmareDuringSetup(next, ctx, steps);
  // The Hard/Expert Mode card is put next to the quest deck at the end of setup, faceup on the side the players chose, and stays all game (dcce.hard-expert).
  next = placeModeCard(next);
  return withMode(next, "beginRound");
}

// The campaign card's Setup instructions that name what the quest card's Setup prepares (the ship-objectives of the Dream-chaser's fleet): one frame, whose
// cause is the campaign card's Setup record.
function campaignAfterSetup(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const after = state.afterSetup;
  const stage = state.questStage;
  if (!after || !stage) return state;
  const record = ctx.effects.find((effect) => effect.cardCode === after.card && effect.timing === "campaignSetup");
  if (!record) return state;
  return pushCardEffects(state, "setup", stage, state.firstPlayer, false, [{ ...record, instructions: [...after.instructions] }], ctx, steps);
}

// The campaign card's Setup that resolves after the quest card's Setup and before its side B's When Revealed (ScenarioDefinition.beforeReveal): one frame, whose cause is the campaign card's Setup record.
function campaignBeforeReveal(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const before = state.beforeReveal;
  const stage = state.questStage;
  if (!before || !stage) return state;
  const record = ctx.effects.find((effect) => effect.cardCode === before.card && effect.timing === "campaignSetup");
  if (!record) return state;
  return pushCardEffects(state, "setup", stage, state.firstPlayer, false, [{ ...record, instructions: [...before.instructions] }], ctx, steps);
}

export function mulliganSeat(state: ScenarioState, seat: number, steps: EngineStep[], ctx: ReduceContext): ScenarioState {
  let next = unannounceHand(state, seat);
  for (const id of [...(next.seats[seat]?.hand ?? [])]) next = moveCard(next, id, { zone: "deck", seat });
  const seatState = next.seats[seat];
  if (!seatState) return next;
  const shuffled = shuffleIds(seatState.deck, next.seed, next.seedCursor);
  next = { ...withSeat(next, seat, { ...seatState, deck: shuffled.ids }), seedCursor: shuffled.cursor };
  return drawOpeningHand(next, seat, steps, ctx, ruleCause("rr.mulligan"));
}

// A card of the hand a mulligan shuffles back never entered the player's hand for good: the draw's announcement of it ("Forced: After you draw this card",
// mec112.poisoned-counsels-searching-eye) is withdrawn, and only the cards of the new hand are announced.
function unannounceHand(state: ScenarioState, seat: number): ScenarioState {
  const hand = new Set(state.seats[seat]?.hand ?? []);
  const kept = (state.pendingEvents ?? []).filter((event) => !(event.trigger === "enteredHand" && event.cardId != null && hand.has(event.cardId)));
  return kept.length === (state.pendingEvents ?? []).length ? state : { ...state, pendingEvents: kept };
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
    for (const code of codes) next = code.startsWith(AFTER_HAND) ? shuffleIntoDeck(next, seat, code.slice(AFTER_HAND.length)) : spawn(next, code, { zone: "hand", seat }).state;
  });
  const { afterMulligan: _dealt, ...rest } = next;
  return rest;
}

// A card joins a player's deck and the deck is shuffled (a pool card that is shuffled in after the starting hand).
function shuffleIntoDeck(state: ScenarioState, seat: number, code: string): ScenarioState {
  return shuffleZone(spawn(state, code, { zone: "deck", seat }).state, seat);
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
