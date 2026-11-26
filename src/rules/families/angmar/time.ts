// Rules: mec108.time-x (data/rules/entries.json); ledger lines 09024:A:1, 09024:A:3. Time X: a card with the keyword gets X resource tokens, its time counters, when it is revealed, and loses one at the end of each refresh phase; the card hears the removal of the last.
// The keyword is a constant record with the verb `Time` (src/catalog/families/angmar.ts), found by the card's code like Deep.
import type { Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { effectCause } from "../../core/cause.ts";
import { constantVerbCodes } from "../../interpret/constant-records.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { addModifier } from "../../core/modified-stat.ts";
import { heldAmount, inPlay, livingSeats, updateCard, type ScenarioState } from "../../core/state.ts";
import { queueEvent } from "../../windows/queue.ts";
import { effectsOf } from "../../windows/listen.ts";
import { holds } from "../../interpret/conditions.ts";
import { listens } from "../encounter/reveal.ts";
import { textBlank } from "../attachments/hold.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { printedOf } from "../../core/printed.ts";

type TimeInstruction = Extract<Instruction, { verb: "Time" }>;

/** The Time instruction of the card's constant record, or null for a card without the keyword. */
export function timeInstruction(ctx: ReduceContext, code: string): TimeInstruction | null {
  if (!constantVerbCodes(ctx, "Time").has(code)) return null;
  for (const effect of effectsOf(ctx, code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) if (instruction.verb === "Time") return instruction;
  }
  return null;
}

/** The X of the Time X keyword the card prints, or null for a card without it. */
export function timeOf(ctx: ReduceContext, code: string): number | null {
  return timeInstruction(ctx, code)?.amount ?? null;
}

/** The Time X the card would hold if it were revealed now: the printed number, times the living players when its record says `perPlayer` (08013:B:1). */
export function timeLimit(state: ScenarioState, ctx: ReduceContext, code: string): number | null {
  const time = timeInstruction(ctx, code);
  return time == null ? null : time.perPlayer ? time.amount * livingSeats(state).length : time.amount;
}

/**
 * The players a `perPlayer` Time X counted when its counters were put on the card (the flag `timePlayers`), or null for a card that counted none. The counters are put on once, so a player who leaves later does not change the count.
 */
export function timePlayersOf(state: ScenarioState, id: string): number | null {
  const players = heldAmount(state, id, "timePlayers");
  return players > 0 ? players : null;
}

/** A card with Time X was just revealed (the reveal frame's first step): the players put X resource tokens on it, its time counters (mec108.time-x). One that left play at once, or has its text blank, gets none. */
export function timeOnReveal(state: ScenarioState, id: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[id];
  if (!card || !inPlay(card.zone)) return state;
  const amount = timeLimit(state, ctx, card.code);
  if (amount == null || textBlank(state, id, ctx.cards)) return state;
  const counted = updateCard(state, id, { resources: card.resources + amount });
  // A per-player Time X remembers the count it was made with, for the dial that shows it (08013:B:1).
  return timeInstruction(ctx, card.code)?.perPlayer ? addModifier(counted, id, id, "timePlayers", livingSeats(state).length, "endOfGame") : counted;
}

/**
 * The time counters the next refresh phase takes off the current quest: the stage's own one, and the amount of each Forced record at the end of the refresh phase in play that removes counters from the current quest (RemoveTimeFromQuest: Old South Road 08016:forced:1,
 * Off Track 07057:forced:1) whose condition holds now (Off Track only while it is attached). The records are read, so a card with that record counts with no change here. Counters come off "if able", so the dial compares this with the counters left.
 */
export function refreshTakes(state: ScenarioState, ctx: ReduceContext): number {
  let takes = 1;
  for (const card of Object.values(state.cards)) {
    if (!inPlay(card.zone) || textBlank(state, card.id, ctx.cards)) continue;
    const scope = { actor: state.firstPlayer, sourceId: card.id, returned: 0, phase: "Refresh" };
    for (const effect of effectsOf(ctx, card.code)) {
      if (effect.timing !== "forced" || effect.trigger !== "endOfPhase" || (effect.condition != null && !holds(state, effect.condition, scope, ctx))) continue;
      for (const instruction of effect.instructions) if (instruction.verb === "RemoveTimeFromQuest" && typeof instruction.amount === "number") takes += instruction.amount;
    }
  }
  return takes;
}

/** The pick filter `timeCounter`: a card with the Time keyword that holds a time counter (a card with no Time loses none, mec108.time-x). True for a pick that does not ask. */
export function timeCounterMatches(state: ScenarioState, id: string, spec: PickSpec, ctx: ReduceContext): boolean {
  if (spec.timeCounter !== true) return true;
  const card = state.cards[id];
  return card != null && card.resources > 0 && timeOf(ctx, card.code) != null && !textBlank(state, id, ctx.cards);
}

/** The cards in play that hold the Time X keyword and at least one time counter. */
function timeCards(state: ScenarioState, ctx: ReduceContext): string[] {
  if (constantVerbCodes(ctx, "Time").size === 0) return [];
  return Object.values(state.cards).filter((card) => inPlay(card.zone) && card.resources > 0 && timeOf(ctx, card.code) != null && !textBlank(state, card.id, ctx.cards)).map((card) => card.id);
}

/**
 * The refresh phase's RemoveTimeCounters: one time counter comes off each card in play with Time X, if able; a card whose last counter is removed is announced (`lastTimeCounterRemoved`) and its Forced effect resolves ("When the last time counter is removed, there is a triggered effect that
 * resolves on that card", mec108.time-x). A card with no counter left loses none.
 */
export function removeTimeCounters(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  return timeCards(state, ctx).reduce((next, id) => removeTimeCounterFrom(next, id, ctx), state);
}

/** The enemies in play that hold the Time X keyword and a time counter. */
function timeEnemies(state: ScenarioState, ctx: ReduceContext): string[] {
  return timeCards(state, ctx).filter((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === "enemy");
}

/** The last picked card when it has the Time X keyword, as a list of one; none otherwise (a card with no Time loses no counter). */
function pickedTimeCard(state: ScenarioState, ctx: ReduceContext): string[] {
  const picked = lastPicked(state);
  return picked && timeOf(ctx, state.cards[picked]?.code ?? "") != null ? [picked] : [];
}

/**
 * A record's RemoveTimeCounters with a target: "Remove X time counters from each enemy ... with the time keyword" (08055:A:1, X the number of players with `perPlayer`) from each enemy in play, or "remove a time counter from an enemy" (08051:A:2) from the last picked card.
 * Each card loses up to `amount` counters, one at a time, so its last counter is heard once.
 */
export function removeTimeCountersFrom(state: ScenarioState, ctx: ReduceContext, instruction: Extract<Instruction, { verb: "RemoveTimeCounters" }>): ScenarioState {
  const players = instruction.perPlayer ? livingSeats(state).length : 1;
  const amount = (instruction.amount ?? 1) * players;
  const targets = instruction.target === "picked" ? pickedTimeCard(state, ctx) : timeEnemies(state, ctx);
  let next = state;
  for (const id of targets) for (let removed = 0; removed < amount; removed += 1) next = removeTimeCounterFrom(next, id, ctx);
  return next;
}

/**
 * One time counter comes off this card, if it holds any; the card hears it when that was its last (`lastTimeCounterRemoved`). The refresh phase and the cards that remove a counter (Down from the Hills, Gap of Rohan) share it. A counter that comes off the current quest is also announced
 * (`timeCounterRemoved`, "After a time counter is removed from the current quest", 07058:A:1; an event about no card, so every record that hears it does), only in a game that deals a card whose record hears it, so no other game queues it.
 */
export function removeTimeCounterFrom(state: ScenarioState, id: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[id];
  if (!card || card.resources <= 0) return state;
  let next = updateCard(state, id, { resources: card.resources - 1 });
  if (id === state.questStage && listens(state, ctx, "timeCounterRemoved")) next = queueEvent(next, { trigger: "timeCounterRemoved", seat: null });
  return card.resources === 1 ? queueEvent(next, { trigger: "lastTimeCounterRemoved", seat: null, cardId: id, subject: id }) : next;
}

/**
 * The refresh phase ends (windows/triggers.ts crossBoundary): when a card in play holds a time counter, a frame of its own removes one from each. It goes down before the Forced effects of the end of the refresh phase, so they resolve first and the counters come off after them
 * (docs/scenarios/angmar-awakened.md, Angmar Awakened).
 */
export function timeAtRefreshEnd(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const first = timeCards(state, ctx)[0];
  const card = first ? state.cards[first] : undefined;
  if (!first || !card) return state;
  const record: Effect | undefined = effectsOf(ctx, card.code).find((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === "Time"));
  if (!record) return state;
  return pushEffectFrame(state, { frame: "forced", sourceId: first, actor: state.firstPlayer, peril: false, effectId: "time:refresh", instructions: [{ verb: "RemoveTimeCounters" }], cancel: null, blockCancel: null, cause: effectCause(record) }, steps);
}
