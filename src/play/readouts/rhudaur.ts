// Rules: mec108.time-x, mec108.side-quests-in-play, mec108.the-investigation, rr.explored (data/rules/entries.json); ledger lines 10094:B:1, 10094:B:3, 10095:B:1, 10101:A:1, 10101:A:2.
//
// The pieces The Treachery of Rhudaur's cards hold on the table: the Clue objectives attached to characters against the 3 that exist (each takes 5 quest points off stage 2B, shown with the points left), each Forbidden Descent's progress sponge (the progress it took this round against the 2 it takes),
// and the word "None" while the main quest card cannot be the current quest and no side quest is the current quest. Secrets of Rhudaur's time counters are the Time dial of `readouts/angmar.ts`, worded for this card. The engine decided every number (`claimed`, `spongeTaken`, `currentQuestId`); nothing here changes one.
// Empty in any other scenario. Pure, so a test reads it.
import { heldAmount, inPlay, type CardInstance, type ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/engine/reduce.ts";
import { stageOf } from "../../rules/families/breaking/areas.ts";
import { SPONGE_ROUND } from "../../rules/families/angmar/sponge.ts";
import { MAIN_QUEST } from "../../rules/families/wilderland/night.ts";
import { currentQuestId, mainQuestBarred } from "../../rules/families/wilderland/night-quest.ts";
import { questPointsOf } from "../../rules/quest/quest.ts";

import { NO_CURRENT_NAME, NO_CURRENT_WORD, cluesLimitWords, cluesWords, noCurrentWords, spongeLimitWords, spongeNearWords, spongeWords } from "../words/scenarios/angmar/rhudaur-table.ts";
import type { TableDial } from "./dials.ts";

export const SECRETS_OF_RHUDAUR = "10094";
export const THAURDIRS_PURSUIT = "10095";
export const FORBIDDEN_DESCENT = "10101";
const HAUNTING_FOG = "10108";
/** The three Clue objectives: Daechanar's Brand, Heirloom of Iârchon and Orders from Angmar. */
export const CLUE_CODES: readonly string[] = ["10110", "10112", "10114"];
/** The Treachery of Rhudaur side quests, quest side up. */
export const SIDE_QUEST_CODES: readonly string[] = ["10109", "10111", "10113"];

/** The Clue objectives attached to a character now (a player's hero or Amarthiúl): the ones stage 2B counts (10095:B:1). One in the staging area is nobody's. */
export const claimedClues = (game: ScenarioState): CardInstance[] => Object.values(game.cards).filter((card) => CLUE_CODES.includes(card.code) && card.claimed === true && card.host != null && inPlay(card.zone));

/** The Treachery of Rhudaur side quests in play quest side up: the staged ones and the current one (10094:B:2, 10094:B:4). */
export const sideQuestsInPlay = (game: ScenarioState): number => Object.values(game.cards).filter((card) => SIDE_QUEST_CODES.includes(card.code) && inPlay(card.zone)).length;

/** The progress a Forbidden Descent took this round, never more than the 2 it takes. */
export const spongeTaken = (game: ScenarioState, card: CardInstance): number => Math.min(SPONGE_ROUND, heldAmount(game, card.id, "spongeTaken"));

/** The copies of Forbidden Descent in the staging area, in staging order: the order their sponges fill (`absorbProgress` walks `staging`). */
export const sponges = (game: ScenarioState): CardInstance[] => game.staging.map((id) => game.cards[id]).filter((card): card is CardInstance => card?.code === FORBIDDEN_DESCENT);

/** What Haunting Fog attached to Thaurdir's Pursuit adds to its quest points, read from the points as modified now (`points`) against the printed ones less 5 for each claimed Clue; 0 with no Fog attached. */
export function pursuitFog(game: ScenarioState, stage: CardInstance, points: number, printed: number, claimed: number): number {
  const fogged = Object.values(game.cards).some((card) => card.code === HAUNTING_FOG && card.host === stage.id && inPlay(card.zone));
  return fogged ? Math.max(0, points - (printed - 5 * claimed)) : 0;
}

/** The current stage and its card, when it is one of this scenario's. */
function stageNow(game: ScenarioState): CardInstance | undefined {
  const id = stageOf(game, 0);
  const stage = id ? game.cards[id] : undefined;
  return stage?.code === SECRETS_OF_RHUDAUR || stage?.code === THAURDIRS_PURSUIT ? stage : undefined;
}

/** The current-quest dial, drawn ahead of the Time dial so it stays in view: while the main quest card cannot be the current quest in the quest phase (10094:B:3) and no side quest is the current quest, the disc says "None". It waits out the first player's choice of a current quest, which is still open. */
export function rhudaurCurrentDials(game: ScenarioState, nameOf: (code: string) => string): readonly TableDial[] {
  const stage = stageNow(game);
  if (!stage || stage.code !== SECRETS_OF_RHUDAUR || !mainQuestBarred(game) || currentQuestId(game) != null) return [];
  if (game.window?.kind === "choose" && game.window.options.includes(MAIN_QUEST)) return [];
  return [{ id: "current", testID: "angmar-current", label: "Quest", name: NO_CURRENT_NAME, value: 0, word: NO_CURRENT_WORD, note: noCurrentWords(nameOf(stage.code)) }];
}

export function rhudaurDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const stage = stageNow(game);
  if (!stage) return [];
  const dials: TableDial[] = [];
  // Stage 2B: the Clues attached to characters, each 5 quest points off the stage, a goal the players move toward (more Clues, fewer points to find).
  if (stage.code === THAURDIRS_PURSUIT) {
    const claimed = claimedClues(game).length;
    const points = questPointsOf(game, stage, ctx.cards) ?? 0;
    dials.push({ id: "clues", testID: "angmar-clues", label: "Clues", name: "Clue objectives attached to characters:", value: claimed, limit: CLUE_CODES.length, goal: true, limitWords: cluesLimitWords(CLUE_CODES.length), note: cluesWords(claimed, points) });
  }
  // Each Forbidden Descent in the staging area: the progress it took this round against the 2 it takes, one dial for each copy, numbered in the order the sponges fill.
  const copies = sponges(game);
  copies.forEach((card, index) => {
    const taken = spongeTaken(game, card);
    const points = questPointsOf(game, card, ctx.cards) ?? 0;
    // The progress it can still take this round would explore it: each player raises their threat by 2 (10101:A:2). A full sponge is good news and warns of nothing.
    const room = SPONGE_ROUND - taken;
    const explores = room > 0 && card.progress + room >= points;
    dials.push({
      id: `sponge:${card.id}`,
      testID: `angmar-sponge:${card.id}`,
      label: copies.length > 1 ? `Descent · ${index + 1}` : "Descent",
      name: `Progress ${nameOf(card.code)}${copies.length > 1 ? ` (${index + 1})` : ""} took this round:`,
      value: taken,
      limit: SPONGE_ROUND,
      ...(explores ? { warn: { level: "near" as const, words: spongeNearWords(room) } } : {}),
      limitWords: spongeLimitWords,
      note: spongeWords(taken, card.progress, points),
    });
  });
  return dials;
}
