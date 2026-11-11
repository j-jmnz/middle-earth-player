// Rules: rr.immune, rr.resources, rr.effects (data/rules/entries.json).
//
// What the misc family protects a card from: immunity to the effects of cards that lack a Trait ("Immune to non-Master card
// effects", "Immune to non-Gollum card effects"), and a hero that gains no resources from some cards' effects (Bilbo Baggins).
import type { ReduceContext } from "../../interpret/interpret.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import { effectsOf } from "../../windows/listen.ts";
import { isPlayerType, printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";

// Whether the effect of the source card may not choose or affect the target: the target is immune to cards without a Trait and
// the source has none of it. A rule (no source card) is not a card effect.
export function immuneToSource(state: ScenarioState, targetId: string, sourceId: string | null, ctx: ReduceContext): boolean {
  if (!sourceId || sourceId === targetId || state.modifiers.length === 0 || !state.cards[sourceId]) return false;
  if (flagged(state, targetId, "immuneToNonMaster") && !hasTrait(state, sourceId, "Master", ctx)) return true;
  if (flagged(state, targetId, "immuneToNonGollum") && !hasTrait(state, sourceId, "Gollum", ctx)) return true;
  // "Immune to non-Fellowship player card effects" (144075:A:1): the effect of a player card that is not a Fellowship card.
  if (flagged(state, targetId, "immuneToNonFellowship")) {
    const printed = printedOf(ctx.cards, state.cards[sourceId]?.code ?? "");
    if (isPlayerType(printed) && printed.sphere !== "fellowship") return true;
  }
  return false;
}

// A hero whose pool a card names as paying for it even when its player does not control the hero (Burglar Baggins: "You may
// spend a Baggins resource from Bilbo Baggins' resource pool to play this card even if you do not control Bilbo Baggins").
export function openPool(state: ScenarioState, heroId: string, cardId: string, ctx: ReduceContext): boolean {
  const hero = state.cards[heroId];
  const card = state.cards[cardId];
  if (!hero || !card || hero.zone !== "heroes") return false;
  const name = printedOf(ctx.cards, hero.code).name;
  return effectsOf(ctx, card.code).some((effect) => effect.instructions.some((instruction) => instruction.verb === "PayFromHero" && instruction.name === name));
}

// The heroes of other players whose pools may pay for the card.
export function openPools(state: ScenarioState, seat: number, cardId: string | undefined, ctx: ReduceContext): string[] {
  if (cardId == null) return [];
  return Object.values(state.cards)
    .filter((hero) => hero.zone === "heroes" && hero.controller !== seat && openPool(state, hero.id, cardId, ctx))
    .map((hero) => hero.id);
}

// Whether a card effect of the source may add resources to the hero's pool (Bilbo Baggins "cannot gain resources from player card
// effects" / "from non-treasure cards").
export function mayGainResources(state: ScenarioState, heroId: string, sourceId: string | null, ctx: ReduceContext): boolean {
  if (state.modifiers.length === 0) return true;
  // "Players cannot gain resources" (143078:B:1): whatever the source.
  if (flagged(state, "table", "cannotGainResources")) return false;
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!source) return true;
  const printed = printedOf(ctx.cards, source.code);
  if (flagged(state, heroId, "noPlayerCardResources") && isPlayerType(printed)) return false;
  if (flagged(state, heroId, "noNonTreasureResources") && printed.type !== "treasure") return false;
  return true;
}
