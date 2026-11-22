// Rules: rr.quest-advancement, rr.forced, rr.objective-cards (data/rules/entries.json).
// The Forced effect stages 2 Retrieve Urdug's Horn and Find Durin's Key share, read on a table built from a layout (tableFromLayout, the stand-in heroes dh1 and dh2 with 2 Willpower each)
// and run again without the records of its line (lineSpec), where it must fail: the quest is played to the stage's defeat with the stage's own condition met (19049:B:3, 19050:B:3).
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { finish, idOf, legalIntents, send, start, tableFromLayout, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";

const ID = "roam-across-rhovanion";
const STAGE_TWOS = ["19048", "19049", "19050"];
const STAGE_3 = "19051";
const URDUG = "19052";
const HORN = "19037";
const KEY = "19036";

// The stage in play one progress short of its 5 quest points, the first player controlling Urdug and the objective its line asks for (the Horn on Urdug, the Key on dh1). `waiting`: the stage 2 cards still in the
// quest deck; every other stage 2 card has been played and removed from the game.
function nearlyDone(stage: string, waiting: readonly string[], effects: readonly Effect[], seed = 3): { made: LayoutTable; state: ScenarioState } {
  const made = tableFromLayout(ID, { seed, stage, progress: 4, play: [URDUG], deck: ["f0", "f3", "place"] }, { effects });
  let state = made.state;
  for (const code of STAGE_TWOS.filter((other) => other !== stage)) state = moveCard(state, idOf(state, code), { zone: waiting.includes(code) ? "questDeck" : "removed" });
  const objective = spawn(state, stage === "19049" ? HORN : KEY, { zone: "attached" });
  const host = stage === "19049" ? idOf(state, URDUG) : made.hero;
  state = updateCard(attachTo(objective.state, objective.id, host), objective.id, { claimed: true, controller: 0, face: "up" });
  return { made, state: syncConstants(state, made.ctx) };
}

// Both heroes quest (4 Willpower against no Threat), and every window is passed until the quest phase is over.
function quested(made: LayoutTable, state: ScenarioState): ScenarioState {
  let run: Run = send(start(state), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
  for (let guard = 0; guard < 20 && run.state.phase === "Quest" && !run.state.lost; guard += 1) {
    if (run.state.window?.kind === "choose" || run.state.window?.kind === "look") run = finish(run, made.ctx);
    else {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
      if (!pass || run.state.mode === "travel") break;
      run = send(run, pass as PlayerIntent, made.ctx);
    }
  }
  return run.state;
}

const stageOf = (state: ScenarioState): string | undefined => state.cards[state.questStage ?? ""]?.code;
const zoneOf = (state: ScenarioState, code: string): string | undefined => state.cards[idOf(state, code)]?.zone;

// "Forced: When the players defeat this stage, remove it from the game. Advance to a random stage 2A, if able. Otherwise, advance to stage 3A."
describe.each([
  ["19049:B:2", "19049", "Retrieve Urdug's Horn"],
  ["19050:B:2", "19050", "Find Durin's Key"],
] as const)("%s %s", (line, stage, name) => {
  const other = STAGE_TWOS.find((code) => code !== stage && code !== "19048") ?? "";
  lineSpec(line, `${name} defeated is removed from the game, and the quest advances to a stage 2 still in the quest deck, at random`, (effects) => {
    const reached = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { made, state } = nearlyDone(stage, ["19048", other], effects, seed);
      const after = quested(made, state);
      expect(zoneOf(after, stage), `seed ${seed}`).toBe("removed");
      reached.add(stageOf(after) ?? "");
    }
    expect([...reached].sort()).toEqual(["19048", other].sort());
  });

  lineSpec(line, `${name} defeated with no stage 2 left in the quest deck: it is removed and the quest advances to stage 3A`, (effects) => {
    const { made, state } = nearlyDone(stage, [], effects);
    const after = quested(made, state);
    expect(zoneOf(after, stage)).toBe("removed");
    expect(stageOf(after)).toBe(STAGE_3);
  });
});
