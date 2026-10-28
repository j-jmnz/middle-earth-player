// Rules: ltp.campaign-cards, rr.campaign-cards (Resolution on the back of the campaign card), ltp.campaign-pool,
// rr.fellowship-of-heroes (data/rules/entries.json).
import type { Instruction } from "../catalog/boundary.ts";

import { holds } from "./conditions.ts";
import type { LegalIntent, PlayerIntent } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { printedOf } from "./printed.ts";
import type { Earned, ResolutionLog } from "./campaign-state.ts";
import { shuffleIds } from "./seed.ts";
import { inPlay, livingSeats, type ScenarioState } from "./state.ts";

// A won scenario runs the campaign card's Resolution instructions in order. An instruction that opens a choice asks
// one seat at a time, first player first; the rest settle on their own from the final state (Lust for the Ring
// attached, The Balrog in play, Fallen into Evil attached). The codes come from the records; this file names none.

export const SKIP = "skip";

type Choosing = Extract<Instruction, { verb: "ChooseCards" | "NameCaptives" }>;

function seatOrder(state: ScenarioState): number[] {
  const living = livingSeats(state);
  const at = Math.max(0, living.indexOf(state.firstPlayer));
  return [...living.slice(at), ...living.slice(0, at)];
}

function seatsFor(state: ScenarioState, instruction: Choosing): number[] {
  const order = seatOrder(state);
  if (instruction.verb === "NameCaptives") return order;
  return instruction.who === "firstPlayer" ? order.slice(0, 1) : order;
}

function heroesOf(state: ScenarioState, seat: number): string[] {
  return [...(state.seats[seat]?.heroes ?? [])];
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
export type HeldCopy = { code: string; seat: number | null; hero: string | null };

export function heldCopy(entry: { code: string; seat: number | null; hero?: string | null; attachedTo?: string | null }): HeldCopy {
  return { code: entry.code, seat: entry.seat, hero: entry.hero ?? entry.attachedTo ?? null };
}

export function holdsCopy(held: readonly HeldCopy[], item: Pick<Earned, "code" | "seat" | "perPlayer"> & { hero?: string | null }): boolean {
  if (item.perPlayer && item.hero != null) return held.some((have) => have.code === item.code && have.hero === item.hero);
  return held.some((have) => have.code === item.code && (!item.perPlayer || have.seat === item.seat));
}

function earn(state: ScenarioState, entries: readonly Earned[]): ResolutionLog {
  const have = state.resolutionLog.earned;
  return { ...state.resolutionLog, earned: [...have, ...entries.filter((item) => !holdsCopy(have.map(heldCopy), item))] };
}

// The entries one instruction hands out: one copy of each code, or one for each player at the table. An eliminated player is
// still in the campaign, so every seat counts.
function copiesOf(state: ScenarioState, codes: readonly string[], eachPlayer: boolean | undefined): Earned[] {
  const seats = eachPlayer ? Array.from({ length: state.seatCount }, (_, seat) => seat) : [null];
  return seats.flatMap((seat) => codes.map((code) => ({ code, to: "pool" as const, seat, hero: null, step: state.resolutionAt, ...(eachPlayer ? { perPlayer: true } : {}) })));
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
        next = stepOver(next, earn(next, copiesOf(next, instruction.codes, instruction.eachPlayer)));
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
      case "MarkFallen": {
        const host = Object.values(next.cards).find((card) => card.code === instruction.attached && card.zone === "attached" && card.host != null);
        const hero = host?.host ? next.cards[host.host] : undefined;
        const log = hero && printedOf(ctx.cards, hero.code).type === "hero" && !next.resolutionLog.fallen.includes(hero.code) ? { ...next.resolutionLog, fallen: [...next.resolutionLog.fallen, hero.code] } : next.resolutionLog;
        next = stepOver(next, log);
        break;
      }
      case "ChooseCards":
      case "NameCaptives": {
        const seats = seatsFor(next, instruction);
        const seat = seats[next.resolutionSeat];
        if (seat == null) {
          next = stepOver(next);
          break;
        }
        const window = { kind: "resolution" as const, step: next.resolutionAt, seat };
        if (resolutionOptions({ ...next, window }, instruction, seat, ctx).length === 0) {
          next = { ...next, resolutionSeat: next.resolutionSeat + 1 };
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
  if (instruction.verb === "NameCaptives") {
    const named = new Set(state.resolutionLog.captives.map((item) => item.seat));
    if (named.has(seat)) return [];
    return heroesOf(state, seat).filter((id) => {
      const card = state.cards[id];
      const printed = card ? printedOf(ctx.cards, card.code) : null;
      return printed != null && !instruction.except.some((except) => printed.traits.includes(except) || printed.name === except);
    });
  }
  const step = state.window?.kind === "resolution" ? state.window.step : state.resolutionAt;
  const codes = remainingCodes(state, instruction, step);
  if (codes.length === 0) return [];
  const options = instruction.to === "hero" ? codes.flatMap((code) => heroesOf(state, seat).map((hero) => `${code}>${hero}`)) : codes;
  return instruction.optional ? [...options, SKIP] : options;
}

function asking(state: ScenarioState): { instruction: Choosing; seat: number } | null {
  if (state.window?.kind !== "resolution") return null;
  const instruction = state.resolution[state.window.step];
  if (instruction?.verb !== "ChooseCards" && instruction?.verb !== "NameCaptives") return null;
  return { instruction, seat: state.window.seat };
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
  } else if (optionId !== SKIP) {
    const [code = "", heroId] = optionId.split(">");
    const hero = heroId ? state.cards[heroId] : undefined;
    log = { ...log, earned: [...log.earned, { code, to: instruction.to, seat, hero: hero?.code ?? null, step }] };
  }
  const seats = seatsFor(state, instruction);
  const more = state.resolutionSeat + 1 < seats.length;
  return { ...state, resolutionLog: log, resolutionSeat: more ? state.resolutionSeat + 1 : 0, resolutionAt: more ? state.resolutionAt : state.resolutionAt + 1, window: null };
}

// What the won scenario recorded, once every instruction has run. Null while players are still choosing, or after a loss.
export function resolutionResult(state: ScenarioState): ResolutionLog | null {
  if (!state.stageCleared || state.lost || state.window) return null;
  return state.resolutionAt >= state.resolution.length ? state.resolutionLog : null;
}
