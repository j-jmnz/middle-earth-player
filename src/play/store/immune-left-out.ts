// Rules: rr.immune, mec109.immune-to-player-card-effects (data/rules/entries.json). The cards a player card's pick would count but leaves out because they are immune to player card effects. The engine decided which (pickCandidates with
// `counting`, immuneTo in rules/interpret/immune-targets.ts); the sheet's refusals and the banner's sentence both name what this returns.
import type { PickSpec } from "../../catalog/boundary.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { immuneTo } from "../../rules/interpret/immune-targets.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { pickCandidates } from "../../rules/interpret/pick.ts";

/** The cards the pick counts that print the immune keyword, are immune to `sourceId`'s effect and are not among `offered`, in the order the pick lists them. */
export function immuneLeftOut(game: ScenarioState, ctx: ReduceContext, pick: PickSpec, seat: number, sourceId: string, offered: readonly string[]): string[] {
  return pickCandidates(game, pick, seat, [], sourceId, ctx, undefined, undefined, true).filter(
    (id) => !offered.includes(id) && ctx.cards.get(game.cards[id]?.code ?? "")?.keywords.immuneToPlayerCardEffects === true && immuneTo(game, id, sourceId, ctx),
  );
}
