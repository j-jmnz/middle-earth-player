// Rules: rm.current-trial, rr.engaged, rr.attachment-cards, rr.constant-ability, rr.ownership-and-control (data/rules/entries.json); ledger lines 08036:B:1, 08039:B:1, 08036:B:2, 08047:A:1.
// The settle sweeps of The Three Trials: the Guardians that engage the first player or the holder of their Key, the current trial's Key held by a hero, and the allies the Cave Barrow caps. Each runs once nothing is resolving, and only in a game with a record that reads it.
import type { Effect } from "../../../catalog/boundary.ts";

import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, heldLeast, inPlay, livingSeats, type CardInstance, type ScenarioState } from "../../core/state.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { engageWith } from "../../quest/quest.ts";
import { queueEvent } from "../../windows/queue.ts";
import { effectsOfCard } from "../misc/text.ts";

const idle = (state: ScenarioState): boolean => state.stack.length === 0 && !state.lost && !state.failure && !state.pendingAttack && !state.pendingStrike;

/** The EngageSeat marker of the stage in play: who its Guardians engage and the Trait of the enemies it names, or null for a stage without one. */
function engageRule(state: ScenarioState, ctx: ReduceContext): { who: "firstPlayer" | "keyHolder"; trait: string } | null {
  const stage = state.questStage ? state.cards[state.questStage] : undefined;
  if (!stage) return null;
  const records: readonly Effect[] = effectsOfCard(state, ctx, stage);
  for (const effect of records) for (const instruction of effect.instructions) if (instruction.verb === "EngageSeat") return { who: instruction.who, trait: instruction.trait };
  return null;
}

/** The seat that controls a hero with a Key attached that shares a Trait with the enemy (the first player's seat first), or null: stage 3B's "the player who controls the Key objective with a Trait shared by that enemy" (08039:B:1). */
export function keyHolderSeat(state: ScenarioState, ctx: ReduceContext, enemyId: string): number | null {
  const enemy = printedOf(ctx.cards, state.cards[enemyId]?.code ?? "").traits;
  const held = Object.values(state.cards).filter((card) => keyHeldBy(state, ctx, card) != null && printedOf(ctx.cards, card.code).traits.some((trait) => enemy.includes(trait)));
  const seats = held.map((key) => keyHeldBy(state, ctx, key));
  return livingSeats(state).find((seat) => seats.includes(seat)) ?? null;
}

/** The seat that controls the hero a Key objective lies on, or null for a Key attached to anything else (a Guardian, a Barrow) or lying elsewhere. */
function keyHeldBy(state: ScenarioState, ctx: ReduceContext, key: CardInstance): number | null {
  if (key.zone !== "attached" || key.host == null || !hasTrait(state, key.id, "Key", ctx)) return null;
  const host = state.cards[key.host];
  return host?.zone === "heroes" ? (host.controller ?? null) : null;
}

/**
 * EngageSeat (08036:B:1 to 08038:B:1, 08039:B:1): the stage in play holds the marker; each enemy with its Trait in the staging area, or engaged with another player, engages the seat it names at once, whatever its engagement cost: the first player, so it follows the token (refresh phase),
 * or the player who controls the Key it shares a Trait with. A Guardian whose Key no player controls stays where it is.
 */
export function engageSeats(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!idle(state) || !gameReads(state, ctx, '"EngageSeat"')) return state;
  const rule = engageRule(state, ctx);
  if (!rule) return state;
  return [...state.staging, ...state.seats.flatMap((seat) => seat.engaged)].reduce((next, id) => {
    const card = next.cards[id];
    if ((card?.zone !== "staging" && card?.zone !== "engaged") || !hasTrait(next, id, rule.trait, ctx)) return next;
    const seat = rule.who === "firstPlayer" ? next.firstPlayer : keyHolderSeat(next, ctx, id);
    return seat == null || (card.zone === "engaged" && card.controller === seat) ? next : engageWith(next, seat, id, steps);
  }, state);
}

/** Whether the players control the Key the stage marked as the current trial's (`trialKey`, set by PickSetAside): it lies on a hero. */
export function trialKeyControlled(state: ScenarioState, ctx: ReduceContext): boolean {
  const stage = state.questStage;
  const mark = state.modifiers.find((modifier) => modifier.stat === "trialKey" && modifier.sourceId === stage);
  const key = mark ? state.cards[mark.instanceId] : undefined;
  return key != null && keyHeldBy(state, ctx, key) != null;
}

/** The settle hook of "When the players control the current trial's Key objective" (08036:B:2 to 08038:B:2): `trialKeyControlled` is announced once the Key lies on a hero and nothing is resolving; the stage's record answers it. */
export function announceTrialKey(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (!idle(state) || !state.questStage || !state.modifiers.some((modifier) => modifier.stat === "trialKey") || !trialKeyControlled(state, ctx)) return state;
  if ((state.pendingEvents ?? []).some((event) => event.trigger === "trialKeyControlled")) return state;
  return queueEvent(state, { trigger: "trialKeyControlled", seat: state.firstPlayer });
}

/** The settle hook of the Cave Barrow (08047:A:1): the allies in play, all seats together, are more than the table's `alliesLimit`; `alliesOverLimit` is announced for the first player once nothing is resolving, and the Barrow's record has him choose the allies that stay. */
export function announceAlliesOverLimit(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (state.modifiers.length === 0 || !idle(state) || !flagged(state, "table", "alliesLimit")) return state;
  const limit = heldLeast(state, "table", "alliesLimit");
  const allies = Object.values(state.cards).filter((card) => inPlay(card.zone) && printedOf(ctx.cards, card.code).type === "ally").length;
  if (allies <= limit || (state.pendingEvents ?? []).some((event) => event.trigger === "alliesOverLimit")) return state;
  return queueEvent(state, { trigger: "alliesOverLimit", seat: state.firstPlayer });
}
