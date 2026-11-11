// Rules: mec113.minas-tirith, mec113.assault, rr.damage (data/rules/entries.json); ledger lines of the cards of The Battle of the Pelennor Fields (145043 to 145080). The verbs src/catalog/families/pelennor.ts adds and the hooks the core calls
// (interpret/family-hooks.ts): the damage the City Wall takes first lives in wall.ts, called by placeDamage (core/keywords.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { placeDamage } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Focus } from "../index.ts";
import { discardAllyToStaging, stagedAlliesCost, takeControlOfStagedAllies } from "./allies.ts";
import { attackerBarredByEngagement } from "./combat.ts";
import { attachShadowToHero, engageShadowCard, putTopmostFromEncounterDiscard } from "./moves.ts";
import { assaultQuestResult, placeProgressActiveFirst } from "./assault.ts";
import { minasTirithId } from "./wall.ts";

function damageMinasTirith(state: ScenarioState, instruction: Extract<Instruction, { verb: "DamageMinasTirith" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = minasTirithId(state);
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  return id && amount > 0 ? placeDamage(state, id, amount, ctx.cards, steps, "framework", currentCause(steps, UNATTRIBUTED)) : state;
}

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "DamageMinasTirith":
      return damageMinasTirith(state, instruction, focus, ctx, steps);
    case "PlaceProgressActiveFirst":
      return placeProgressActiveFirst(state, instruction, focus, ctx, steps);
    case "DiscardAllyToStaging":
      return discardAllyToStaging(state, instruction, focus, ctx, steps);
    case "TakeControlOfStagedAllies":
      return takeControlOfStagedAllies(state, instruction, focus, ctx);
    case "PutTopmostFromEncounterDiscard":
      return putTopmostFromEncounterDiscard(state, instruction, focus, ctx, steps);
    case "EngageShadowCard":
      return engageShadowCard(state, focus, ctx, steps);
    case "AttachShadowToHero":
      return attachShadowToHero(state, instruction, focus, ctx);
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "pelennor",
  verbs: ["DamageMinasTirith", "PlaceProgressActiveFirst", "DiscardAllyToStaging", "TakeControlOfStagedAllies", "PutTopmostFromEncounterDiscard", "EngageShadowCard", "AttachShadowToHero"],
  run,
  combat: { attack: (state, enemyId, _attacker, _target, attackerId) => attackerBarredByEngagement(state, enemyId, attackerId) },
  amount: (state, found, _scope, ctx) => (found.stagedAlliesCost ? stagedAlliesCost(state, ctx) : null),
  questResult: (state, totals, cards, steps) => assaultQuestResult(state, totals, cards, steps, minasTirithId(state)),
};
