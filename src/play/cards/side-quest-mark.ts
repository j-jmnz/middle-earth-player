// Rules: mec108.side-quests, mec108.side-quests-in-play (data/rules/entries.json); ledger lines 09023:A:2, 09047:A:1, 09049:A:2, 10158:A:3.
// What a side quest in the staging area wears on the table: the current-quest mark (the quest that takes the progress after the active location, chosen at the beginning of the quest phase or by Pressing Needs) and, for a side quest that
// loses the game at a number of damage (Protect the Innocent), its damage against that number. The engine decided both (`flagged`, `heldAmount`); nothing here changes one. Pure, so a test reads it.
import { flagged, heldAmount, type ScenarioState } from "../../rules/core/state.ts";
import { printedOf } from "../../rules/core/printed.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";

/** `current`: the card is the current quest. `loses`: the pill at its foot, "3/10" with the damage art, threat red when one more damage loses the game. */
export type SideQuestMark = { current: boolean; loses: { text: string; danger: boolean; speech: string } | null };

/** Whether the card is a side quest in the staging area, encounter or player (The Lost Realm rules). */
export function stagedSideQuest(game: ScenarioState, ctx: ReduceContext, cardId: string): boolean {
  const card = game.cards[cardId];
  const type = card != null ? printedOf(ctx.cards, card.code).type : null;
  return card != null && card.zone === "staging" && card.face !== "down" && (type === "encounter-side-quest" || type === "player-side-quest");
}

export function sideQuestMark(game: ScenarioState, ctx: ReduceContext, cardId: string): SideQuestMark | null {
  if (!stagedSideQuest(game, ctx, cardId)) return null;
  const card = game.cards[cardId]!;
  const current = flagged(game, cardId, "currentQuest");
  const limit = heldAmount(game, cardId, "loseAtDamage");
  const loses = limit > 0 ? { text: `${card.damage}/${limit}`, danger: card.damage + 1 >= limit, speech: `${card.damage} of ${limit} damage, the players lose at ${limit}` } : null;
  return current || loses ? { current, loses } : null;
}
