// Rules: rr.shadow-effects, rr.step-6-4-2, rr.reveal, rr.in-play-and-out-of-play, rr.explored (data/rules/entries.json); ledger lines 101156:A:1, 101158:A:1, 101158:A:2, 21032:A:3.
// Cards that go facedown onto an enemy or are read after they leave the encounter deck: the shadow cards of an attack whose "when revealed" effects the Witch of Angmar resolves, the cards a shadow effect discards from the top of the encounter deck, and Sinister Dungeon dealt to the
// Reanimated Dead its exploring made.
import type { Instruction } from "../../../../catalog/boundary.ts";

import type { EngineStep } from "../../../core/intents.ts";
import { printedOf } from "../../../core/printed.ts";
import { inPlay, updateCard, type ScenarioState } from "../../../core/state.ts";
import { moveCard, shadowCards } from "../../../core/zones.ts";
import { hasTrait } from "../../../interpret/conditions.ts";
import type { ReduceContext } from "../../../interpret/interpret.ts";
import { pushCardEffects } from "../../../interpret/effect-frames.ts";
import { lastPicked } from "../../../interpret/player-verbs.ts";
import { effectData } from "../../encounter/moves.ts";
import { listened, queueHeard } from "../../defense/listen.ts";
import type { Focus } from "../../index.ts";
import { holdsKeptShadow } from "../../mordor/shadows.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The attack's shadow cards have resolved (their shadow effects first): announced once about the attacking enemy when it holds a shadow card and some card hears it, and before damage is dealt (`shadowsResolved`, the Witch of Angmar's Forced and Black Númenórean's, which resolves the shadow cards he keeps: it is announced when the new card's effect was canceled only for an enemy that keeps some). */
export function announceShadowsResolved(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  const attack = state.pendingAttack;
  const enemy = attack ? state.cards[attack.enemyId] : undefined;
  if (!attack || !enemy || (attack.shadowCanceled && !holdsKeptShadow(state, enemy.id)) || shadowCards(enemy).length === 0 || !listened(state, ctx, ["shadowsResolved"])) return state;
  return queueHeard(state, ctx, { trigger: "shadowsResolved", seat: attack.seat, cardId: enemy.id, subject: enemy.id });
}

// The "when revealed" effects of these cards resolve in the order given, the defending player (the acting seat) revealing them: each is a frame on top of the stack, so the last one pushed resolves first.
function resolveReveals(state: ScenarioState, ids: readonly string[], seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const id of [...ids].reverse()) {
    const code = next.cards[id]?.code;
    if (code) next = pushCardEffects(next, "whenRevealed", id, seat, false, ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed"), ctx, steps);
  }
  return next;
}

/** ResolveWhenRevealedOf: the "when revealed" effects of the cards with the Trait that the effect named, in the order they lay: the shadow cards dealt to the source (`heldShadows`, the defending player revealing them) or the cards the effect discarded from the top of the encounter deck (`looked`). A card that is not at hand any more (it attached itself) is skipped. */
export function resolveWhenRevealedOf(state: ScenarioState, instruction: Verb<"ResolveWhenRevealedOf">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  const held = instruction.of === "heldShadows" ? shadowCards(focus.sourceId ? state.cards[focus.sourceId] : undefined) : (effectData(state)?.looked ?? []).filter((id) => state.cards[id]?.zone === "encounterDiscard");
  const ids = held.filter((id) => (instruction.name != null ? printedOf(ctx.cards, state.cards[id]?.code ?? "").name === instruction.name : instruction.trait != null && hasTrait(state, id, instruction.trait, ctx)));
  return resolveReveals(state, ids, instruction.of === "heldShadows" ? (attack?.seat ?? focus.seat) : focus.seat, ctx, steps);
}

/** DealSourceAsShadow: the source, a card that has just left play, is dealt facedown to the enemy the effect picked last as a shadow card, with no progress or damage left on it ("deals Sinister Dungeon to it facedown as a shadow card", 101158:A:1). Nothing happens when that card is not an enemy in play or the source is still in play. */
export function dealSourceAsShadow(state: ScenarioState, focus: Focus): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const enemy = state.cards[lastPicked(state)];
  if (!source || !enemy || inPlay(source.zone) || (enemy.zone !== "engaged" && enemy.zone !== "staging")) return state;
  return updateCard(moveCard(state, source.id, { zone: "shadow", enemyId: enemy.id }), source.id, { face: "down", progress: 0, damage: 0 });
}
