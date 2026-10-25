import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { reduce, startScenario, type EngineStep, type PlayerIntent, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { nextIntent } from "../../scripts/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld, STARTER_SEEDS } from "../../scripts/starter-game.ts";

import { createTableStore } from "./store.ts";
import { isOver, nextUndoable, showedHidden } from "./undo-history.ts";

// Rules: brief, Rules engine, Undo. An intent can be taken back while it showed no hidden card, and taking it back gives
// the state before it exactly: the save that drops it replays to the same state.
let ctx: ReduceContext;

const POLICY = { scout: "141004", prefer: "141035", protect: RING_BEARER, play: true, act: true };

beforeAll(async () => {
  ctx = (await starterWorld("stealth-and-steadfastness")).ctx;
});

type Played = { before: ScenarioState; after: ScenarioState; intent: PlayerIntent; steps: readonly EngineStep[] };

// Every accepted intent of a whole starter game.
function playGame(seed: number): Played[] {
  const played: Played[] = [];
  let state = startScenario(starterStart("stealth-and-steadfastness", seed), ctx);
  for (let turn = 0; turn < 600 && !isOver(state); turn += 1) {
    const intent = nextIntent(state, ctx, POLICY);
    const result = expectOk(reduce(state, intent, ctx));
    played.push({ before: state, after: result.state, intent, steps: result.steps });
    state = result.state;
  }
  return played;
}

describe("which intents can be taken back", () => {
  it("not one that drew, revealed or turned a card, nor one that ended the game; a commit or a play can be", () => {
    const clean = new Set<string>();
    let hidden = 0;
    for (const seed of STARTER_SEEDS.slice(0, 3)) {
      for (const { before, after, intent, steps } of playGame(seed)) {
        const shows = showedHidden(before, after);
        if (steps.some((step) => step.kind === "draw" || step.kind === "reveal")) {
          expect(shows, `${intent.type} drew or revealed a card`).toBe(true);
        }
        if (shows) hidden += 1;
        else if (!isOver(after)) clean.add(intent.type);
        expect(nextUndoable([], before, after, [], steps).length).toBe(shows || isOver(after) ? 0 : 1);
      }
    }
    expect(hidden).toBeGreaterThan(10);
    expect(clean.has("Commit")).toBe(true);
    expect(clean.has("PlayCard")).toBe(true);
  });
});

describe("Undo on the table", () => {
  it("goes back to the state before the intent and its round's log, tells the save, and stops at a revealed card", () => {
    const played = playGame(1);
    const at = played.findIndex(({ before, after }) => !showedHidden(before, after) && !isOver(after));
    const step = played[at];
    if (!step) throw new Error("No intent that can be taken back");
    const undone: ScenarioState[] = [];
    const store = createTableStore({ ctx, game: step.before, roundSteps: [], onUndo: (game) => undone.push(game) });
    expect(store.getState().undo()).toBe(false);

    expect(store.getState().dispatch(step.intent)).toBe(true);
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().undo()).toBe(true);
    expect(store.getState().game).toBe(step.before);
    expect(store.getState().roundSteps).toEqual([]);
    expect(store.getState().history).toHaveLength(0);
    expect(store.getState().moment?.undone).toBe(true);
    expect(undone).toEqual([step.before]);

    // Sending it again gives the same state: the seed cursor went back with it.
    expect(store.getState().dispatch(step.intent)).toBe(true);
    expect(store.getState().game).toEqual(step.after);

    // An intent that shows a hidden card leaves nothing to take back.
    const later = played.findIndex(({ before, after }, index) => index > at && showedHidden(before, after));
    for (const { intent } of played.slice(at + 1, later + 1)) expect(store.getState().dispatch(intent)).toBe(true);
    expect(store.getState().game).toEqual(played[later]?.after);
    expect(store.getState().history).toHaveLength(0);
    expect(store.getState().undo()).toBe(false);
  });
});
