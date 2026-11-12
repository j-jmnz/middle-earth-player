// Rules: ltp.campaign-cards, rr.campaign-cards (Resolution on the back of the campaign card), ltp.campaign-pool,
// rr.fellowship-of-heroes, emce.treasure, emce.boon-allies, emce.campaign-pool-encounter (data/rules/entries.json).
import type { Instruction } from "../../catalog/boundary.ts";

import { holds } from "../interpret/conditions.ts";
import type { LegalIntent, PlayerIntent } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { fallenBase, printedOf } from "../core/printed.ts";
import type { Earned, ResolutionLog } from "../core/campaign-state.ts";
import { frameScope, resolveAmount } from "../interpret/amounts.ts";
import { xpOf } from "../families/dreamchaser/index.ts";
import { dealtCopies } from "../families/aflame/cards.ts";
import { shuffleIds } from "../core/seed.ts";
import { inPlay, livingSeats, type ScenarioState } from "../core/state.ts";
import { discardToPoolFromSets } from "../families/wilderland/mirkwood.ts";
import { addEncounterCards, allyOrLineOptions, applyAllyOrLine, applyRemoval, applyStagedLocation, discoverTreasures, noteRemovalAnswer, playerOptions, removalOptions, removeEncounterCards, stagedLocationOptions } from "../families/wilderland/pool.ts";
import { drawTreasures } from "../families/wilderland/treasure.ts";
import { applyHazard, discardHazards, hazardOptions } from "../families/wilderland/hazards.ts";
import { recordDamageOn, recordHeroDamage } from "../families/campaign/damage-tracking.ts";
import { endCampaign, ignoreDiscardedHeroes, loseGuardedBoons, recordTokens, removeFromPool, threatDialCopies } from "../families/campaign/saga-end.ts";
import { applyChooseOption, applyRevive, applyTrim, boonHeroes, chooseOptionIds, earnForPick, earnHeldCopies, reviveOptions, threatPenalties, trimOptions, underneath } from "../families/campaign/resolution.ts";

// A won scenario runs the campaign card's Resolution instructions in order. An instruction that opens a choice asks
// one seat at a time, first player first; the rest settle on their own from the final state (Lust for the Ring
// attached, The Balrog in play, Fallen into Evil attached). The codes come from the records; this file names none.

export const SKIP = "skip";

// The instructions that open a window for the players: a card to take, a captive to name, a boon ally or its log line (BoonAllyOrLogLine), a card of the pool to remove (RemoveFromPool with a choice),
// a treasure, hazard or staged location for the pool, and The Two Towers' own choices (ChooseOption, ReviveFallenHero, TrimHeroes).
export type Choosing = Extract<Instruction, { verb: "ChooseCards" | "NameCaptives" | "BoonAllyOrLogLine" | "RemoveFromPool" | "ChooseRandomTreasure" | "ChooseStagedLocationForPool" | "ChooseHazardForPool" | "ChooseOption" | "ReviveFallenHero" | "TrimHeroes" }>;

const ASKING: ReadonlySet<Instruction["verb"]> = new Set<Instruction["verb"]>(["ChooseCards", "NameCaptives", "BoonAllyOrLogLine", "ChooseRandomTreasure", "ChooseHazardForPool", "ChooseStagedLocationForPool", "ChooseOption", "ReviveFallenHero", "TrimHeroes"]);

/** Whether the Resolution instruction asks the players: a card to take, a captive to name, a boon ally or its log line, a treasure, hazard or location, one of The Two Towers' choices, a card of the pool to remove (a RemoveFromPool with no choice settles at once). */
export function asksPlayers(instruction: Instruction | undefined): instruction is Choosing {
  if (!instruction) return false;
  return ASKING.has(instruction.verb) || (instruction.verb === "RemoveFromPool" && instruction.choice != null);
}

function seatOrder(state: ScenarioState): number[] {
  const living = livingSeats(state);
  const at = Math.max(0, living.indexOf(state.firstPlayer));
  return [...living.slice(at), ...living.slice(0, at)];
}

function seatsFor(state: ScenarioState, instruction: Choosing): number[] {
  const order = seatOrder(state);
  // The group answers a boon ally's offer through its first player; a removal from the pool is each player's, first player first.
  if (instruction.verb === "NameCaptives" || instruction.verb === "RemoveFromPool" || instruction.verb === "ChooseStagedLocationForPool" || instruction.verb === "TrimHeroes") return order;
  if (instruction.verb === "BoonAllyOrLogLine" || instruction.verb === "ChooseRandomTreasure" || instruction.verb === "ChooseHazardForPool" || instruction.verb === "ReviveFallenHero") return order.slice(0, 1);
  return instruction.who === "firstPlayer" ? order.slice(0, 1) : order;
}

function heroesOf(state: ScenarioState, seat: number, anyHero?: boolean): string[] {
  return anyHero ? livingSeats(state).flatMap((index) => state.seats[index]?.heroes ?? []) : [...(state.seats[seat]?.heroes ?? [])];
}

function stepOver(state: ScenarioState, log?: ResolutionLog): ScenarioState {
  return { ...state, resolutionAt: state.resolutionAt + 1, resolutionSeat: 0, ...(log ? { resolutionLog: log } : {}) };
}

// A copy of a code is one entry however often it is earned, whichever seat wrote it. Only "each player earns 1 copy" (perPlayer)
// adds a copy for a seat that holds none: The Ring Draws Them chosen by seat 0 and then earned again from the encounter deck is
// still one card.
// A per-player copy that names its hero (a card attached to a hero, EarnAttached) is one copy for each hero: a player whose two heroes
// each carry a copy takes both into the pool. A held copy is read as `{ code, seat, hero }` (`hero`: the hero it is on, or null), so an
// earned entry and a pool entry go through one shape; `heldCopy` makes it.
export type HeldCopy = { code: string; seat: number | null; hero: string | null; copy?: number };

export function heldCopy(entry: { code: string; seat: number | null; hero?: string | null; attachedTo?: string | null; copy?: number }): HeldCopy {
  return { code: entry.code, seat: entry.seat, hero: entry.hero ?? entry.attachedTo ?? null, ...(entry.copy != null ? { copy: entry.copy } : {}) };
}

export function holdsCopy(held: readonly HeldCopy[], item: Pick<Earned, "code" | "seat" | "perPlayer" | "copy"> & { hero?: string | null }): boolean {
  // A numbered copy (Recurring Nightmare, two of one code) is held when that number is.
  if (item.copy != null) return held.some((have) => have.code === item.code && have.copy === item.copy);
  if (item.perPlayer && item.hero != null) return held.some((have) => have.code === item.code && have.hero === item.hero);
  return held.some((have) => have.code === item.code && (!item.perPlayer || have.seat === item.seat));
}

function earn(state: ScenarioState, entries: readonly Earned[]): ResolutionLog {
  const have = state.resolutionLog.earned;
  return { ...state.resolutionLog, earned: [...have, ...entries.filter((item) => !holdsCopy(have.map(heldCopy), item))] };
}

// The entries one instruction hands out: one copy of each code, or one for each player at the table. An eliminated player is
// still in the campaign, so every seat counts.
function copiesOf(state: ScenarioState, codes: readonly string[], eachPlayer: boolean | undefined, afterHand?: true, forFirstPlayer?: true): Earned[] {
  const seats = eachPlayer ? Array.from({ length: state.seatCount }, (_, seat) => seat) : [forFirstPlayer ? state.firstPlayer : null];
  return seats.flatMap((seat) => codes.map((code) => ({ code, to: "pool" as const, seat, hero: null, step: state.resolutionAt, ...(eachPlayer ? { perPlayer: true } : {}), ...(afterHand ? { afterHand } : {}) })));
}

// Each copy of these cards attached to a hero in play, with that hero: one entry for each copy (EarnAttached), `to: "hero"` as a card the
// players attach to a hero. The hero's seat owns it.
function attachedCopies(state: ScenarioState, codes: readonly string[], ctx: ReduceContext): Earned[] {
  return Object.values(state.cards).flatMap((card) => {
    const host = card.host ? state.cards[card.host] : undefined;
    if (!codes.includes(card.code) || !inPlay(card.zone) || !host || host.zone !== "heroes" || host.controller == null) return [];
    return printedOf(ctx.cards, host.code).type === "hero" ? [{ code: card.code, to: "hero" as const, seat: host.controller, hero: host.code, step: state.resolutionAt, perPlayer: true }] : [];
  });
}

// The hero in play with the most damage; a tie is broken at random with the game's seed (01130:B:1). The cursor is the seed's place
// afterwards. No hero in play names no prisoner.
function prisonerOf(state: ScenarioState, ctx: ReduceContext): { hero: string | null; cursor: number } {
  const heroIds = livingSeats(state).flatMap((seat) => state.seats[seat]?.heroes ?? []);
  const heroes = heroIds.flatMap((id) => {
    const card = state.cards[id];
    return card && printedOf(ctx.cards, card.code).type === "hero" ? [card] : [];
  });
  const most = Math.max(-1, ...heroes.map((hero) => hero.damage));
  const tied = heroes.filter((hero) => hero.damage === most).map((hero) => hero.code);
  if (tied.length === 0) return { hero: null, cursor: state.seedCursor };
  if (tied.length === 1) return { hero: tied[0] ?? null, cursor: state.seedCursor };
  const rolled = shuffleIds(tied, state.seed, state.seedCursor);
  return { hero: rolled.ids[0] ?? null, cursor: rolled.cursor };
}

// Every burden in play or still in the encounter deck or discard pile: the cards the players could meet again.
function burdensEverywhere(state: ScenarioState, ctx: ReduceContext): string[] {
  return Object.values(state.cards)
    .filter((card) => (inPlay(card.zone) || card.zone === "encounterDeck" || card.zone === "encounterDiscard") && printedOf(ctx.cards, card.code).campaignKind === "burden")
    .map((card) => card.code);
}

// Runs every instruction that needs no answer, and opens the window of the first that does.
export function advanceResolution(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  let next = state;
  while (next.resolutionAt < next.resolution.length) {
    const instruction = next.resolution[next.resolutionAt];
    if (!instruction) break;
    const scope = { actor: next.firstPlayer, sourceId: null, returned: 0 };
    if ("when" in instruction && instruction.when && !holds(next, instruction.when, scope, ctx)) {
      next = stepOver(next);
      continue;
    }
    switch (instruction.verb) {
      case "Earn":
        next = stepOver(next, earn(next, copiesOf(next, instruction.codes, instruction.eachPlayer, instruction.afterHand, instruction.forFirstPlayer)));
        break;
      // The Two Towers (families/campaign/resolution.ts): what each answer wrote, and the enemies under a card, recorded without asking anyone.
      case "ThreatPenaltyForPick":
        next = stepOver(next, threatPenalties(next, instruction));
        break;
      case "EarnForPick":
        next = stepOver(next, earn(next, earnForPick(next, instruction)));
        break;
      case "EarnHeldCopies":
        next = stepOver(next, earn(next, earnHeldCopies(next, instruction)));
        break;
      case "RecordUnderneath":
        next = stepOver(next, { ...next.resolutionLog, underneath: underneath(next, instruction.code) });
        break;
      // The Return of the King (families/campaign/saga-end.ts).
      case "EarnOnThreatDial":
        next = stepOver(next, earn(next, threatDialCopies(next, instruction)));
        break;
      case "RecordTokens":
        next = stepOver(next, recordTokens(next, instruction));
        break;
      case "RecordDamageOn":
        next = stepOver(next, recordDamageOn(next, instruction));
        break;
      case "RecordHeroDamage":
        next = stepOver(next, recordHeroDamage(next));
        break;
      case "RemoveFromPoolByCode":
        next = stepOver(next, removeFromPool(next, instruction));
        break;
      case "LoseGuardedBoons":
        next = stepOver(next, loseGuardedBoons(next, instruction, ctx));
        break;
      case "IgnoreDiscardedHeroes":
        next = stepOver(next, ignoreDiscardedHeroes(next));
        break;
      case "EndCampaign":
        next = stepOver(next, endCampaign(next, instruction));
        break;
      // The copies of these cards the game holds, whoever played them (families/aflame/cards.ts).
      case "EarnDealt":
        next = stepOver(next, earn(next, dealtCopies(next, instruction.codes, next.resolutionAt)));
        break;
      case "CarryOver": {
        // The next campaign's cards, one copy each or one for each player (the new save's seats decide how many); no dedupe.
        const carried = instruction.eachPlayer ? instruction.codes.map((code) => ({ code, to: "pool" as const, seat: null, hero: null, step: next.resolutionAt, perPlayer: true })) : copiesOf(next, instruction.codes, false);
        next = stepOver(next, { ...next.resolutionLog, carryOver: [...(next.resolutionLog.carryOver ?? []), ...carried] });
        break;
      }
      case "EarnAttached":
        next = stepOver(next, earn(next, attachedCopies(next, instruction.codes, ctx)));
        break;
      case "NamePrisoner": {
        const named = prisonerOf(next, ctx);
        next = { ...stepOver(next, { ...next.resolutionLog, prisoner: named.hero }), seedCursor: named.cursor };
        break;
      }
      case "EarnAllBurdens":
        next = stepOver(next, earn(next, burdensEverywhere(next, ctx).map((code) => ({ code, to: "pool" as const, seat: null, hero: null, step: next.resolutionAt }))));
        break;
      case "GainXp": {
        // One line of the campaign card's XP list, or the Hard/Expert card's: the condition above already held. The lines add up in the log.
        const log = next.resolutionLog;
        next = stepOver(next, { ...log, xp: (log.xp ?? 0) + xpOf(next, instruction) });
        break;
      }
      case "MarkFallen": {
        const host = Object.values(next.cards).find((card) => card.code === instruction.attached && card.zone === "attached" && card.host != null);
        const hero = host?.host ? next.cards[host.host] : undefined;
        // A hero Fallen Into Evil made an enemy is logged under its own code (rules/core/printed.ts).
        const heroCode = hero ? fallenBase(hero.code) : null;
        const log = hero && heroCode && printedOf(ctx.cards, heroCode).type === "hero" && !next.resolutionLog.fallen.includes(heroCode) ? { ...next.resolutionLog, fallen: [...next.resolutionLog.fallen, heroCode] } : next.resolutionLog;
        next = stepOver(next, log);
        break;
      }
      case "DiscoverTreasure":
        next = stepOver(next, discoverTreasures(next, ctx));
        break;
      case "AddEncounterToPool":
        next = stepOver(next, addEncounterCards(next, instruction));
        break;
      // Cards discarded from the encounter deck until X of a set's cards are, each added to the pool (12168:B:3).
      case "DiscardToPoolFromSets": {
        const count = resolveAmount(next, instruction.count, frameScope(next, next.firstPlayer, null), ctx);
        const discarded = discardToPoolFromSets(next, instruction.sets, count, ctx);
        next = stepOver(discarded.state, addEncounterCards(discarded.state, { verb: "AddEncounterToPool", codes: discarded.codes }));
        break;
      }
      case "ChooseRandomTreasure": {
        // The draw is made once, as the choice opens: the seed moves past it and the three stay on the state until the first player has chosen.
        const drawn = drawTreasures(next, instruction.count ?? 3, ctx);
        if (drawn.candidates.length === 0) {
          next = stepOver(next);
          break;
        }
        const offered = { ...next, resolutionOffer: drawn.candidates, seedCursor: drawn.cursor };
        const seat = seatsFor(offered, instruction)[0] ?? offered.firstPlayer;
        return { ...offered, stack: [], perilSeat: null, window: { kind: "resolution" as const, step: offered.resolutionAt, seat }, activeSeat: seat, passed: [] };
      }
      case "ChooseHazardForPool": {
        // The discard pile is shuffled in and the Hazard cards discarded once, as the choice opens: the group (the first player answering) chooses among them, and with one card to take there is nothing to choose.
        const discarded = discardHazards(next, instruction.count, ctx);
        const options = hazardOptions(discarded.state, discarded.hazards, ctx);
        if (options.length <= 1) {
          const only = options[0];
          next = stepOver(discarded.state, only ? applyHazard(discarded.state, only, next.resolutionAt) : undefined);
          break;
        }
        const offered = { ...discarded.state, resolutionOffer: options };
        const seat = seatsFor(offered, instruction)[0] ?? offered.firstPlayer;
        return { ...offered, stack: [], perilSeat: null, window: { kind: "resolution" as const, step: offered.resolutionAt, seat }, activeSeat: seat, passed: [] };
      }
      case "ChooseCards":
      case "ChooseOption":
      case "ReviveFallenHero":
      case "TrimHeroes":
      case "ChooseStagedLocationForPool":
      case "BoonAllyOrLogLine":
      case "RemoveFromPool":
      case "NameCaptives": {
        // RemoveFromPool without a choice takes the named encounter cards out of the pool at once; with one, each player in turn may remove a card.
        if (instruction.verb === "RemoveFromPool" && instruction.choice == null) {
          next = stepOver(next, removeEncounterCards(next, instruction.codes ?? []));
          break;
        }
        const seats = seatsFor(next, instruction);
        const seat = seats[next.resolutionSeat];
        if (seat == null) {
          next = stepOver(next);
          break;
        }
        const window = { kind: "resolution" as const, step: next.resolutionAt, seat };
        const offered = resolutionOptions({ ...next, window }, instruction, seat, ctx);
        if (offered.length === 0) {
          next = { ...next, resolutionSeat: next.resolutionSeat + 1 };
          break;
        }
        // A choice between named options with one left (no fallen hero to bring back) is answered by it: nothing is asked.
        const only = offered[0];
        if (instruction.verb === "ChooseOption" && offered.length === 1 && only != null) {
          next = applyResolution({ ...next, window }, only);
          break;
        }
        return { ...next, stack: [], perilSeat: null, window, activeSeat: seat, passed: [] };
      }
      default:
        next = stepOver(next);
    }
  }
  return next;
}

function remainingCodes(state: ScenarioState, instruction: Extract<Instruction, { verb: "ChooseCards" }>, step: number): string[] {
  const taken = new Set(state.resolutionLog.earned.filter((item) => item.step === step).map((item) => item.code));
  return instruction.codes.filter((code) => !taken.has(code));
}

function resolutionOptions(state: ScenarioState, instruction: Choosing, seat: number, ctx: ReduceContext): string[] {
  if (instruction.verb === "ChooseOption") return chooseOptionIds(state, instruction);
  if (instruction.verb === "ReviveFallenHero") return reviveOptions(state);
  if (instruction.verb === "TrimHeroes") return trimOptions(state, seat, instruction.limit);
  if (instruction.verb === "NameCaptives") {
    const named = new Set(state.resolutionLog.captives.map((item) => item.seat));
    if (named.has(seat)) return [];
    return heroesOf(state, seat).filter((id) => {
      const card = state.cards[id];
      const printed = card ? printedOf(ctx.cards, card.code) : null;
      return printed != null && !instruction.except.some((except) => printed.traits.includes(except) || printed.name === except);
    });
  }
  if (instruction.verb === "BoonAllyOrLogLine") return allyOrLineOptions(state, instruction);
  if (instruction.verb === "ChooseStagedLocationForPool") return stagedLocationOptions(state, ctx);
  if (instruction.verb === "ChooseRandomTreasure" || instruction.verb === "ChooseHazardForPool") return [...(state.resolutionOffer ?? [])];
  if (instruction.verb === "RemoveFromPool") {
    const removable = removalOptions(state, ctx);
    return removable.length === 0 ? [] : [...removable, SKIP];
  }
  const step = state.window?.kind === "resolution" ? state.window.step : state.resolutionAt;
  const codes = remainingCodes(state, instruction, step);
  if (codes.length === 0) return [];
  const options = instruction.to === "hero" ? codes.flatMap((code) => boonHeroes(state, ctx, code, heroesOf(state, seat, instruction.anyHero)).map((hero) => `${code}>${hero}`)) : instruction.to === "player" ? playerOptions(state, codes) : codes;
  return instruction.optional ? [...options, SKIP] : options;
}

function asking(state: ScenarioState): { instruction: Choosing; seat: number } | null {
  if (state.window?.kind !== "resolution") return null;
  const instruction = state.resolution[state.window.step];
  return asksPlayers(instruction) ? { instruction, seat: state.window.seat } : null;
}

// The seats that have already answered the open choice, in the order they answered (first player first).
export function answeredSeats(state: ScenarioState): number[] {
  const found = asking(state);
  return found ? seatsFor(state, found.instruction).slice(0, state.resolutionSeat) : [];
}

export function openResolution(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (!state.stageCleared || state.lost || state.window || state.resolutionAt >= state.resolution.length) return state;
  // Dropping the frame stack is safe: a frame only continues a reveal, hide, response, or effect of the round
  // that just ended, and the scenario is won, so nothing it could still do (a surge reveal, a forced trigger,
  // more damage) can change the outcome. Frames are not carried into the resolution window or past it.
  return advanceResolution(state, ctx);
}

export function resolutionIntents(state: ScenarioState, ctx: ReduceContext): LegalIntent[] {
  const found = asking(state);
  if (!found) return [];
  return resolutionOptions(state, found.instruction, found.seat, ctx).map((optionId) => ({ type: "ChooseResolution", optionId }));
}

export function resolutionReason(state: ScenarioState, intent: Extract<PlayerIntent, { type: "ChooseResolution" }>, ctx: ReduceContext): string | null {
  const found = asking(state);
  if (!found) return "That intent is not legal in this window";
  return resolutionOptions(state, found.instruction, found.seat, ctx).includes(intent.optionId) ? null : "That is not a choice here";
}

export function applyResolution(state: ScenarioState, optionId: string): ScenarioState {
  const found = asking(state);
  if (!found || state.window?.kind !== "resolution") return state;
  const { instruction, seat } = found;
  const step = state.window.step;
  let log = state.resolutionLog;
  if (instruction.verb === "NameCaptives") {
    const hero = state.cards[optionId];
    if (hero) log = { ...log, captives: [...log.captives, { seat, hero: hero.code }] };
  } else if (instruction.verb === "ChooseOption") {
    log = applyChooseOption(log, instruction, seat, optionId);
  } else if (instruction.verb === "ReviveFallenHero") {
    log = applyRevive(state, instruction, optionId, step);
  } else if (instruction.verb === "TrimHeroes") {
    log = applyTrim(state, seat, optionId);
    // A player still over the limit is asked again before the next player is.
    if (trimOptions({ ...state, resolutionLog: log }, seat, instruction.limit).length > 0) {
      const { resolutionOffer: _kept, ...held } = state;
      return { ...held, resolutionLog: log, window: null };
    }
  } else if (instruction.verb === "BoonAllyOrLogLine") {
    log = applyAllyOrLine(state, instruction, optionId, seat, step);
  } else if (instruction.verb === "RemoveFromPool") {
    log = noteRemovalAnswer(optionId !== SKIP ? applyRemoval(state, optionId) : log, seat, optionId);
  } else if (instruction.verb === "ChooseStagedLocationForPool") {
    // A copy of the location joins the pool's encounter cards (12184:B:4); the next player's options leave it out.
    log = applyStagedLocation(state, optionId, seat);
  } else if (instruction.verb === "ChooseHazardForPool") {
    log = applyHazard(state, optionId, step);
  } else if (instruction.verb === "ChooseRandomTreasure") {
    // The treasure is attached to a character and the players control it: the next line discovers it (the scenario is over, so which character is not asked).
    log = { ...log, treasures: [...new Set([...(log.treasures ?? []), optionId])] };
  } else if (optionId !== SKIP) {
    const [code = "", heroId] = optionId.split(">");
    const hero = heroId ? state.cards[heroId] : undefined;
    // A hero chosen from the whole table is earned for the seat that controls it.
    // A card for a player goes into the pool for the seat that controls the hero chosen, to be shuffled into that player's deck after the starting hand; the copies of one code are numbered.
    const copy = log.earned.filter((item) => item.code === code).length;
    const entry: Earned =
      instruction.to === "player"
        ? { code, to: "pool", seat: hero?.controller ?? seat, hero: null, step, afterHand: true, copy }
        : { code, to: instruction.to, seat: instruction.anyHero && hero?.controller != null ? hero.controller : seat, hero: hero?.code ?? null, step };
    log = { ...log, earned: [...log.earned, entry] };
  }
  const seats = seatsFor(state, instruction);
  const more = state.resolutionSeat + 1 < seats.length;
  const { resolutionOffer: _offered, ...rest } = state;
  return { ...rest, resolutionLog: log, resolutionSeat: more ? state.resolutionSeat + 1 : 0, resolutionAt: more ? state.resolutionAt : state.resolutionAt + 1, window: null };
}

// What the won scenario recorded, once every instruction has run. Null while players are still choosing, or after a loss.
export function resolutionResult(state: ScenarioState): ResolutionLog | null {
  if (!state.stageCleared || state.lost || state.window) return null;
  return state.resolutionAt >= state.resolution.length ? state.resolutionLog : null;
}
