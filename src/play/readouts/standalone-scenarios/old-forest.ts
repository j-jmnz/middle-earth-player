// Rules: rr.quest-advancement, rr.victory (data/rules/entries.json); ledger lines 147002:B:2, 147003:B:2, 147004:B:2, 147005:B:2, 147006:B:1, 147011:A:2 (docs/scenarios/standalone-scenarios.md, The Old Forest, The table).
//
// The piece The Old Forest's stage 2 holds on the table, as a top-bar dial: the Victory points of the locations in the victory display against the players times 5 that send the quest on to stage 3A (a goal dial: more is the way on). It warms when one location (3 points at most) is
// short, and a tap on it opens the victory display's list. On stage 3B the quest readout says Withywindle holds the win when the progress would fill the stage. The engine decided every number (the points, the players, the records' own X); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import type { EngineStep } from "../../../rules/core/intents.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { placeQuestProgress } from "../../../rules/quest/quest.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";

import { forestLimitWords, forestNearWords, forestNoteWords, forestScore } from "./old-forest-words.ts";
import type { TableDial } from "../dials.ts";
import { stagePoints } from "../objective.ts";

const SCENARIO = "the-old-forest";
/** The most Victory points one location of the scenario prints: within this many the dial warms. */
const ONE_LOCATION = 3;

/** The dial a stage 2 holds now: none on any other stage and in any other scenario. */
export function forestDials(game: ScenarioState, ctx: ReduceContext): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const score = forestScore(game, ctx);
  if (!score) return [];
  const left = score.need - score.points;
  return [
    {
      id: "victory",
      testID: "forest-victory",
      label: "Victory",
      name: "Victory points in the victory display",
      value: score.points,
      limit: score.need,
      goal: true,
      pile: "victory",
      ...(left > 0 && left <= ONE_LOCATION ? { warn: { level: "near" as const, words: forestNearWords(left) } } : {}),
      limitWords: forestLimitWords(score.need),
      note: forestNoteWords(score),
    },
  ];
}

/** What the quest readout adds on stage 3B when `progress` would fill the stage but a card holds the advance (Withywindle, 147011:A:2): "; Withywindle holds the win". Null otherwise and in any other scenario. */
export function forestHoldWords(game: ScenarioState, ctx: ReduceContext, progress: number): string | null {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (game.scenarioId !== SCENARIO || progress <= 0 || !stage) return null;
  const points = stagePoints(game, stage, ctx);
  const holder = restricted(game, ctx, "advance")[0];
  const name = holder ? ctx.cards.get(game.cards[holder.sourceId]?.code ?? "")?.name : undefined;
  if (points == null || name == null) return null;
  const steps: EngineStep[] = [];
  placeQuestProgress(game, progress, ctx.cards, steps, () => false, true);
  const onStage = steps.reduce((sum, step) => sum + (step.kind === "progress" && step.targetId === stage.id ? step.amount : 0), 0);
  return stage.progress + onStage >= points ? `${name} holds the win` : null;
}
