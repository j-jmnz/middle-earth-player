// Rules: mec108.side-quests, mec108.side-quests-in-play, rr.the-word-choose, rr.first-player, faq.side-quest-current-quest-text (data/rules/entries.json); ledger lines 09016:A:1, 09047:A:1, 09047:A:2, 09048:A:1, 09048:A:2, 09049:A:2, 09050:A:1, 09050:A:2, 09023:A:2, 09019:A:2.
// The quest cards in play, and the current quest chosen among them. The main quest card is a quest card in play, and so is each encounter side quest in the staging area and each player side quest in a quest area; the text on each is active (faq.side-quest-current-quest-text).
// A quest card in the victory display or a discard pile is not in play.
import type { Amount, Condition, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { Scope } from "../../interpret/conditions.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { flagged, inPlay, type CardInstance, type ScenarioState } from "../../core/state.ts";
import { committedWillpower, stagingThreat } from "../../quest/quest.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectData } from "../encounter/moves.ts";
import { questCardPool } from "../quest/quest-card.ts";
import { makeCurrentQuest } from "../wilderland/night.ts";
import { currentQuestId, currentSideQuest, mainQuestBarred, stagedSideQuests } from "../wilderland/night-quest.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The quest cards in play for the seat now (the pool of `questCardPool`: the stage of its area, the encounter side quests in its staging area and the player side quests in the quest areas). Never fewer than 1 (a game whose quest deck is done has still its last stage in play). */
export function questCardsInPlay(state: ScenarioState, seat: number, ctx: ReduceContext): number {
  return Math.max(1, questCardPool(state, seat, ctx).length);
}

/** The cards that may be the current quest: the main quest card (not in the quest phase while it cannot be chosen, 10094:B:3) and the encounter side quests in the staging area. A player side quest never is. */
function choosable(state: ScenarioState, ctx: ReduceContext): string[] {
  return [...(state.questStage && !mainQuestBarred(state) ? [state.questStage] : []), ...stagedSideQuests(state, ctx)];
}

/** The quest card that is the current quest now: the side quest chosen until the end of the phase, else the main quest card; none in the quest phase while the main quest card cannot be chosen and no side quest was. */
function currentQuestCard(state: ScenarioState): string | null {
  return currentQuestId(state);
}

/** The current quest is the card (`id`): the mark of the side quest that held it ends, and a side quest takes it until the end of the phase; the main quest card takes it by holding no mark. */
export function setCurrentQuest(state: ScenarioState, id: string, ctx: ReduceContext): ScenarioState {
  const cleared: ScenarioState = state.modifiers.some((modifier) => modifier.stat === "currentQuest") ? { ...state, modifiers: state.modifiers.filter((modifier) => modifier.stat !== "currentQuest") } : state;
  return id === cleared.questStage ? cleared : makeCurrentQuest(cleared, { verb: "MakeCurrentQuest", card: id }, ctx);
}

/**
 * ChooseCurrentQuest: the first player chooses a quest card other than the current quest to be the current quest until the end of the phase (09049:A:2): the main quest card or an encounter side quest in the staging area. A single card is taken without asking, none leaves
 * the quest as it is. Run outside an effect frame, which cannot ask, it takes the first card.
 */
export function chooseCurrentQuest(state: ScenarioState, instruction: Verb<"ChooseCurrentQuest">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const current = currentQuestCard(state);
  const options = choosable(state, ctx).filter((id) => id !== current);
  if (options.length === 0) return state;
  const chosen = focus.chosen != null && options.includes(focus.chosen) ? focus.chosen : options.length === 1 || !effectData(state) ? options[0] : undefined;
  if (chosen == null) return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options);
  return setCurrentQuest(state, chosen, ctx);
}

/** The amount `questCards` (09016:A:1, 09048:A:1, 09047:A:2, 09050:A:1: "X is the number of quest cards in play"). */
export function questCardsAmount(state: ScenarioState, found: Exclude<Amount, number>, seat: number, ctx: ReduceContext): number | null {
  return found.questCards ? questCardsInPlay(state, seat, ctx) : null;
}

/**
 * The condition `currentQuestProgress` (10099:A:1, 10099:A:2): the current quest card holds progress (`some`) or none (`none`); false either way while there is no current quest (10094:B:3). The condition `currentQuest`: `side` a side quest is the current quest now ("If the current quest is a side quest", 09047:A:1), `self` the source is that side quest ("While Orc Rearguard is the current quest", 09023:A:2), `other` there is a quest card besides the
 * current quest that could be chosen (the second option of 09049:A:2).
 */
export function currentQuestHolds(state: ScenarioState, condition: Condition, scope: Scope, ctx: ReduceContext): boolean | null {
  if (condition.kind === "currentQuestProgress") {
    const current = currentQuestId(state);
    const card = current ? state.cards[current] : undefined;
    return card != null && (condition.is === "some" ? card.progress > 0 : card.progress === 0);
  }
  if (condition.kind !== "currentQuest") return null;
  const side = currentSideQuest(state);
  if (condition.is === "side") return side != null;
  if (condition.is === "self") return side != null && side === scope.sourceId && flagged(state, side, "currentQuest");
  return choosable(state, ctx).some((id) => id !== currentQuestCard(state));
}

/** The condition `questLeads`: the total Willpower of the characters committed to the quest is greater than the total Threat in the staging area now (09021:A:1). */
export function questLeadsHolds(state: ScenarioState, condition: Condition, ctx: ReduceContext): boolean | null {
  return condition.kind === "questLeads" ? committedWillpower(state, ctx.cards) > stagingThreat(state, ctx.cards) : null;
}

/** A card's hit points now: the printed number with the constant effects applied (Thaurdir's 9, a burden or boon that changes it). The one reading the stage's hold and the table's dial share. */
export function hitPointsOf(state: ScenarioState, card: CardInstance, ctx: ReduceContext): number {
  return modifiedStat(state, card, "hitPoints", ctx.cards);
}

/** The condition `hitPointsLeft`: the card in play with the code has damage below its hit points (09074:B:2: the stage cannot be defeated while Thaurdir has any hit points remaining). False with no such card in play. */
export function hitPointsLeftHolds(state: ScenarioState, condition: Condition, ctx: ReduceContext): boolean | null {
  if (condition.kind !== "hitPointsLeft") return null;
  const card = Object.values(state.cards).find((other) => other.code === condition.code && inPlay(other.zone));
  return card != null && card.damage < hitPointsOf(state, card, ctx);
}
