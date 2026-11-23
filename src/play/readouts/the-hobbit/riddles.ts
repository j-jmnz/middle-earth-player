// Rules: hob.riddle-area, hob.riddles (data/rules/entries.json); docs/scenarios/the-hobbit.md (Dungeons Deep and Caverns Dim); ledger lines 131029:A:1, 131030:A:1, 131030:B:2, 131030:B:3, 131031:B:1.
//
// The riddle area of Dungeons Deep and Caverns Dim on the table (docs/scenarios/the-hobbit.md, Dungeons Deep and Caverns Dim): stage 2, Riddles in the Dark, lies in a zone of its own with Gollum, and Bilbo Baggins stays among his seat's heroes with the Ring on him.
// The stage is a top-bar dial: its progress against the 9 that completes it (the players' way out, so the ring never warms), and a tap shows the stage and Gollum. The seat that controls Bilbo wears a mark while he is in the area. The engine decided each number; nothing here changes one.
// Empty in any other scenario and once stage 3 has taken stage 2 out of the area.
import type { ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { areaGollum, areaStage, bilbo } from "../../../rules/families/riddles/area.ts";
import { questPointsOf } from "../../../rules/quest/quest.ts";

import type { TableDial } from "../dials.ts";
import type { HandMark } from "../isengard.ts";

const SCENARIO = "dungeons-deep-and-caverns-dim";

/** The dial of stage 2 while it lies in the riddle area: none in any other scenario or once it has left. */
export function riddleDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const stage = game.scenarioId === SCENARIO ? areaStage(game) : undefined;
  if (!stage) return [];
  const points = questPointsOf(game, stage, ctx.cards);
  const gollum = areaGollum(game);
  const name = nameOf(stage.code);
  const left = points == null ? null : Math.max(0, points - stage.progress);
  const said = left === 0 ? `${name} is complete.` : `${left} more progress completes ${name}.`;
  return [
    {
      id: "riddle-stage",
      testID: "riddle-stage",
      label: "Riddles",
      name: `Progress on ${name}, in the riddle area`,
      value: stage.progress,
      ...(points != null ? { limit: points, goal: true as const } : {}),
      cardId: stage.id,
      ...(gollum ? { extra: [gollum.id] } : {}),
      note: `${said} Only answering a riddle adds progress to it. Gollum and Bilbo Baggins are in the riddle area with it.`,
    },
  ];
}

/** The mark of the seat that controls Bilbo Baggins while he is in the riddle area ("Bilbo in the riddle area", "P1 · Bilbo in the riddle area" two-handed). Empty in any other scenario and once stage 2 has left. */
export function riddleHands(game: ScenarioState): readonly HandMark[] {
  const hero = game.scenarioId === SCENARIO && areaStage(game) ? bilbo(game) : undefined;
  if (!hero || hero.controller == null) return [];
  return [{ seat: hero.controller, label: game.seatCount > 1 ? `P${hero.controller + 1} · Bilbo in the riddle area` : "Bilbo in the riddle area", note: "Bilbo Baggins is in the riddle area with Bilbo's Magic Ring. He cannot quest, attack or defend, except against Gollum, and takes damage only from Gollum." }];
}
