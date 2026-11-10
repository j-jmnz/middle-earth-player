// Rules: rr.step-3-3, rr.staging, rr.reveal, rr.lasting-effects, rr.modifiers, rr.cancel, rr.running-out-of-cards,
// mec109.peril (data/rules/entries.json).
//
// What the encounter family adds to the staging of encounter cards (src/rules/windows/frames.ts calls these): the number of cards the
// staging step reveals, the lasting effects that watch the cards revealed (WatchReveals), the first location revealed each
// round, an encounter card entering play, and a threat raise by an encounter card effect.
import type { Effect, Instruction, Trigger } from "../../../catalog/boundary.ts";

import { effectCause, ruleCause, type Cause } from "../../core/cause.ts";
import { holds } from "../../interpret/conditions.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { placeDamage } from "../../core/keywords.ts";
import { effectsOf } from "../../windows/listen.ts";
import { exhaustCard, readyCard } from "../../interpret/player-verbs.ts";
import { printedOf } from "../../core/printed.ts";
import { queueEvent } from "../../windows/queue.ts";
import type { Frame, Modifier, ScenarioState } from "../../core/state.ts";
import { inPlay, modifierActive, updateCard } from "../../core/state.ts";
import { resetEncounterDeck } from "../../interpret/verbs.ts";
import { stageSeat } from "../breaking/areas.ts";
import { popFrame } from "../../windows/windows.ts";
import { moveCard } from "../../core/zones.ts";

const ENCOUNTER_TYPES: ReadonlySet<string> = new Set(["enemy", "location", "treachery", "objective"]);

// The codes whose records name a trigger, built once per effect list.
const LISTENERS = new WeakMap<readonly Effect[], Map<string, ReadonlySet<string>>>();

// Some card in the game (in any zone) has a record that hears this trigger. Events nobody could hear are not raised, so a
// game without those cards plays exactly as before.
export function listens(state: ScenarioState, ctx: ReduceContext, trigger: Trigger): boolean {
  let byTrigger = LISTENERS.get(ctx.effects);
  if (!byTrigger) {
    byTrigger = new Map();
    LISTENERS.set(ctx.effects, byTrigger);
  }
  let codes = byTrigger.get(trigger);
  if (!codes) {
    codes = new Set(ctx.effects.filter((effect) => effect.trigger === trigger).map((effect) => effect.cardCode));
    byTrigger.set(trigger, codes);
  }
  const found = codes;
  return found.size > 0 && Object.values(state.cards).some((card) => found.has(card.code));
}

// The staging step reveals one card per player (rr.step-3-3), fewer while the table holds revealFewer flags: "Reveal 1
// less card from the encounter deck this phase (To a minimum of 1.)" and "(to a minimum of 0)", and more while it holds
// revealMore flags: "reveal an additional encounter card this phase" (141080:A:2).
export function revealsAllowed(state: ScenarioState, base: number): number {
  let toZero = 0;
  let toOne = 0;
  let more = 0;
  for (const modifier of state.modifiers) {
    if (!modifierActive(state, modifier)) continue;
    // A reduction for one player (RevealFewer `who: picked`) is taken from that player's own reveal (revealSkipped).
    if ((modifier.stat === "revealFewer" || modifier.stat === "revealFewerMinOne") && modifier.seat != null) continue;
    if (modifier.stat === "revealFewer") toZero += modifier.amount;
    else if (modifier.stat === "revealFewerMinOne") toOne += modifier.amount;
    else if (modifier.stat === "revealMore") more += modifier.amount;
  }
  if (toZero === 0 && toOne === 0) return base + more;
  const floored = toOne > 0 ? Math.max(Math.min(1, base), base - toOne) : base;
  return Math.max(0, floored - toZero) + more;
}

// The reduction one player holds on their own reveals (RevealFewer `who: picked`): the modifier that skips the reveal this seat is about to make, or null.
export function revealSkipped(state: ScenarioState, seat: number): Modifier | null {
  return state.modifiers.find((modifier) => modifier.stat === "revealFewer" && modifier.seat === seat && modifier.amount > 0 && modifierActive(state, modifier)) ?? null;
}

// The seat that makes the index-th reveal of the staging step: the seats in turn. While stages are separate the cards beyond one per seat
// ("reveal one more card for each player", 142067:B:1) go to the seat whose stage says so, since "the quest" is each seat's own
// (mec109.multiple-staging-areas).
export function revealSeat(state: ScenarioState, index: number, seats: readonly number[]): number | undefined {
  if (state.separate && index >= seats.length) {
    const owner = state.modifiers.filter((modifier) => modifier.stat === "revealMore" && modifierActive(state, modifier)).map((modifier) => stageSeat(state, modifier.sourceId));
    const mine = owner.find((seat): seat is number => seat != null && seats.includes(seat));
    if (mine != null) return mine;
  }
  return seats[index % Math.max(1, seats.length)];
}

// The record that set a watcher, for the cause of what it does.
function watcherCause(state: ScenarioState, modifier: Modifier, ctx: ReduceContext): Cause {
  const code = state.cards[modifier.sourceId]?.code ?? "";
  const sets = (list: readonly Instruction[]): boolean =>
    list.some((instruction) => instruction.verb === "WatchReveals" || (instruction.verb === "Choose" && instruction.options.some((option) => sets(option.instructions))));
  const effect = effectsOf(ctx, code).find((entry) => sets(entry.instructions));
  return effect ? effectCause(effect) : ruleCause("rr.lasting-effects");
}

function watchers(state: ScenarioState, stats: readonly string[]): Modifier[] {
  return state.modifiers.filter((modifier) => stats.includes(modifier.stat) && modifierActive(state, modifier));
}

function watching(state: ScenarioState, modifier: Modifier, id: string, seat: number, ctx: ReduceContext): boolean {
  return !modifier.when || holds(state, modifier.when, { actor: modifier.seat ?? seat, sourceId: modifier.sourceId, returned: 0, subject: id }, ctx);
}

function without(state: ScenarioState, modifier: Modifier): ScenarioState {
  return { ...state, modifiers: state.modifiers.filter((entry) => entry !== modifier) };
}

// "Lower the Threat of the next enemy added to the staging area to 0 until the end of the phase": the card just added to
// the staging area takes the watcher, which ends.
export function addedToStaging(state: ScenarioState, id: string, ctx: ReduceContext): ScenarioState {
  let next = state;
  for (const modifier of watchers(state, ["watchThreatZero"])) {
    if (!watching(next, modifier, id, modifier.seat ?? next.firstPlayer, ctx)) continue;
    next = without(next, modifier);
    next = { ...next, modifiers: [...next.modifiers, { instanceId: id, sourceId: modifier.sourceId, stat: "threat", amount: 0, until: "endOfPhase", set: true }] };
  }
  return next;
}

// The first location revealed by the encounter deck this round is announced (Warden of Arnor, 08031:A:2). A marker on the
// table remembers that one was revealed until the round ends; it is kept only in a game where some card hears it.
function firstLocation(state: ScenarioState, id: string, seat: number, fromDeck: boolean, ctx: ReduceContext): ScenarioState {
  if (!fromDeck || printedOf(ctx.cards, state.cards[id]?.code ?? "").type !== "location" || !listens(state, ctx, "firstLocationRevealed")) return state;
  if (state.modifiers.some((modifier) => modifier.stat === "locationRevealed" && modifierActive(state, modifier))) return state;
  const marked: ScenarioState = { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: id, stat: "locationRevealed", amount: 1, until: "endOfRound" }] };
  return queueEvent(marked, { trigger: "firstLocationRevealed", seat, subject: id });
}

// A card was just revealed and turned face up in the staging area: the lasting effects that watch the reveals act on it. A
// watcher set while this card's own staging resolves (Minas Tirith Lampwright, after a card with surge is revealed) waits for
// the next card. A card discarded "without resolving its effects" ends its staging here: its frame pops, and it resolves
// nothing, not even its keywords (rr.cancel).
export function watchReveal(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = frame.cardId;
  if (!id || frame.data.kind !== "reveal" || !state.cards[id]) return state;
  const seat = frame.seat;
  // A revealed card is in the staging area: it is added to it (watchThreatZero).
  let next = addedToStaging(firstLocation(state, id, seat, frame.data.fromDeck === true, ctx), id, ctx);
  const found = watchers(next, ["watchDiscard", "watchDamage", "watchReadyHost"]);
  let discard = false;
  for (const modifier of found) {
    const matches = watching(next, modifier, id, seat, ctx);
    if (modifier.stat === "watchDiscard") {
      next = without(next, modifier);
      discard = discard || matches;
      continue;
    }
    if (!matches) continue;
    if (modifier.stat === "watchDamage") {
      next = placeDamage(without(next, modifier), id, modifier.amount, ctx.cards, steps, "player", watcherCause(next, modifier, ctx));
      continue;
    }
    const source = next.cards[modifier.sourceId];
    const host = source?.host ? next.cards[source.host] : undefined;
    if (!source || !inPlay(source.zone) || source.exhausted || !host?.exhausted) continue;
    next = readyCard(exhaustCard(without(next, modifier), source.id), host.id);
  }
  if (!discard) return next;
  const discarded = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
  return resetEncounterDeck(popFrame(frame.peril ? { ...discarded, perilSeat: null } : discarded, steps), steps);
}

// An encounter card entered play (placed in the staging area at the end of its staging, or put into play by an effect).
export function announceEntered(state: ScenarioState, id: string, seat: number | null, ctx: ReduceContext): ScenarioState {
  const card = state.cards[id];
  if (!card || !inPlay(card.zone) || !listens(state, ctx, "encounterEnteredPlay")) return state;
  return queueEvent(state, { trigger: "encounterEnteredPlay", seat, subject: id });
}

// An encounter card effect (its source is an enemy, location, treachery or objective) raised the seat's threat by `amount`.
export function noteEncounterThreat(state: ScenarioState, seat: number, amount: number, sourceId: string | null, ctx: ReduceContext): ScenarioState {
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (amount <= 0 || !source || !ENCOUNTER_TYPES.has(printedOf(ctx.cards, source.code).type)) return state;
  if (!listens(state, ctx, "encounterThreatRaised")) return state;
  return queueEvent(state, { trigger: "encounterThreatRaised", seat, amount });
}

// The amount of the encounterThreatRaised event the running Response answers.
export function answeredRaise(state: ScenarioState): number {
  for (let index = state.stack.length - 1; index >= 0; index -= 1) {
    const data = state.stack[index]?.data;
    if (data?.kind === "responses" && data.event.trigger === "encounterThreatRaised") return data.event.amount ?? 0;
  }
  return 0;
}
