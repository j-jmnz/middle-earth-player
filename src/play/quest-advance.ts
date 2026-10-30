// Rules: rr.quest-advancement, ltp.quest-advancement, rr.quest-cards-quest-deck (data/rules/entries.json).
//
// The quest advance screen (user request, 2026-10-29; quest-advance-view.tsx): when an intent the player sent advanced the quest,
// the table shows the stage it reached large, on the B side it is played on, like the card preview but with no Details: a Progress
// button goes back to the table. While the new stage's own effect asks the player something as it is revealed (a When Revealed
// choice), the screen shows that choice in place of Progress and goes back to the table once it is answered. The engine has
// advanced already: the screen holds the moment so the stage is read before the round goes on, and the table answers nothing for
// the player meanwhile (use-table-choice.ts). The table also opens on it (user request, 2026-10-29): the stage in play when the game is
// loaded, so a new game shows its first quest card, usually the one whose Setup the game just ran, before the table. Pure, so a test reads it.
import { stagePlace } from "../rules/families/quest-branch.ts";
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";
import { isOver } from "../rules/undo.ts";
import { topFrame } from "../rules/windows.ts";

import { advanceHold, questObjective, stagePoints } from "./objective.ts";
import type { TableMoment } from "./store.ts";

/** The accepted intent (`seq`, its moment) that advanced the quest, and the stage it reached. The table's opening is seq 0. */
export type QuestAdvance = { seq: number; stageId: string };

// The seq of the table's opening: below every moment's (store.ts counts them from 1).
const OPENING_SEQ = 0;

/**
 * What the screen reads of the game: the stage in play, the stage whose own effect is asking the player something now (if any), and whether
 * the game is over. The hook reads each on its own, so a state that changes none of them does not render it (use-quest-advance.ts).
 */
export type QuestView = { questStage: string | null; asking: string | null; over: boolean };

/** The stage whose own effect (its When Revealed) is resolving and waits on the player, or null. */
export function askingStage(game: ScenarioState): string | null {
  return game.window != null && ASKING.has(game.window.kind) ? (topFrame(game)?.cardId ?? null) : null;
}

/** The view of a game. */
export function questView(game: ScenarioState): QuestView {
  return { questStage: game.questStage, asking: askingStage(game), over: isOver(game) };
}

/** The stage a sent intent advanced the quest to, while it is still the stage: the moment's last advance step. Null for any other moment. */
export function advancedTo(moment: TableMoment | null, game: Pick<QuestView, "questStage">): QuestAdvance | null {
  if (moment?.kind !== "sent") return null;
  const reached = moment.steps.flatMap((step) => (step.kind === "advance" ? [step.cardId] : [])).at(-1);
  return reached != null && game.questStage === reached ? { seq: moment.seq, stageId: reached } : null;
}

// The windows in which an effect asks its question. The action windows and the Responses to the reveal are the table's.
const ASKING = new Set(["choose", "look", "frameAction", "chooseEnemy"]);

/** Whether the open moment is the stage asking: its own effect (its When Revealed) is resolving and waits on the player. */
export function stageAsks(game: ScenarioState, stageId: string): boolean {
  return askingStage(game) === stageId;
}

/**
 * What the screen says over the stage, in one stack: the overline "Stage 2 of 3" (none while the stage has no place), the stage's
 * name ("A Fork in the Road"), and under it how the stage is won (its quest points, or the printed line that wins it), or the rule
 * that holds it back, in the rule's own words.
 */
export function advanceWords(
  game: ScenarioState,
  ctx: ReduceContext,
  stageId: string,
  name: string,
  line: (id: string) => string | null,
): { eyebrow: string | null; title: string; detail: string | null } {
  const stage = game.cards[stageId];
  const place = stage ? stagePlace(game, stage.code) : null;
  const points = stage ? stagePoints(game, stage, ctx) : null;
  const hold = advanceHold(game, ctx, line);
  const objective = points == null ? questObjective(game, ctx, line) : null;
  const won = points != null ? `${points} quest point${points === 1 ? "" : "s"} to complete it` : objective ? `To win: ${objective}` : null;
  const detail = hold ?? won;
  return { eyebrow: place ? `Stage ${place.at} of ${place.of}` : null, title: name, detail };
}

/**
 * The button that goes back to the table, by what the screen shows (user request, 2026-10-29: not Progress where nothing can
 * progress): the table's opening on a new game (round 1 or before) begins it, the opening on a resumed game and an advance to a
 * stage that is held back continue it, and an advance the stage can be played on is Progress.
 */
export function advanceButton(game: ScenarioState, ctx: ReduceContext, advance: QuestAdvance, line: (id: string) => string | null): { label: string; hint: string } {
  if (isOpening(advance)) return game.round <= 1 ? { label: "Begin", hint: "Begins the game at the table" } : { label: "Continue", hint: "Back to the table" };
  if (advanceHold(game, ctx, line)) return { label: "Continue", hint: "Back to the table" };
  return { label: "Progress", hint: "Back to the table" };
}

/**
 * Which advance the screen holds: `latched` is the last advance seen, `done` the seq of the last one the player went back to the table
 * from, and `asked` the seq of the one whose stage asked a question.
 */
export type AdvanceLatch = { latched: QuestAdvance | null; done: number; asked: number };

export const NO_ADVANCE: AdvanceLatch = { latched: null, done: 0, asked: 0 };

/** Whether the advance on screen is the table's opening, not an advance. */
export function isOpening(advance: QuestAdvance): boolean {
  return advance.seq === OPENING_SEQ;
}

/** The latch the table opens with: the stage in play, unless the game is over or has no stage. */
export function openingLatch(game: QuestView): AdvanceLatch {
  if (game.questStage == null || game.over) return NO_ADVANCE;
  return { latched: { seq: OPENING_SEQ, stageId: game.questStage }, done: OPENING_SEQ - 1, asked: OPENING_SEQ - 1 };
}

/** The advance on screen: the latched one, until the player went back to the table from it or its stage is no longer the stage. */
export function openAdvance(latch: AdvanceLatch, game: Pick<QuestView, "questStage">): QuestAdvance | null {
  const { latched } = latch;
  return latched && latched.seq > latch.done && game.questStage === latched.stageId ? latched : null;
}

/**
 * The latch after the table shows `game`, `reached` being what the moment on it advanced to (advancedTo): a newer advance replaces the
 * one on screen, and once the stage's question that the screen showed is answered, the screen goes back to the table. The same latch
 * when nothing changes.
 */
export function nextLatch(latch: AdvanceLatch, reached: QuestAdvance | null, game: QuestView): AdvanceLatch {
  let next = latch;
  if (reached && reached.seq !== latch.latched?.seq && reached.seq > latch.done) next = { ...next, latched: reached };
  const open = openAdvance(next, game);
  if (!open) return next;
  const asks = game.asking === open.stageId;
  if (asks && next.asked !== open.seq) return { ...next, asked: open.seq };
  if (!asks && next.asked === open.seq) return { ...next, done: open.seq };
  return next;
}

/** The latch once the player taps Progress: back to the table. */
export function closeLatch(latch: AdvanceLatch): AdvanceLatch {
  return { ...latch, done: Math.max(latch.done, latch.latched?.seq ?? OPENING_SEQ) };
}
