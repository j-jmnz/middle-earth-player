// Rules: mec108.create-staging-area, mec109.multiple-staging-areas, rr.quest-advancement, rr.victory (data/rules/entries.json); ledger lines 148003:B:1, 148003:B:3, 148004:B:2, 148007:A:2 (docs/brief.md, Fog on the Barrow-downs, The table).
//
// The pieces Fog on the Barrow-downs' separate staging areas hold on the table. Stage 3B stays in play while no player is at it (every player trapped at a stage 4A of his own, or the one at it eliminated): it is in no seat's row, so it is a top-bar dial that names the stage and the
// cards of its staging area, and a tap shows the stage large with its cards listed (barrowDetail). A player at his own stage 4A wears a mark on his threat dial ("P2 · Apart"). The quest readout does not promise what stage 3B withholds: no progress on it while a Great Barrow is in play,
// and no defeat until every player is at it and Standing Stones is in the victory display. The engine decided everything (the parked stage, the areas, the restrictions); nothing here changes it. Empty in any other scenario. Pure, so a test reads it.
import type { EngineStep } from "../../../rules/core/intents.ts";
import { flagged, livingSeats, type ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { headOf, parkedStage, sharedStaging, stageOf, viewOf } from "../../../rules/families/breaking/areas.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { questSeat } from "../../store/selectors.ts";

import { apartLabel, apartStageWords, apartWords, holdWords, noStageProgressWords, PARKED_CARD_WORDS, PARKED_LABEL, PARKED_NAME, parkedWords } from "./barrow-downs-words.ts";
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
  return [{ id: "parked", testID: "downs-parked", label: PARKED_LABEL, name: PARKED_NAME, value: cards.length, cardId: id, note: parkedWords(nameOf(stage.code), cards.map((card) => nameOf(game.cards[card]?.code ?? "")), noProgress) }];
}

/** The mark of each player apart at a stage 4A of his own ("Apart", "P2 · Apart" two-handed). Empty with every player at one stage and in any other scenario. */
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
  if (parked === cardId) return parkedWords(name(cardId), parkedCards(game).map(name), flagged(game, parked, "noProgressPlaced"));
  if (parkedCards(game).includes(cardId)) return PARKED_CARD_WORDS;
  const card = game.cards[cardId];
  if (card?.code !== STAGE_4 || game.separate !== true) return null;
  const seat = livingSeats(game).find((index) => stageOf(game, index) === cardId);
  return seat == null ? null : apartStageWords(game.seatCount > 1 ? `Player ${seat + 1}` : "You");
}

