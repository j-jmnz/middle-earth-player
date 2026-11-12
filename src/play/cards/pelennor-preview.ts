// Rules: rr.ownership-and-control, rr.in-play-and-out-of-play, mec113.saga-staging-rules (data/rules/entries.json); ledger lines 145074:A:1, 145074:B:2, 145074:B:3, 145075:A:1.
// What the card preview (table-preview.ts) says of an ally of Retreat from Osgiliath that lies in the staging area: whose it is and what it is until its owner takes control at stage 3. The engine decided each; this only says it.
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

const STAGE_TWO = "145074";

/** The muted line under a staged ally's name on stage 2B, or null: "Player 2's ally" (two-handed; "Your ally" solo), under no one's control, immune to player card effects, its text box blank, taken back at stage 3. */
export function pelennorDetail(game: ScenarioState, ctx: ReduceContext, card: ScenarioState["cards"][string]): string | null {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (stage?.code !== STAGE_TWO || card.zone !== "staging" || card.controller != null || card.owner == null || ctx.cards.get(card.code)?.type !== "ally") return null;
  const whose = game.seatCount > 1 ? `Player ${card.owner + 1}'s ally` : "Your ally";
  return `${whose}. No one controls it, it is immune to player card effects and its text box is blank while it lies in the staging area. ${game.seatCount > 1 ? "Its owner takes" : "You take"} control at stage 3.`;
}
