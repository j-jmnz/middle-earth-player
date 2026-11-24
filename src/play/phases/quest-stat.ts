// Rules: hon.battle, hon.siege, rr.current-quest (data/rules/entries.json).
//
// The stat the characters committed to the current quest add to the quest total: Attack on a quest with Battle, Defense on one with Siege, Willpower
// otherwise (the engine's questStatOf, printed or gained keyword). Every quest number and word of the table reads it from here, so a Battle stage never
// shows "Willpower" over a total made of Attack. Pure, so a test reads it.
import { questPointsOf, questStatOf } from "../../rules/quest/quest.ts";
import { currentQuestId } from "../../rules/families/wilderland/night-quest.ts";
import { viewOf } from "../../rules/families/breaking/areas.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { STAT_WORD } from "../cards/card-effects.ts";
import { questSeat } from "../store/selectors.ts";

export type QuestStat = "willpower" | "attack" | "defense";

/** The stat the current quest counts (the acting seat's own stage once stages are separate): Willpower when the quest has neither Battle nor Siege or both. */
export function questStatNow(game: ScenarioState, ctx: ReduceContext): QuestStat {
  const view = viewOf(game, questSeat(game));
  const id = currentQuestId(view);
  return id ? questStatOf(view, id, ctx.cards) : "willpower";
}

/** The stat's word as the table capitalizes it ("Attack"); the quest meter and the spoken scale lowercase it. */
export function questStatWord(stat: QuestStat): string {
  return STAT_WORD[stat];
}

/** The stat a stage counts while it is the current quest (its printed Battle or Siege, or what its own text gives it): the stat read on a copy of the game where the stage is current. */
export function questStatOfStage(game: ScenarioState, ctx: ReduceContext, stageId: string): QuestStat {
  return questStatOf({ ...game, questStage: stageId }, stageId, ctx.cards);
}

/**
 * The stat the quest counted at a quest step of the round that has now ended, for a log read afterwards: the current stage's when the quest did not advance, else the stage it advanced from. That stage is the quest card set aside last with the progress that filled it (a stage a Response removed lies
 * set aside with none, and a stage advanced at once for want of a Battleground location with none: neither was ever counted against). Willpower when none is found.
 */
export function questStatThen(game: ScenarioState, ctx: ReduceContext, advancedTo: string | null): QuestStat {
  if (advancedTo == null) return questStatNow(game, ctx);
  const left = game.setAside.findLast((id) => {
    const card = game.cards[id];
    const points = card && ctx.cards.get(card.code)?.type === "quest" ? questPointsOf(game, card, ctx.cards) : null;
    return card != null && points != null && card.progress >= points;
  });
  return left ? questStatOfStage(game, ctx, left) : questStatNow(game, ctx);
}
