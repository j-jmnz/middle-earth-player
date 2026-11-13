// Rules: mec108.time-x, mec108.side-quests-in-play, mec108.the-investigation, rr.explored (data/rules/entries.json); ledger lines 10094:B:1, 10094:B:3, 10095:B:1, 10101:A:1, 10101:A:2.
//
// The pieces The Treachery of Rhudaur's cards hold on the table: the Clue objectives attached to characters against the 3 that exist (each takes 5 quest points off stage 2B, shown with the points left), each Forbidden Descent's progress sponge (the progress it took this round against the 2 it takes),
// and the word "None" when the main quest card cannot be the current quest and no side quest was chosen. Secrets of Rhudaur's time counters are the Time dial of `readouts/angmar.ts`, worded for this card. The engine decided every number (`claimed`, `spongeTaken`, `currentQuestId`); nothing here changes one.
// Empty in any other scenario. Pure, so a test reads it.
import { flagged, heldAmount, inPlay, type CardInstance, type ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { stageOf } from "../../rules/families/breaking/areas.ts";
import { currentQuestId } from "../../rules/families/wilderland/night-quest.ts";
import { questPointsOf } from "../../rules/quest/quest.ts";

import { CLUES_TOTAL, NO_CURRENT_NAME, NO_CURRENT_WORD, SPONGE_LIMIT, cluesLimitWords, cluesWords, noCurrentWords, spongeLimitWords, spongeNearWords, spongeWords } from "../words/scenarios/angmar/rhudaur-table.ts";
import { cardsOf, type TableDial } from "./dials.ts";

export const SECRETS_OF_RHUDAUR = "10094";
export const THAURDIRS_PURSUIT = "10095";
export const FORBIDDEN_DESCENT = "10101";
/** The three Clue objectives: Daechanar's Brand, Heirloom of Iârchon and Orders from Angmar. */
export const CLUE_CODES: readonly string[] = ["10110", "10112", "10114"];
/** The Treachery of Rhudaur side quests, quest side up. */
export const SIDE_QUEST_CODES: readonly string[] = ["10109", "10111", "10113"];

/** The Clue objectives attached to a character now (a player's hero or Amarthiúl): the ones stage 2B counts (10095:B:1). One in the staging area is nobody's. */
export const claimedClues = (game: ScenarioState): CardInstance[] => Object.values(game.cards).filter((card) => CLUE_CODES.includes(card.code) && card.claimed === true && card.host != null && inPlay(card.zone));

/** The Treachery of Rhudaur side quests in play quest side up: the staged ones and the current one (10094:B:2, 10094:B:4). */
export const sideQuestsInPlay = (game: ScenarioState): number => Object.values(game.cards).filter((card) => SIDE_QUEST_CODES.includes(card.code) && inPlay(card.zone)).length;

/** The progress a Forbidden Descent took this round, never more than the 2 it takes. */
export const spongeTaken = (game: ScenarioState, card: CardInstance): number => Math.min(SPONGE_LIMIT, heldAmount(game, card.id, "spongeTaken"));

/** The copies of Forbidden Descent in the staging area, oldest first: the order their sponges fill. */
export const sponges = (game: ScenarioState): CardInstance[] => cardsOf(game, FORBIDDEN_DESCENT).filter((card) => card.zone === "staging").sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));

/** The current stage and its card, when it is one of this scenario's. */
function stageNow(game: ScenarioState): CardInstance | undefined {
  const id = stageOf(game, 0);
  const stage = id ? game.cards[id] : undefined;
  return stage?.code === SECRETS_OF_RHUDAUR || stage?.code === THAURDIRS_PURSUIT ? stage : undefined;
}

export function rhudaurDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const stage = stageNow(game);
  if (!stage) return [];
  const dials: TableDial[] = [];
  // The main quest card cannot be the current quest in the quest phase (10094:B:3): with no side quest chosen the table says there is no current quest.
  if (stage.code === SECRETS_OF_RHUDAUR && game.phase === "Quest" && flagged(game, stage.id, "cannotBeCurrentQuest") && currentQuestId(game) == null) {
    dials.push({ id: "current", testID: "angmar-current", label: "Quest", name: NO_CURRENT_NAME, value: 0, word: NO_CURRENT_WORD, note: noCurrentWords(nameOf(stage.code)) });
  }
  // Stage 2B: the Clues attached to characters, each 5 quest points off the stage, a goal the players move toward (more Clues, fewer points to find).
  if (stage.code === THAURDIRS_PURSUIT) {
    const claimed = claimedClues(game).length;
    const points = questPointsOf(game, stage, ctx.cards) ?? 0;
    dials.push({ id: "clues", testID: "angmar-clues", label: "Clues", name: `Clue objectives attached to characters, ${nameOf(stage.code)} needs ${points} progress:`, value: claimed, limit: CLUES_TOTAL, goal: true, limitWords: cluesLimitWords, note: cluesWords(claimed, points) });
  }
  // Each Forbidden Descent in the staging area: the progress it took this round against the 2 it takes, one dial for each copy.
  const copies = sponges(game);
  copies.forEach((card, index) => {
    const taken = spongeTaken(game, card);
    dials.push({
      id: `sponge:${card.id}`,
      testID: `angmar-sponge:${card.id}`,
      label: copies.length > 1 ? `Descent · ${index + 1}` : "Descent",
      name: `Progress ${nameOf(card.code)}${copies.length > 1 ? ` (${index + 1})` : ""} took this round:`,
      value: taken,
      limit: SPONGE_LIMIT,
      ...(taken >= SPONGE_LIMIT ? { warn: { level: "near" as const, words: spongeNearWords(copies.length) } } : {}),
      limitWords: spongeLimitWords,
      note: spongeWords(taken, card.progress, ctx.cards.get(card.code)?.questPoints ?? 0),
    });
  });
  return dials;
}
