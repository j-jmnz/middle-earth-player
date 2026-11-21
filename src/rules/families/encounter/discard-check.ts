// Rules: rr.encounter-deck, rr.shadow-effects, rr.reveal, dwd.doors-of-durin (data/rules/entries.json); ledger lines 04073:A:1, 04074:A:1, 04075:A:1, 901503:A:1, 901504:A:1, 04065:A:2.
//
// What an effect reads of the encounter card it just discarded from the top of the deck (MoveEncounterCard `deckTop` to `discard`: the card is the effect's picked card, "" when the deck and the discard pile were empty) and of the damage of the player attack
// it answers. The discard check of the Tentacles: "If that card has a shadow effect or is a Tentacle enemy". Doors of Durin: "If the first letter of the encounter card's title matches that of one of the discarded player cards".
import type { Amount, Condition } from "../../../catalog/boundary.ts";

import { attackStrength } from "../../combat/combat.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { AmountScope } from "../../interpret/amounts.ts";
import { hasTrait, type Scope } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectsOf } from "../../windows/listen.ts";

// The encounter card the effect discarded last: the latest picked card that lies in the encounter discard pile.
function discardedCard(state: ScenarioState, picked: readonly string[] | undefined): string | null {
  for (let index = (picked ?? []).length - 1; index >= 0; index -= 1) {
    const id = picked?.[index] ?? "";
    if (state.cards[id]?.zone === "encounterDiscard") return id;
  }
  return null;
}

/** "Has a shadow effect" is a printed Shadow line, which the card's `shadow` record implements; "a Tentacle enemy" is an enemy with the trait. */
function hasShadowOrIsTentacleEnemy(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  if (!card) return false;
  if (effectsOf(ctx, card.code).some((effect) => effect.timing === "shadow")) return true;
  return printedOf(ctx.cards, card.code).type === "enemy" && hasTrait(state, id, "Tentacle", ctx);
}

// The first letter of a title: its first letter or digit, accents and case aside ("Éowyn" is E, "A Burning Brand" is A).
function firstLetter(title: string): string {
  return (title.normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[\p{L}\p{N}]/u)?.[0] ?? "").toLowerCase();
}

function firstLetterMatches(state: ScenarioState, picked: readonly string[] | undefined, ctx: ReduceContext): boolean {
  const discarded = discardedCard(state, picked);
  const card = discarded ? state.cards[discarded] : undefined;
  if (!discarded || !card) return false;
  const letter = firstLetter(printedOf(ctx.cards, card.code).name);
  if (letter === "") return false;
  return (picked ?? []).some((id) => {
    const other = id !== discarded ? state.cards[id] : undefined;
    return other != null && firstLetter(printedOf(ctx.cards, other.code).name) === letter;
  });
}

/** The encounter family's condition kinds; null for any other. */
export function discardCondition(state: ScenarioState, condition: Condition, scope: Scope, ctx: ReduceContext): boolean | null {
  if (condition.kind === "discardedHasShadowOrTentacle") {
    const id = discardedCard(state, scope.picked);
    return id != null && hasShadowOrIsTentacleEnemy(state, id, ctx);
  }
  if (condition.kind === "firstLetterMatches") return firstLetterMatches(state, scope.picked, ctx);
  return null;
}

/** The damage the player attack the effect answers would deal its enemy, the source: the attackers' total Attack less its Defense (`attackDamage`). Null for any other amount. */
export function attackDamageAmount(state: ScenarioState, amount: Exclude<Amount, number>, scope: AmountScope, ctx: ReduceContext): number | null {
  if (amount.attackDamage !== true) return null;
  const enemy = scope.sourceId ? state.cards[scope.sourceId] : undefined;
  if (!enemy) return 0;
  return Math.max(0, attackStrength(state, scope.participants ?? [], enemy.id, ctx.cards) - modifiedStat(state, enemy, "defense", ctx.cards));
}
