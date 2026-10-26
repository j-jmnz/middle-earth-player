// Rules: rr.traits, rr.in-play-and-out-of-play (data/rules/entries.json).
//
// The sidequests family's pick filters (effect-schema-pick.ts): a Trait shared with the active location or the attacking enemy,
// the same title as another card, the quest a character is committed to.
import type { PickSpec } from "../../catalog/boundary.ts";
import { grantedTraits } from "../conditions.ts";
import type { ReduceContext } from "../interpret.ts";
import type { PickContext } from "../pick.ts";
import { printedOf } from "../printed.ts";
import type { ScenarioState } from "../state.ts";

function traitsOf(state: ScenarioState, id: string, ctx: ReduceContext): string[] {
  const instance = state.cards[id];
  return instance ? [...printedOf(ctx.cards, instance.code).traits, ...grantedTraits(state, id, ctx)] : [];
}

// The card a `sharesTraitWith` or `sameTitleAs` filter compares with.
function comparedWith(state: ScenarioState, which: "activeLocation" | "attackingEnemy" | "subject" | "picked", at: PickContext): string | null {
  switch (which) {
    case "activeLocation":
      return state.activeLocation;
    case "attackingEnemy":
      return state.pendingAttack?.enemyId ?? state.pendingStrike?.enemyId ?? null;
    case "subject":
      return at.subject ?? null;
    case "picked":
      return at.picked?.at(-1) || null;
  }
}

export function sidequestsPickMatches(state: ScenarioState, id: string, spec: PickSpec, at: PickContext, ctx: ReduceContext): boolean {
  if (spec.sharesTraitWith) {
    const other = comparedWith(state, spec.sharesTraitWith, at);
    if (!other || other === id) return false;
    const mine = traitsOf(state, id, ctx);
    if (!traitsOf(state, other, ctx).some((trait) => mine.includes(trait))) return false;
  }
  if (spec.sameTitleAs) {
    const other = comparedWith(state, spec.sameTitleAs, at);
    const instance = state.cards[id];
    const compared = other ? state.cards[other] : undefined;
    if (!instance || !compared || other === id) return false;
    if (printedOf(ctx.cards, instance.code).name !== printedOf(ctx.cards, compared.code).name) return false;
  }
  if (spec.committedTo) {
    const instance = state.cards[id];
    if (!instance?.committed) return false;
    if ((instance.questTo != null) !== (spec.committedTo === "sideQuest")) return false;
  }
  return true;
}
