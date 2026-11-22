// Rules: docs/scenarios/standalone-scenarios.md (The Battle of Lake-town: Burn X, from the Quest Companion), rr.damage, rr.exhausted (data/rules/entries.json); ledger lines 50205:A:2, 50210:A:1, 50221:A:2, 50215:A:1, 50214:A:2.
// "Resolve all burn damage from all locations in play": the Burn X of every location in the staging area or an active slot, added up when it resolves, plus the 1 each location gains from West Pier (`locationsGainBurn`, itself included). Each player in turn,
// from the first player, may exhaust any number of ready characters he controls and assign any amount of the pool to each, up to its remaining hit points; what is left goes on Lake-town. The damage on a character is an encounter card effect's.
// The question is a Choose (windows/choices.ts) whose options run this verb again with the pool, the seats still to answer and the character just exhausted, so a saved game replays it.
import type { Instruction } from "../../../catalog/boundary.ts";
import { characters } from "../../combat/combat.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { modifiedStat, placeDamage } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { heldAmount } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { exhaustCard } from "../../interpret/player-verbs.ts";
import { changeDamageOn } from "../moria/index.ts";
import { openBranch } from "../../windows/choices.ts";
import type { Focus } from "../index.ts";
import { lakeTownId, turnOrder } from "./cards.ts";

type Burn = Extract<Instruction, { verb: "ResolveBurn" }>;

// The locations in play: the staging area and the active slots.
function locationsInPlay(state: ScenarioState, ctx: ReduceContext): string[] {
  return Object.values(state.cards)
    .filter((card) => (card.zone === "staging" || card.zone === "activeLocation" || card.zone === "secondActiveLocation") && printedOf(ctx.cards, card.code).type === "location")
    .map((card) => card.id);
}

/** The burn damage of every location in play, counted now: each location's printed Burn X and the Burn 1 each gains from every West Pier in play. */
export function burnTotal(state: ScenarioState, ctx: ReduceContext): number {
  const locations = locationsInPlay(state, ctx);
  const grants = locations.reduce((sum, id) => sum + heldAmount(state, id, "locationsGainBurn"), 0);
  return locations.reduce((sum, id) => sum + (printedOf(ctx.cards, state.cards[id]?.code ?? "").keywords.burn ?? 0) + grants, 0);
}

/** The hit points a character can still take before it is destroyed. */
export function room(state: ScenarioState, id: string, ctx: ReduceContext): number {
  const card = state.cards[id];
  return card == null ? 0 : Math.max(0, modifiedStat(state, card, "hitPoints", ctx.cards) - card.damage);
}

/** The ready characters of the seat with hit points left, in the order the game keeps them (the ones a Burn share can go to). */
export function readyCharacters(state: ScenarioState, seat: number, ctx: ReduceContext): string[] {
  return characters(state, seat, ctx.cards).filter((id) => state.cards[id]?.exhausted === false && room(state, id, ctx) > 0);
}

// What is left of the pool goes on Lake-town as damage tokens, none dealt, so the cap on Smaug and the immunities do not apply to it.
function restOnLakeTown(state: ScenarioState, pool: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = lakeTownId(state);
  return id == null || pool <= 0 ? state : changeDamageOn(state, id, pool, steps, ctx);
}

/**
 * ResolveBurn. The first call counts the pool and orders the players. A character `pending` (just exhausted) is asked its share; an `assign` (the share chosen) is dealt; then the seat asked next is the first of `seats`: its ready characters are the
 * options, and "done" passes to the next seat. With the pool spent or no seat left, the rest goes on Lake-town.
 */
export function resolveBurn(state: ScenarioState, instruction: Burn, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const cause = currentCause(steps, UNATTRIBUTED);
  let pool = instruction.pool ?? burnTotal(state, ctx);
  const seats = instruction.seats ?? turnOrder(state);
  let next = state;
  if (instruction.assign) {
    const { id, amount } = instruction.assign;
    pool -= amount;
    next = placeDamage(next, id, amount, ctx.cards, steps, "framework", cause);
  }
  const seat = seats[0];
  if (pool <= 0 || seat == null) return restOnLakeTown(next, pool, ctx, steps);
  // The character just exhausted: its share, one option for each amount it can take (a share of 0 is not a share).
  if (instruction.pending != null) {
    const id = instruction.pending;
    const options = Array.from({ length: Math.min(pool, room(next, id, ctx)) }, (_, at) => ({ id: `burn:${at + 1}`, instructions: [{ verb: "ResolveBurn" as const, pool, seats, assign: { id, amount: at + 1 } }] }));
    return openBranch(exhaustCard(next, id), { instruction: { verb: "Choose", who: "actor", options }, seat, chosen: null, cause }, 0, ctx);
  }
  const ready = readyCharacters(next, seat, ctx);
  if (ready.length === 0) return resolveBurn(next, { verb: "ResolveBurn", pool, seats: seats.slice(1) }, focus, ctx, steps);
  const options = [
    ...ready.map((id) => ({ id: `exhaust:${id}`, instructions: [{ verb: "ResolveBurn" as const, pool, seats, pending: id }] })),
    { id: "done", instructions: [{ verb: "ResolveBurn" as const, pool, seats: seats.slice(1) }] },
  ];
  return openBranch(next, { instruction: { verb: "Choose", who: "actor", options }, seat, chosen: null, cause }, 0, ctx);
}
