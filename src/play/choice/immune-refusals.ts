// Rules: rr.immune, mec109.immune-to-player-card-effects (data/rules/entries.json). The cards of the type a player card's pick asks for that the pick leaves out because they are immune to player card effects, listed beside the rows as the travel
// refusals are ("Spider Burrow · Immune to player card effects"). The engine decided which (immune-left-out.ts); this only names them.
import type { Instruction } from "../../catalog/boundary.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { isPlayerCardEffect } from "../../rules/core/keywords.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { KEYWORD_RULES } from "../cards/keyword-rules.ts";
import { pictureKey } from "../canvas/picture-key.ts";
import { immuneLeftOut } from "../store/immune-left-out.ts";
import { cardLabel } from "./sheet-parts.ts";
import type { SheetNames, Unavailable } from "./sheet-types.ts";

const PLAIN_TYPES: ReadonlySet<string> = new Set(["hero", "ally", "enemy", "location", "attachment", "treachery", "objective"]);

/** The `unavailable` rows of a Pick of `type` in play: each card the pick counts that prints the immune keyword, is immune to the source and is not among the `options`. Empty for an encounter card's pick, which may choose it. */
export function immuneRefusals(game: ScenarioState, ctx: ReduceContext, names: SheetNames, instruction: Instruction | null, options: readonly string[], sourceId: string | null, seat: number): { unavailable: Unavailable[] } | Record<string, never> {
  if (instruction?.verb !== "Pick" || !PLAIN_TYPES.has(instruction.pick.type) || sourceId == null || !isPlayerCardEffect(game, ctx.cards, sourceId)) return {};
  const refused = immuneLeftOut(game, ctx, instruction.pick, seat, sourceId, options);
  return refused.length === 0 ? {} : { unavailable: refused.map((id) => ({ id, label: cardLabel(game, names, id), code: pictureKey(game.cards[id]), reason: `${KEYWORD_RULES.immune.word}.` })) };
}
