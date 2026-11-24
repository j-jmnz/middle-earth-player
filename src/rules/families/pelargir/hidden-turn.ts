// Rules: ats.hidden-cards-turn-faceup, faq.blood-of-gondor-hidden-cards, rr.engaged, rr.damage, rr.surge (data/rules/entries.json); ledger lines 06117:B:2, 06118:A:1, 06121:A:1, 06129:A:1, 06132:A:2.
// Turning hidden cards faceup, one card at a time. The cards held when the turn starts are the ones turned: a card taken during it (Evil Crow) stays facedown. An enemy engages the player whatever its engagement cost, a treachery goes to the encounter discard pile, a location goes there too
// or, for Lying in Wait, to the staging area when it is turned. The card is not revealed (hidden.turn-enemy-not-revealed): no When Revealed effect and no surge, but Lying in Wait names the When Revealed effects of the cards it turns, enemies included (each after it has engaged), which resolve once the turn is done, the first card first.
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { placeDamage } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import { livingSeats, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { engageWith } from "../../quest/quest.ts";
import { effectsOf } from "../../windows/listen.ts";
import { queueEvent } from "../../windows/queue.ts";
import { patchTop } from "../../windows/windows.ts";
import { dealShadowTo } from "../defense/shadow.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { hiddenIds, randomHidden, unhide } from "./hidden.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

type Turn = { readonly resolve?: boolean; readonly shadow?: boolean; readonly damage?: number; readonly sourceId?: string | null };
// `discard`: a treachery waits in the staging area while its When Revealed effect resolves and goes to the encounter discard pile after it (rr.step-3-3).
type Pending = { readonly id: string; readonly seat: number; readonly discard?: boolean };

// One card turned faceup for a seat. The card leaves the hidden list first. The returned list holds the cards whose When Revealed effects are still to resolve.
function turnOne(state: ScenarioState, id: string, seat: number, turn: Turn, ctx: ReduceContext, steps: EngineStep[], pending: Pending[]): ScenarioState {
  const card = state.cards[id];
  if (!card) return state;
  const type = printedOf(ctx.cards, card.code).type;
  const open = unhide(state, id);
  if (type === "enemy") {
    // A damaged enemy lies in the staging area while it takes the damage; one destroyed never engages (the damage destroys it there).
    let next = open;
    if (turn.damage != null) {
      next = placeDamage(moveCard(open, id, { zone: "staging" }), id, turn.damage, ctx.cards, steps, "framework", currentCause(steps, UNATTRIBUTED), turn.sourceId ?? null);
      if (next.cards[id]?.zone !== "staging") return next;
    }
    next = engageWith(next, seat, id, steps);
    // Lying in Wait resolves the When Revealed effects of an enemy it turns too, after the turn is done (the enemy has engaged by then, hidden.turn-enemy-not-revealed).
    if (turn.resolve === true) pending.push({ id, seat });
    return turn.shadow === true ? dealShadowTo(next, id, steps, ctx) : next;
  }
  if (turn.resolve === true && type === "location") {
    pending.push({ id, seat });
    return queueEvent(moveCard(open, id, { zone: "staging" }), { trigger: "addedToStaging", seat, cardId: id });
  }
  if (turn.resolve === true) {
    pending.push({ id, seat, discard: true });
    return moveCard(open, id, { zone: "staging" });
  }
  return moveCard(open, id, { zone: "encounterDiscard" });
}

// The When Revealed effects of the turned cards, each in a frame of its own: the frames are pushed last card first, so the first card turned resolves first.
function resolvePending(state: ScenarioState, pending: readonly Pending[], ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const { id, seat, discard } of [...pending].reverse()) {
    const code = next.cards[id]?.code ?? "";
    const effects = effectsOf(ctx, code).filter((effect) => effect.timing === "whenRevealed");
    const first = effects[0];
    if (!first) {
      if (discard === true && next.cards[id]?.zone === "staging") next = moveCard(next, id, { zone: "encounterDiscard" });
      continue;
    }
    // The last instruction of the frame puts the treachery in the discard pile, once its effects are done.
    const leaves: Effect = { id: `${first.id}:discard`, cardCode: code, lines: first.lines, timing: "whenRevealed", instructions: [{ verb: "Discard", target: { kind: "self" } }] };
    next = pushCardEffects(next, "whenRevealed", id, seat, false, discard === true ? [...effects, leaves] : effects, ctx, steps);
  }
  return next;
}

/** Every card of the list, in order, turned faceup for the seat (the 5-card limit of Captured! turns without resolving anything). */
export function turnAll(state: ScenarioState, seat: number, ids: readonly string[], ctx: ReduceContext, steps: EngineStep[], turn: Turn = {}): ScenarioState {
  const pending: Pending[] = [];
  let next = state;
  for (const id of ids) next = turnOne(next, id, seat, turn, ctx, steps, pending);
  return resolvePending(next, pending, ctx, steps);
}

/** TurnHiddenCards: the seats the instruction names turn each hidden card they hold when it starts. `eachPlayer` goes in player order, the first player first, and every seat's list is taken before any card is turned. */
export function turnHiddenCards(state: ScenarioState, instruction: Verb<"TurnHiddenCards">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const seats = instruction.who === "eachPlayer" ? livingSeats(state) : [instruction.who === "firstPlayer" ? state.firstPlayer : focus.seat];
  const lists = seats.map((seat) => ({ seat, ids: hiddenIds(state, seat) }));
  const pending: Pending[] = [];
  let next = state;
  for (const { seat, ids } of lists) {
    if (state.seats[seat]?.eliminated) continue;
    for (const id of ids) next = turnOne(next, id, seat, { resolve: instruction.resolve === true, shadow: instruction.shadow === true }, ctx, steps, pending);
  }
  return resolvePending(next, pending, ctx, steps);
}

/**
 * TurnHiddenCard: one hidden card of a player the acting player chooses is turned faceup for that player (Faramir). The players who hold one are the options (a single one is no choice); the card is picked blind with the game's seed. `damageEnemy` damages an
 * enemy before it engages. The choice is queued as a Choose whose options repeat this instruction with the seat (`seat` is the engine's own field).
 */
export function turnHiddenCard(state: ScenarioState, instruction: Verb<"TurnHiddenCard">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (instruction.seat == null) {
    const holders = livingSeats(state).filter((seat) => hiddenIds(state, seat).length > 0);
    const only = holders[0];
    if (only == null) return state;
    if (holders.length === 1) return turnHiddenCard(state, { ...instruction, seat: only }, focus, ctx, steps);
    const data = effectData(state);
    if (!data) return state;
    const choose = { verb: "Choose", who: "actor", options: holders.map((seat) => ({ id: `seat:${seat}`, instructions: [{ ...instruction, seat }] })) } as Instruction;
    return patchTop(state, { data: { ...data, queue: [{ instruction: choose, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, ...data.queue] } });
  }
  const found = randomHidden(state, instruction.seat);
  if (!found) return state;
  const pending: Pending[] = [];
  return turnOne(found.state, found.id, instruction.seat, { ...(instruction.damageEnemy != null ? { damage: instruction.damageEnemy } : {}), sourceId: focus.sourceId }, ctx, steps, pending);
}
