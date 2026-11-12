// Rules: rr.in-play-and-out-of-play, rr.shadow-effects, rr.engaged, rr.attachment-cards (data/rules/entries.json); ledger lines 145076:A:1, 145053:A:2, 145055:A:3, 145058:A:2.
// The moves of the box's cards that no other family makes: the topmost Orc of the discard pile put into play engaged, a shadow card that engages, a shadow card that attaches.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { attachTo, moveCard, shadowCards } from "../../core/zones.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** PutTopmostFromEncounterDiscard: the last card put on the encounter discard pile that is of the type and has the trait enters play engaged with the actor. */
export function putTopmostFromEncounterDiscard(state: ScenarioState, instruction: Verb<"PutTopmostFromEncounterDiscard">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = [...state.encounterDiscard].reverse().find((candidate) => state.cards[candidate] != null && printedOf(ctx.cards, state.cards[candidate]!.code).type === instruction.type && hasTrait(state, candidate, instruction.trait, ctx));
  return id ? moveEncounter(state, id, "engaged", focus.seat, ctx, steps) : state;
}

/** EngageShadowCard: the shadow card the source is (an enemy) leaves the enemy it was dealt to and engages the player that enemy attacks. */
export function engageShadowCard(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = focus.sourceId;
  const card = id ? state.cards[id] : undefined;
  const attack = state.pendingAttack;
  if (!id || !card || card.zone !== "shadow" || !attack || printedOf(ctx.cards, card.code).type !== "enemy") return state;
  const free = updateCard(moveCard(state, id, { zone: "staging" }), id, { host: null, face: "up", controller: null });
  return moveEncounter(free, id, "engaged", attack.seat, ctx, steps);
}

/** AttachShadowToHero: at the end of an attack that damaged its defending hero (or the hero an undefended attack landed on), the attacker's shadow card with the code attaches to that hero faceup, unless the hero carries a copy. */
export function attachShadowToHero(state: ScenarioState, instruction: Verb<"AttachShadowToHero">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const data = effectData(state);
  const hero = data?.other ? state.cards[data.other] : undefined;
  const attacker = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!hero || !attacker || (data?.dealt ?? 0) <= 0 || !inPlay(hero.zone) || printedOf(ctx.cards, hero.code).type !== "hero") return state;
  if (hero.attachments.some((other) => state.cards[other]?.code === instruction.code)) return state;
  const here = [...shadowCards(attacker), ...Object.values(state.cards).filter((card) => card.zone === "shadow" && card.host === attacker.id).map((card) => card.id)];
  const id = [...here, ...[...state.encounterDiscard].reverse()].find((candidate) => state.cards[candidate]?.code === instruction.code && (state.cards[candidate]?.zone === "shadow" || state.cards[candidate]?.zone === "encounterDiscard"));
  if (!id) return state;
  return updateCard(attachTo(updateCard(moveCard(state, id, { zone: "attached" }), id, { host: null }), id, hero.id), id, { face: "up", controller: null });
}
