// Rules: rr.immune, mec109.immune-to-player-card-effects (data/rules/entries.json). The banner line of progress a player card placed on the one location its pick left, because the others it could have chosen are immune to player card
// effects: "Spider Burrow is immune to player card effects: the progress goes on Cobwebbed Cavern." The engine decided which cards the pick offers (pickCandidates, rules/interpret/pick.ts, with and without `counting`); this only names them.
import type { EngineStep } from "../../rules/core/intents.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { pickCandidates } from "../../rules/interpret/pick.ts";
import { KEYWORD_RULES } from "../cards/keyword-rules.ts";

const lower = (word: string): string => `${word.charAt(0).toLowerCase()}${word.slice(1)}`;

/** The sentence for a progress step a player card's line placed on a location chosen among those the pick offered, when immune locations were left out and that location was the only one offered; else null. `before` is the state before the intent. */
export function immuneProgressWords(ctx: ReduceContext, before: ScenarioState, step: Extract<EngineStep, { kind: "progress" }>, nameOf: (cardId: string) => string): string | null {
  if (step.amount <= 0 || !("line" in step.cause)) return null;
  const line = step.cause.line;
  const code = line.split(":")[0];
  const source = Object.values(before.cards).find((card) => card.code === code);
  const pick = ctx.effects.find((effect) => effect.lines.includes(line))?.instructions.find((instruction) => instruction.verb === "Pick" && instruction.pick.type === "location");
  if (!source || pick?.verb !== "Pick") return null;
  const seat = before.firstPlayer;
  const offered = pickCandidates(before, pick.pick, seat, [], source.id, ctx);
  if (offered.length !== 1 || offered[0] !== step.targetId) return null;
  const left = pickCandidates(before, pick.pick, seat, [], source.id, ctx, undefined, undefined, true).filter((id) => id !== step.targetId && !offered.includes(id) && before.cards[id]?.zone !== "discard");
  const immune = left.find((id) => ctx.cards.get(before.cards[id]?.code ?? "")?.keywords.immuneToPlayerCardEffects === true);
  return immune == null ? null : `${nameOf(immune)} is ${lower(KEYWORD_RULES.immune.word)}: the progress goes on ${nameOf(step.targetId)}.`;
}
