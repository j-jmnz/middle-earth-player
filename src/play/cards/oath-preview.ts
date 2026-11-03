// Rules: rr.limits (data/rules/entries.json); ledger lines 41044:A:3 to 41047:A:3.
// The one line an Adaptation says about itself in the card preview (table-preview.ts) once its Action was used: "Limit once per campaign. Record in
// Campaign Log when used." The engine decided; nothing here changes it.
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

/** The muted line under a card's name in its preview, or null: an Adaptation whose once-per-campaign Action is spent (in this game or an earlier scenario). */
export function oathDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  const limited = ctx.effects.some((effect) => effect.cardCode === card.code && effect.limit === "oncePerCampaign");
  return limited && (game.campaignFacts?.usedOnce ?? []).includes(card.code) ? "Its Action is used for this campaign." : null;
}
