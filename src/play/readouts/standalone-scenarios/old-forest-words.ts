// Rules: rr.quest-advancement, rr.victory (data/rules/entries.json); ledger lines 147002:B:2, 147003:B:2, 147004:B:2, 147005:B:2 (docs/scenarios/standalone-scenarios/the-old-forest.md, The Old Forest).
// What the table says of The Old Forest's stage 2 test: "advance to stage 3A if there are X or more total victory points on locations in the victory display, otherwise to a different random stage 2A; X is the number of players times 5". The numbers are the
// engine's (the points of the cards in the victory display, the players in the game, the `times` in the stage's own record); the words only read them. Told on a stage that holds such a record, never by a code or a title. Pure.
import type { ScenarioState } from "../../../rules/core/state.ts";
import { livingSeats } from "../../../rules/core/state.ts";
import { victoryPoints } from "../../../rules/families/smaug/cards.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

/** The Victory points in the victory display against the number the stage asks for. */
export type ForestScore = { points: number; need: number };

// The stage's Forced effect that hears `questProgressPlaced` and tests the victory display against a number of points per player: that number, or null for a stage with none.
function perPlayer(ctx: ReduceContext, stageCode: string): number | null {
  for (const effect of effectsOf(ctx, stageCode)) {
    if (effect.trigger !== "questProgressPlaced") continue;
    for (const step of effect.instructions) {
      const when = "when" in step ? step.when : undefined;
      if (when?.kind !== "less" || typeof when.left !== "object" || when.left.victoryDisplay !== true || typeof when.right !== "object") continue;
      if (when.right.players === true && when.right.times != null) return when.right.times;
    }
  }
  return null;
}

/** The score of the quest stage in play when it is a stage 2 of The Old Forest (its record tests the victory display), else null. */
export function forestScore(game: ScenarioState, ctx: ReduceContext): ForestScore | null {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const times = stage ? perPlayer(ctx, stage.code) : null;
  return times == null ? null : { points: victoryPoints(game, ctx.cards), need: livingSeats(game).length * times };
}

/** The lines of a stage 2's preview where another stage says "No quest points". */
export const forestStageWords = ({ points, need }: ForestScore): string =>
  `${points} of ${need} Victory points in the victory display. When progress is placed on it from a successful quest, ${need} or more advance the quest to stage 3A; fewer go to a different stage 2A`;

export const forestLimitWords = (need: number): string => `${need} or more go to stage 3A`;

export const forestNoteWords = (score: ForestScore): string => `${forestStageWords(score)}.`;

export const forestNearWords = (left: number): string => `${left} more Victory ${left === 1 ? "point" : "points"} and the next progress sends the quest to stage 3A.`;

/** The beat under "The quest advances" when a stage 2 sent the quest on: which side of the test it fell on. `before` is the state the intent was sent in (the stage it left), `after` the state it made. */
export function forestAdvanceWords(ctx: ReduceContext, before: ScenarioState, after: ScenarioState, stageId: string): string | null {
  const score = forestScore(before, ctx);
  if (!score) return null;
  const next = after.cards[stageId];
  if (!next) return null;
  const onward = perPlayer(ctx, next.code) != null;
  const points = victoryPoints(after, ctx.cards);
  return onward
    ? `${points} of ${score.need} Victory points in the victory display: the quest goes to a different stage 2A`
    : `The ${score.need} Victory points in the victory display were reached: the quest goes to stage 3A`;
}
