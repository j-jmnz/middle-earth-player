// Rules: rr.quest-advancement, ltp.quest-advancement, rr.quest-cards-quest-deck (data/rules/entries.json).
//
// The quest advance screen (user request, 2026-10-29; quest-advance-view.tsx): when an intent the player sent advanced the quest,
// the table shows the stage it reached large, on the B side it is played on, like the card preview but with no Details: a Progress
// button goes back to the table. While the new stage's own effect asks the player something as it is revealed (a When Revealed
// choice), the screen shows that choice in place of Progress and goes back to the table once it is answered. The engine has
// advanced already: the screen holds the moment so the stage is read before the round goes on, and the table answers nothing for
// the player meanwhile (use-table-choice.ts). The table also opens on it (user request, 2026-10-29): the stage in play when the game is
// loaded, so a new game shows its first quest card, usually the one whose Setup the game just ran, before the table. Pure, so a test reads it.
import { isSeparate, parkedStage, stageOf, stageSeat, viewOf } from "../../rules/families/breaking/areas.ts";
import { stagePlace } from "../../rules/families/quest/branch.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import type { CardFace } from "../../rules/core/state.ts";
import { isOver } from "../../rules/engine/undo.ts";
import { topFrame } from "../../rules/windows/windows.ts";

import { stageDetail } from "./fortress.ts";
import { advanceHold, questObjective, stagePoints } from "./objective.ts";
import { isTrapStage, trapAdvance } from "./standalone-scenarios/barrow-downs.ts";
import { questSeat } from "../store/selectors.ts";
import { STAGE_LOSS } from "../words/scenarios/stormcaller.ts";
import { stageAdvanceWords } from "./hobbit/roast-mutton.ts";
import type { TableMoment } from "../store/store.ts";

/**
 * The accepted intent (`seq`, its moment) that advanced the quest, and the stage it reached. The table's opening is seq 0. `also`: the other stages the same
 * intent reached, when stages are separate and it advanced more than one seat (stage 2B gives each seat its stage 3A).
 */
export type QuestAdvance = { seq: number; stageId: string; also?: readonly string[] };

// The seq of the table's opening: below every moment's (store.ts counts them from 1).
const OPENING_SEQ = 0;

/**
 * What the screen reads of the game: the stage in play, the stage whose own effect is asking the player something now (if any), and whether
 * the game is over. The hook reads each on its own, so a state that changes none of them does not render it (use-quest-advance.ts).
 */
// `callerStage`: the Stormcaller's current quest stage once it is at its last stage (the one advance of its that opens the screen: the C side of stage 4, dcce.stormcallers-area-stages), else null.
export type QuestView = { questStage: string | null; asking: string | null; over: boolean; seatStages?: string; callerStage?: string | null };

/** The stages the seats are on once stages are separate (Breaking of the Fellowship, 2B on), joined by "|" so a subscriber compares one string; "" before. */
export function stagesKey(game: ScenarioState): string {
  return isSeparate(game) ? game.seats.slice(0, game.seatCount).flatMap((seat) => (seat.stage ? [seat.stage] : [])).join("|") : "";
}

// Whether the card is a stage in play: the shared stage or one of the seats' own.
function isStage(view: Pick<QuestView, "questStage" | "seatStages" | "callerStage">, id: string): boolean {
  return view.questStage === id || (view.seatStages ?? "").split("|").includes(id) || (view.callerStage != null && view.callerStage === id);
}

/** The Stormcaller's current quest stage when it is its last: the advance to it is told on the screen; an advance to an earlier stage is a beat of the banner (outcome.ts). Null otherwise. */
export function callerLastStage(game: Pick<ScenarioState, "sea">): string | null {
  const area = game.sea?.stormcaller;
  return area && area.deck.length === 0 ? area.stage : null;
}

/** The stage whose own effect (its When Revealed) is resolving and waits on the player, or null. */
export function askingStage(game: ScenarioState): string | null {
  return game.window != null && ASKING.has(game.window.kind) ? (topFrame(game)?.cardId ?? null) : null;
}

/**
 * The stage the table opens on and an advance is told for: the shared stage; once the areas are isolated (Fog on the Barrow-downs, a player trapped) the acting seat's own stage, so a resumed game opens on it; none while a stage is parked (stage 3B with no player at it is no
 * one's stage) and while Breaking of the Fellowship's stages are separate (each seat's is in `seatStages`).
 */
export function questStageOf(game: ScenarioState): string | null {
  if (parkedStage(game) != null) return null;
  if (game.separate === true && game.isolated === true) return stageOf(game, questSeat(game) ?? 0);
  return game.questStage;
}

/** The view of a game. */
export function questView(game: ScenarioState): QuestView {
  return { questStage: questStageOf(game), asking: askingStage(game), over: isOver(game), seatStages: stagesKey(game), callerStage: callerLastStage(game) };
}

/**
 * The stage a sent intent advanced the quest to, while it is still the stage: the moment's last advance step, and any earlier one it also reached that is
 * still a stage (another seat's). Null for any other moment.
 */
export function advancedTo(moment: TableMoment | null, game: Pick<QuestView, "questStage" | "seatStages" | "callerStage">): QuestAdvance | null {
  if (moment?.kind !== "sent") return null;
  const advanced = moment.steps.flatMap((step) => (step.kind === "advance" ? [step] : []));
  const stages = [...new Set(advanced.filter((step) => step.stormcaller !== true).map((step) => step.cardId))].filter((id) => isStage(game, id));
  // The Stormcaller's advance to its last stage is the one the screen tells (a stage before it is a beat of the banner).
  const caller = advanced.find((step) => step.stormcaller === true && step.cardId === game.callerStage);
  const reached = caller ? caller.cardId : stages.at(-1);
  if (reached == null) return null;
  const also = stages.filter((id) => id !== reached);
  return also.length > 0 ? { seq: moment.seq, stageId: reached, also } : { seq: moment.seq, stageId: reached };
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
 * that holds it back, in the rule's own words. Once stages are separate it is read as the seat that holds the stage sees it, and in two-handed play the
 * overline names the seat ("Player 2 · Stage 3 of 4"). `also` (the other stages the same intent reached, with `nameOf` for their cards) is told in
 * a line each: "Player 1 advanced to Searching the Woods".
 */
export function advanceWords(
  game: ScenarioState,
  ctx: ReduceContext,
  stageId: string,
  name: string,
  line: (id: string) => string | null,
  also?: readonly string[],
  nameOf?: (code: string) => string,
): { eyebrow: string | null; title: string; detail: string | null; also: readonly string[] } {
  const area = game.sea?.stormcaller;
  // The Stormcaller's stage (dcce.stormcallers-area-stages): told by its place among the Stormcaller's stages, and, at the last, what filling it does.
  if (area && area.stage === stageId) {
    const last = area.number + area.deck.length;
    const loss = area.number >= last ? ` ${STAGE_LOSS}.` : "";
    return { eyebrow: `Stormcaller · Stage ${area.number} of ${last}`, title: name, detail: `The Stormcaller is at stage ${area.number} of ${last}.${loss}`, also: [] };
  }
  const seat = stageSeat(game, stageId);
  const view = viewOf(game, seat ?? undefined);
  const stage = view.cards[stageId];
  const place = stage ? stagePlace(view, stage.code) : null;
  const points = stage ? stagePoints(view, stage, ctx) : null;
  const hold = advanceHold(view, ctx, line);
  const objective = points == null ? questObjective(view, ctx, line) : null;
  const won = points != null ? `${points} quest point${points === 1 ? "" : "s"} to complete it` : objective ? `To win: ${objective}` : stage ? stageAdvanceWords(view, stage) : null;
  // A stage with Defense says where questing's progress goes, one whose filling loses the game says so (mec112.defense, 143075:B:3).
  const detail = (stage ? stageDetail(view, ctx, stage.code, points, hold, won) : [hold ?? won].filter((text) => text != null)).join(". ") || null;
  const who = seat != null && game.seatCount > 1 ? `Player ${seat + 1}` : null;
  const stageWords = place ? `Stage ${place.at} of ${place.of}` : null;
  // A stage 4A a Great Barrow trapped a player at (Fog on the Barrow-downs) is no step toward the last stage: the overline says trapped and the detail says who stays at stage 3B and when he comes back.
  const trap = trapAdvance(game, ctx, stageId);
  const eyebrow = trap ? trap.eyebrow : who && stageWords ? `${who} · ${stageWords}` : (who ?? stageWords);
  const others = (also ?? []).flatMap((id) => {
    const code = game.cards[id]?.code;
    const other = stageSeat(game, id);
    return code == null ? [] : [`${other != null && game.seatCount > 1 ? `Player ${other + 1}` : "Another seat"} advanced to ${(nameOf ?? ((value: string) => value))(code)}`];
  });
  return { eyebrow, title: name, detail: trap ? [trap.detail, detail].filter((text) => text != null).join(" ") : detail, also: others };
}

/**
 * The button that goes back to the table, by what the screen shows (user request, 2026-10-29: not Progress where nothing can
 * progress): the table's opening on a new game (round 1 or before, nothing played yet) begins it, the opening on a resumed game
 * (`resumed`: the save had intents, user request, 2026-11-01) and an advance to a stage that is held back continue it, and an
 * advance the stage can be played on is Progress.
 */
export function advanceButton(
  game: ScenarioState,
  ctx: ReduceContext,
  advance: QuestAdvance,
  line: (id: string) => string | null,
  resumed?: boolean,
): { label: string; hint: string } {
  if (isOpening(advance)) return game.round <= 1 && !resumed ? { label: "Begin", hint: "Begins the game at the table" } : { label: "Continue", hint: "Back to the table" };
  // The stage is read as the seat that holds it sees it, as its words are (advanceWords): a hold on another seat's stage does not hold this one. A stage a player is trapped at only goes back to the table.
  if (isTrapStage(game, advance.stageId) || advanceHold(viewOf(game, stageSeat(game, advance.stageId) ?? undefined), ctx, line)) return { label: "Continue", hint: "Back to the table" };
  return { label: "Progress", hint: "Back to the table" };
}

/**
 * Which advance the screen holds: `latched` is the last advance seen, `done` the seq of the last one the player went back to the table
 * from, and `asked` the seq of the one whose stage asked a question.
 */
export type AdvanceLatch = { latched: QuestAdvance | null; done: number; asked: number };

export const NO_ADVANCE: AdvanceLatch = { latched: null, done: 0, asked: 0 };

/** Whether the advance on screen is the table's opening, not an advance. */
function isOpening(advance: QuestAdvance): boolean {
  return advance.seq === OPENING_SEQ;
}

/** The latch the table opens with: the stage in play, unless the game is over or has no stage. */
export function openingLatch(game: QuestView): AdvanceLatch {
  if (game.questStage == null || game.over) return NO_ADVANCE;
  return { latched: { seq: OPENING_SEQ, stageId: game.questStage }, done: OPENING_SEQ - 1, asked: OPENING_SEQ - 1 };
}

/** The advance on screen: the latched one, until the player went back to the table from it or its stage is no longer the stage. */
export function openAdvance(latch: AdvanceLatch, game: Pick<QuestView, "questStage" | "seatStages" | "callerStage">): QuestAdvance | null {
  const { latched } = latch;
  return latched && latched.seq > latch.done && isStage(game, latched.stageId) ? latched : null;
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

/** The side of the stage the screen shows: the Stormcaller's stage advanced to its C side first (its When Revealed), which the screen tells; every other stage shows the side it is played on. */
export function advanceFace(game: Pick<ScenarioState, "sea">, card: { id: string; face: CardFace }): CardFace {
  return game.sea?.stormcaller?.stage === card.id ? "up" : card.face;
}
