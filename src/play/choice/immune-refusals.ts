// Rules: rr.immune, mec109.immune-to-player-card-effects (data/rules/entries.json). The cards of the type a player card's pick asks for that the pick leaves out because they are immune to player card effects, listed beside the rows as the travel
// refusals are ("Spider Burrow · Immune to player card effects"). The engine decided which (immuneTo, rules/interpret/immune-targets.ts); this only names them.
import type { Instruction } from "../../catalog/boundary.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { inPlay, type ScenarioState } from "../../rules/core/state.ts";
import { isPlayerCardEffect } from "../../rules/core/keywords.ts";
import { immuneTo } from "../../rules/interpret/immune-targets.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { KEYWORD_RULES } from "../cards/keyword-rules.ts";
import { pictureKey } from "../canvas/picture-key.ts";
import { cardLabel } from "./sheet-parts.ts";
import type { SheetNames, Unavailable } from "./sheet-types.ts";

const PLAIN_TYPES: ReadonlySet<string> = new Set(["hero", "ally", "enemy", "location", "attachment", "treachery", "objective"]);

/** The `unavailable` rows of a Pick of `type` in play: each card of that type that prints the immune keyword and is not among the `options`. Empty for an encounter card's pick, which may choose it. */
export function immuneRefusals(game: ScenarioState, ctx: ReduceContext, names: SheetNames, instruction: Instruction | null, options: readonly string[], sourceId: string | null): { unavailable: Unavailable[] } | Record<string, never> {
  if (instruction?.verb !== "Pick" || !PLAIN_TYPES.has(instruction.pick.type) || !isPlayerCardEffect(game, ctx.cards, sourceId)) return {};
  const refused = Object.values(game.cards).filter((card) => inPlay(card.zone) && !options.includes(card.id) && printedOf(ctx.cards, card.code).type === instruction.pick.type && printedOf(ctx.cards, card.code).keywords.immuneToPlayerCardEffects === true && immuneTo(game, card.id, sourceId, ctx));
  return refused.length === 0 ? {} : { unavailable: refused.map((card) => ({ id: card.id, label: cardLabel(game, names, card.id), code: pictureKey(card), reason: `${KEYWORD_RULES.immune.word}.` })) };
}
