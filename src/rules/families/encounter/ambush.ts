// Rules: dwd.ambush, rr.engagement-check, rr.engaged, rr.staging, rr.reveal, rr.running-out-of-cards (data/rules/entries.json); ledger lines 04049:A:1, 04043:A:1, 04045:A:1, 901405:A:2, 901402:A:1.
//
// Ambush: when an enemy with the keyword enters play, each player in turn, the first player first, makes an engagement check against that enemy alone, and the first to engage it ends the checks. The enemy is added to the staging area first
// (reveal, search, return from the discard pile): the engine puts the checks on the stack under the Forced effects and Responses that hear it enter, so a card that answers "enters the staging area" acts before them. An enemy put into play
// engaged, or one already in play that moves to the staging area, makes no check. The check is the encounter phase's own (quest/quest.ts checkEngages): the cost against the Threat the seat counts for checks.
import type { Instruction } from "../../../catalog/boundary.ts";

import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { hasKeyword } from "../../core/keywords.ts";
import { checkEngages } from "../../quest/check.ts";
import { engageEnemy, stagingEnemies } from "../../quest/quest.ts";
import type { GameEvent, ScenarioState } from "../../core/state.ts";
import { flagged, livingSeats, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { reshuffleDiscard } from "../../interpret/verbs.ts";
import { startReveal } from "../../windows/frames.ts";
import { queueFront } from "../play/refs.ts";
import type { Focus } from "../index.ts";
import { effectData, moveEncounter, typeOf } from "./moves.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The ambush keyword has no effect while the table holds `ignoreAmbush` (Barren Hills 04045:A:1): no check is made. The enemy keeps the keyword for the cards that read it. */
export function ambushIgnored(state: ScenarioState): boolean {
  return state.modifiers.length > 0 && flagged(state, "table", "ignoreAmbush");
}

/**
 * The event announced is an enemy with the ambush keyword added to the staging area: the checks go on the stack as a frame of the enemy's own, put down before the frames of what hears the event, so those resolve first. Any other event, and an enemy
 * that is no longer in the staging area, changes nothing.
 */
export function pushAmbush(state: ScenarioState, event: GameEvent, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (event.trigger !== "addedToStaging" || event.cardId == null) return state;
  const enemy = state.cards[event.cardId];
  if (!enemy || enemy.zone !== "staging" || !hasKeyword(state, enemy.id, "ambush", ctx.cards)) return state;
  return pushEffectFrame(state, { frame: "forced", sourceId: enemy.id, actor: event.seat ?? state.firstPlayer, peril: false, effectId: `${enemy.code}:ambush`, instructions: [{ verb: "AmbushChecks" }], cancel: null, blockCancel: null, cause: ruleCause("dwd.ambush") }, steps);
}

/** AmbushChecks (no check while the table holds `noEngagementChecks` in the encounter phase, "Do not make engagement checks during the encounter phase", 01127:B:1; the quest phase's reveals still check): the source enemy, in the staging area, is checked against each player in turn from the first; the first whose Threat reaches its engagement cost engages it. */
export function ambushChecks(state: ScenarioState, enemyId: string | null, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const enemy = enemyId ? state.cards[enemyId] : undefined;
  if (!enemyId || !enemy || enemy.zone !== "staging" || ambushIgnored(state) || (state.phase === "Encounter" && flagged(state, "table", "noEngagementChecks"))) return state;
  for (const seat of livingSeats(state)) {
    if (!stagingEnemies(state, ctx.cards, seat).includes(enemyId) || !checkEngages(state, enemyId, seat, ctx.cards)) continue;
    return engageEnemy(state, seat, enemyId, steps);
  }
  return state;
}

/**
 * DiscardTopEncounter: the actor discards the top card of the encounter deck (the discard pile is shuffled back into an empty deck first, rr.running-out-of-cards). With `ambushCheck`, an enemy with the ambush keyword that way makes one engagement
 * check against the actor alone: when his Threat reaches its engagement cost it leaves the discard pile and enters his play area engaged (it enters play: its Forced effects and the lines that hear an engagement see it), else it stays in the discard pile.
 */
export function discardTopEncounter(state: ScenarioState, instruction: Verb<"DiscardTopEncounter">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const filled = reshuffleDiscard(state, steps, "rr.running-out-of-cards");
  const top = filled.encounterDeck[0];
  if (!top) return filled;
  const discarded = updateCard(moveCard(filled, top, { zone: "encounterDiscard" }), top, { face: "up", controller: null });
  if (instruction.ambushCheck !== true || typeOf(discarded, top, ctx) !== "enemy" || !hasKeyword(discarded, top, "ambush", ctx.cards) || ambushIgnored(discarded)) return discarded;
  if (discarded.seats[focus.seat]?.eliminated || !checkEngages(discarded, top, focus.seat, ctx.cards)) return discarded;
  return moveEncounter(discarded, top, "engaged", focus.seat, ctx, steps);
}

/** RevealEnemies: the first of the enemies still in the encounter discard pile is revealed in full by the actor, and the rest wait in the effect's queue behind it. */
export function revealEnemies(state: ScenarioState, instruction: Verb<"RevealEnemies">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const [id, ...rest] = (instruction.ids ?? []).filter((entry) => state.cards[entry]?.zone === "encounterDiscard" && typeOf(state, entry, ctx) === "enemy");
  if (!id || state.seats[focus.seat]?.eliminated) return state;
  const queued = rest.length > 0 && effectData(state) ? queueFront(state, [{ instruction: { verb: "RevealEnemies", ids: rest }, seat: focus.seat, chosen: null }]) : state;
  return startReveal(queued, focus.seat, ctx, steps, id);
}
