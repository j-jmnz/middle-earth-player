// Rules: rr.step-6-2, rr.shadow-effects, rr.travel, rr.cost, rr.in-play-and-out-of-play, mec108.thaurdir (data/rules/entries.json); ledger lines 10125:B:2, 10125:B:3, 10126:A:1, 10127:A:4, 10131:A:1, 10134:A:2, 10138:A:1.
// The shadow cards the enemies in play hold outside an attack: dealt to every enemy at once (Thaurdir's Captain side, Blight of Carn Dûm's Travel) or to one enemy wherever it is (the Werewolf), counted for Midwinter's Crux, kept at the end of the combat phase while stage 1B says so, and
// the flip of a card whose two sides are two cards (Thaurdir 10127 Captain / 10128 Champion).
import type { Amount, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import { flagged, inPlay, type ScenarioState } from "../../core/state.ts";
import { shadowCards } from "../../core/zones.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import { refCard, frameScope } from "../../interpret/amounts.ts";
import { dealAdditionalShadow, type ReduceContext } from "../../interpret/interpret.ts";
import type { Focus } from "../index.ts";
import { flipInPlace } from "../wilderland/gundabad.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The enemies in play: the staging area's first, then each player's engaged enemies in seat order. */
export function enemiesInPlay(state: ScenarioState, ctx: ReduceContext, trait?: string): string[] {
  const staged = state.staging.filter((id) => state.cards[id] && printedOf(ctx.cards, state.cards[id].code).type === "enemy");
  const engaged = state.seats.flatMap((seat) => seat.engaged).filter((id) => state.cards[id] != null);
  return [...staged, ...engaged].filter((id) => trait == null || hasTrait(state, id, trait, ctx));
}

/** DealShadowInPlay: one shadow card for each enemy in play (the staging area's first, then the players'), or for the enemy `target` names wherever it is. A card that is not an enemy in play gets none. */
export function dealShadowInPlay(state: ScenarioState, instruction: Verb<"DealShadowInPlay">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const ids = instruction.target ? [refCard(state, instruction.target, frameScope(state, focus.seat, focus.sourceId))] : enemiesInPlay(state, ctx, instruction.trait);
  let next = state;
  for (const id of ids) {
    const enemy = id ? next.cards[id] : undefined;
    if (!enemy || !inPlay(enemy.zone) || printedOf(ctx.cards, enemy.code).type !== "enemy") continue;
    next = dealAdditionalShadow(next, enemy.id, steps, ctx);
  }
  return next;
}

/** Whether the Travel line deals a shadow card to each enemy in play and the encounter deck cannot supply one for every enemy: the cost is paid completely or not at all (rr.cost, rr.travel). */
export function dealShadowUnpayable(state: ScenarioState, instruction: Instruction, ctx: ReduceContext): boolean {
  return instruction.verb === "DealShadowInPlay" && instruction.target == null && state.encounterDeck.length < enemiesInPlay(state, ctx, instruction.trait).length;
}

/** The amount `shadowCardsInPlay`: every shadow card dealt to an enemy in play. Null for any other amount. */
export function shadowCardsInPlayAmount(state: ScenarioState, found: Exclude<Amount, number>, ctx: ReduceContext): number | null {
  return found.shadowCardsInPlay ? enemiesInPlay(state, ctx).reduce((sum, id) => sum + shadowCards(state.cards[id]).length, 0) : null;
}

/** FlipTwoSided: the card in play with the code `front` or `back` shows the other. */
export function flipTwoSided(state: ScenarioState, instruction: Verb<"FlipTwoSided">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const up = Object.values(state.cards).find((card) => (card.code === instruction.front || card.code === instruction.back) && inPlay(card.zone));
  if (!up) return state;
  const [code, into] = up.code === instruction.front ? [instruction.front, instruction.back] : [instruction.back, instruction.front];
  return flipInPlace(state, { verb: "FlipInPlace", code, into }, ctx, steps);
}

/** The shadow cards left dealt at the end of the combat phase while the table keeps them (`keepShadowCards`): the facedown ones; a card the attack of its enemy turned up was resolved and goes. */
export function discardableShadow(state: ScenarioState, shadowId: string): boolean {
  return !flagged(state, "table", "keepShadowCards") || state.cards[shadowId]?.face === "up";
}
