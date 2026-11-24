// Rules: hon.battle, hon.siege, rr.current-quest (data/rules/entries.json).
//
// The stat the characters committed to the current quest add to the quest total: Attack on a quest with Battle, Defense on one with Siege, Willpower
// otherwise (the engine's questStatOf, printed or gained keyword). Every quest number and word of the table reads it from here, so a Battle stage never
// shows "Willpower" over a total made of Attack. Pure, so a test reads it.
import { questStatOf } from "../../rules/quest/quest.ts";
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
