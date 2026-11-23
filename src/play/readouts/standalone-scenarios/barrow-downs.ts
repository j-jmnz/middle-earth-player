// Rules: mec108.create-staging-area, mec109.multiple-staging-areas, rr.quest-advancement, rr.victory (data/rules/entries.json); ledger lines 148003:B:1, 148003:B:3, 148004:B:2, 148007:A:2 (docs/scenarios/standalone-scenarios/fog-on-the-barrow-downs.md, Fog on the Barrow-downs, The table).
//
// The pieces Fog on the Barrow-downs' separate staging areas hold on the table. Stage 3B stays in play while no player is at it (every player trapped at a stage 4A of his own, or the one at it eliminated): it is in no seat's row, so it is a top-bar dial that names the stage and the
// cards of its staging area, and a tap shows the stage large with its staging cards listed after it (the dial's `extra`; barrowDetail says the same in words). A player trapped at his own stage 4A wears a mark on his threat dial ("P2 · Trapped"). The quest readout does not promise what stage 3B withholds: no progress on it while a Great Barrow is in play,
// and no defeat until every player is at it and Standing Stones is in the victory display. The engine decided everything (the parked stage, the areas, the restrictions); nothing here changes it. Empty in any other scenario. Pure, so a test reads it.
import type { EngineStep } from "../../../rules/core/intents.ts";
import { flagged, livingSeats, type ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { headOf, parkedStage, sharedStaging, sharing, stageOf, stageSeat, viewOf } from "../../../rules/families/breaking/areas.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { questSeat } from "../../store/selectors.ts";

import { apartLabel, apartStageWords, apartWords, backWords, holdWords, NO_PROGRESS_LINE, noStageProgressWords, PARKED_LABEL, PARKED_NAME, parkedCardWords, parkedWords, raiseWords, trapEyebrow, trappedLine, trapWords } from "./barrow-downs-words.ts";
import type { TableDial } from "../dials.ts";
import type { HandMark } from "../isengard.ts";
import { stagePoints } from "../objective.ts";

const SCENARIO = "fog-on-the-barrow-downs";
const STAGE_3 = "148003";
const STAGE_4 = "148004";
const STANDING_STONES = "148006";

/** The cards of the parked stage's staging area (the staging cards in no player's area while stage 3B is parked); none in any other scenario or while a player is at it. */
export function parkedCards(game: ScenarioState): readonly string[] {
  return game.scenarioId === SCENARIO && parkedStage(game) != null ? sharedStaging(game) : [];
}

/** The dial of the parked stage 3B: the number of cards in its staging area, its note naming the stage and the cards, and a tap showing the stage. None while a player is at stage 3B and in any other scenario. */
export function downsDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const id = game.scenarioId === SCENARIO ? parkedStage(game) : null;
  const stage = id ? game.cards[id] : undefined;
  if (!id || !stage) return [];
  const cards = parkedCards(game);
  const noProgress = flagged(game, id, "noProgressPlaced");
  return [{ id: "parked", testID: "downs-parked", label: PARKED_LABEL, name: PARKED_NAME, value: cards.length, cardId: id, extra: cards, note: parkedWords(nameOf(stage.code), cards.map((card) => nameOf(game.cards[card]?.code ?? "")), noProgress, game.seatCount === 1) }];
}

/** The mark of each player trapped at a stage 4A of his own ("Trapped", "P2 · Trapped" two-handed). Empty with every player at one stage and in any other scenario. */
export function downsHands(game: ScenarioState, ctx: ReduceContext): readonly HandMark[] {
  if (game.scenarioId !== SCENARIO || game.separate !== true) return [];
  return [...livingSeats(game)].sort((left, right) => left - right).flatMap((seat) => {
    const stage = stageOf(game, seat);
    const card = stage ? game.cards[stage] : undefined;
    if (card?.code !== STAGE_4) return [];
    const name = ctx.cards.get(card.code)?.name ?? card.code;
    return [{ seat, label: apartLabel(game.seatCount > 1 ? seat : null), note: apartWords(game.seatCount > 1 ? `Player ${seat + 1}` : "You", name) }];
  });
}

// What `progress` would do on the stage the seat the quest readout reads is at, on a copy as the engine places it: null unless it is stage 3B.
function stageThree(game: ScenarioState, ctx: ReduceContext, progress: number) {
  if (game.scenarioId !== SCENARIO || progress <= 0) return null;
  const view = viewOf(game, questSeat(game));
  const stage = view.questStage ? view.cards[view.questStage] : undefined;
  if (stage?.code !== STAGE_3) return null;
  const steps: EngineStep[] = [];
  placeQuestProgress(view, progress, ctx.cards, steps, () => false, true);
  let onStage = 0;
  let onLocation = 0;
  for (const step of steps) {
    if (step.kind !== "progress") continue;
    if (step.targetId === stage.id) onStage += step.amount;
    else onLocation += step.amount;
  }
  return { view, stage, onStage, onLocation };
}

/** What the quest readout says of `progress` on stage 3B while a Great Barrow is in play (148003:B:1): none goes on the stage and the active location takes what it can, as the engine places it. Null otherwise and in any other scenario. */
export function downsQuestWords(game: ScenarioState, ctx: ReduceContext, progress: number): string | null {
  const found = stageThree(game, ctx, progress);
  return found && flagged(found.view, found.stage.id, "noProgressPlaced") ? noStageProgressWords(found.onLocation) : null;
}

/** What the quest readout adds when `progress` would fill stage 3B but it cannot be defeated yet (148003:B:3): every player must be at it and Standing Stones must be in the victory display. Null when it can be, or the progress would not fill it. */
export function downsHoldWords(game: ScenarioState, ctx: ReduceContext, progress: number): string | null {
  const found = stageThree(game, ctx, progress);
  if (!found || restricted(found.view, ctx, "advance").length === 0) return null;
  const points = stagePoints(found.view, found.stage, ctx);
  if (points == null || found.stage.progress + found.onStage < points) return null;
  const apart = livingSeats(game).some((seat) => headOf(game, seat) !== headOf(game, questSeat(game) ?? 0));
  const stones = !game.victory.some((id) => game.cards[id]?.code === STANDING_STONES);
  return apart || stones ? holdWords(apart, stones) : null;
}

/** The line a card says about itself in its preview: the parked stage and what it holds, a card of its staging area, a stage 4A a player is apart at. Null for any other card and in any other scenario. */
export function barrowDetail(game: ScenarioState, ctx: ReduceContext, cardId: string, name: (id: string) => string): string | null {
  if (game.scenarioId !== SCENARIO) return null;
  const parked = parkedStage(game);
  if (parked === cardId) return parkedWords(name(cardId), parkedCards(game).map(name), flagged(game, parked, "noProgressPlaced"), game.seatCount === 1);
  if (parkedCards(game).includes(cardId)) return parkedCardWords(game.seatCount === 1);
  const card = game.cards[cardId];
  // Stage 3B with a player at it and a Great Barrow in play (148003:B:1): the line says what its card says, that no progress goes on it.
  if (card?.code === STAGE_3 && flagged(game, cardId, "noProgressPlaced")) return NO_PROGRESS_LINE;
  if (card?.code !== STAGE_4 || game.separate !== true) return null;
  const seat = livingSeats(game).find((index) => stageOf(game, index) === cardId);
  return seat == null ? null : apartStageWords(game.seatCount > 1 ? `Player ${seat + 1}` : "You");
}


// The stage 4A card that traps a seat: its seat and the game, or null for any other card, outside Fog and with no area apart.
function trappedAt(game: ScenarioState, stageId: string): number | null {
  if (game.scenarioId !== SCENARIO || game.separate !== true || game.cards[stageId]?.code !== STAGE_4) return null;
  return stageSeat(game, stageId);
}

/** Whether the stage is a stage 4A a Great Barrow trapped a player at: the advance screen tells it as a trap, not as the last stage. */
export function isTrapStage(game: ScenarioState, stageId: string): boolean {
  return trappedAt(game, stageId) != null;
}

/**
 * What the quest advance screen says over a stage 4A a Great Barrow trapped a player at (148007:A:2): the overline "Trapped" ("Player 2 · Trapped"), and who stays at stage 3B and when he comes back (148004:B:2). Null for any other stage and outside Fog.
 */
export function trapAdvance(game: ScenarioState, ctx: ReduceContext, stageId: string): { eyebrow: string; detail: string } | null {
  const seat = trappedAt(game, stageId);
  if (seat == null) return null;
  const two = game.seatCount > 1;
  const holder = livingSeats(game).find((index) => index !== seat && game.cards[stageOf(game, index) ?? ""]?.code === STAGE_3);
  const stage = ctx.cards.get(STAGE_3)?.name ?? STAGE_3;
  return { eyebrow: trapEyebrow(two ? seat : null), detail: trapWords(two ? `Player ${seat + 1}` : "You", holder != null ? `Player ${holder + 1}` : null, stage) };
}

/** The banner's line when a Great Barrow trapped a player: the stage he reached, in the words the table uses for it. Null when the stage is not a trap. */
export function trapLine(game: ScenarioState, stageId: string, name: (id: string) => string): string | null {
  const seat = trappedAt(game, stageId);
  return seat == null ? null : trappedLine(game.seatCount > 1 ? `Player ${seat + 1}` : "You", name(stageId));
}

/** The banner's beats when a player came back from stage 4B to stage 3B (148004:B:2): none in any other scenario or when no seat changed stage that way. `name` names a card on the table. */
export function returnLines(before: ScenarioState, after: ScenarioState, name: (id: string) => string): readonly string[] {
  if (after.scenarioId !== SCENARIO || before.separate !== true) return [];
  const lines: string[] = [];
  for (let seat = 0; seat < after.seatCount; seat += 1) {
    const was = before.cards[stageOf(before, seat) ?? ""];
    const now = stageOf(after, seat);
    if (was?.code !== STAGE_4 || after.cards[now ?? ""]?.code !== STAGE_3 || !now) continue;
    lines.push(backWords(after.seatCount > 1 ? `Player ${seat + 1}` : "You", name(now)));
  }
  return lines;
}

/**
 * What stage 3B's Forced effect does when the quest eliminates a player (148003:B:2): each player at stage 3B raises his threat by 10. `after` is the game with that player eliminated. The raise as the engine reads it (raiseAtStage): every living
 * player when the players still share one stage, the players that share stage 3B's area while they are apart, none while it is parked. `ends`: the raise brings every player left to the elimination `level`. Null outside Fog, with no stage 3B in play or nobody raised.
 */
export function downsRaise(game: ScenarioState, ctx: ReduceContext, after: ScenarioState, level: number): { text: string; ends: boolean } | null {
  if (game.scenarioId !== SCENARIO) return null;
  const stage = Object.values(after.cards).find((card) => card.code === STAGE_3 && card.zone === "questStage");
  if (!stage) return null;
  const at = after.separate === true ? stageSeat(after, stage.id) : null;
  const seats = after.separate === true ? (at == null ? [] : sharing(after, at)) : livingSeats(after);
  if (seats.length === 0) return null;
  const name = ctx.cards.get(STAGE_3)?.name ?? STAGE_3;
  const raised = seats.map((seat) => ({ seat, to: (after.seats[seat]?.threat ?? 0) + 10 }));
  const text = raised.map((item) => raiseWords(after.seatCount > 1 ? `Player ${item.seat + 1}` : "Threat", name, item.to)).join("; ");
  const left = livingSeats(after).filter((seat) => !raised.some((item) => item.seat === seat && item.to >= level));
  return { text, ends: left.length === 0 };
}

/** What a threat step names as its source when stage 3B raised it (148003:B:2): "Lost in the Fog, stage 3B". Null for any other cause and outside Fog. `line` is the cause's printed line. */
export function raiseSource(game: ScenarioState, line: string, name: (id: string) => string): string | null {
  if (game.scenarioId !== SCENARIO || !line.startsWith(`${STAGE_3}:B:2`)) return null;
  const stage = Object.values(game.cards).find((card) => card.code === STAGE_3);
  return stage ? `${name(stage.id)}, stage 3B` : "stage 3B";
}
