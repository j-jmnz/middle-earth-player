import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../rules/core/test-fixture.ts";
import { reduce, startScenario, type EngineStep, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../rules/engine/reduce.ts";
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { RING_BEARER, starterStart, starterWorld, STARTER_SEEDS } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";

import { isOver, showedHidden } from "../../rules/engine/undo.ts";

import { createTableStore, keepIntent, type Kept } from "./store.ts";
import { nextUndoable } from "./undo-history.ts";

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
  it("not one that drew, revealed or turned a card; a commit, a play or one that ended the game can be", () => {
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
        expect(nextUndoable([], after, { before, roundSteps: [], intent, steps }).length).toBe(shows && !isOver(after) ? 0 : 1);
      }
    }
    expect(hidden).toBeGreaterThan(10);
    expect(clean.has("Commit")).toBe(true);
    expect(clean.has("PlayCard")).toBe(true);
  });
});

describe("the move that ends the game", () => {
  it("can be taken back even when it showed a hidden card; the moves before a reveal still cannot", () => {
    const [{ before, intent, steps }] = playGame(1).slice(-1);
    const entry = { before, roundSteps: [], intent, steps };
    const earlier = { before, roundSteps: [], intent, steps };
    const reveal = { ...before, seedCursor: before.seedCursor + 1 };
    expect(showedHidden(before, reveal)).toBe(true);
    // A reveal that loses the game (a shadow card turned up by a defender): that one move stays, and nothing before it.
    expect(nextUndoable([earlier], { ...reveal, lost: true }, entry)).toEqual([entry]);
    expect(nextUndoable([earlier], { ...reveal, stageCleared: true }, entry)).toEqual([entry]);
    // A reveal that leaves the game on drops the list, as before; a move that shows nothing keeps what came before it.
    expect(nextUndoable([earlier], reveal, entry)).toEqual([]);
    expect(nextUndoable([earlier], { ...before, lost: true }, entry)).toEqual([earlier, entry]);
  });
});

describe("what counts as showing a hidden card", () => {
  it("a window that names cards in a deck (a Pick among the top cards, a search), a random result, a new card", () => {
    const [{ before }] = playGame(1).slice(-1);
    const deckCard = before.seats[0]?.deck[1];
    if (!deckCard) throw new Error("The deck is empty");
    expect(showedHidden(before, { ...before })).toBe(false);
    expect(showedHidden(before, { ...before, window: { kind: "choose", seat: 0, options: [deckCard] } })).toBe(true);
    expect(showedHidden(before, { ...before, window: { kind: "look", seat: 0, cardIds: [deckCard] } })).toBe(true);
    // A choice among options that are not cards shows nothing.
    expect(showedHidden(before, { ...before, window: { kind: "choose", seat: 0, options: ["141017:A:1:a"] } })).toBe(false);
    expect(showedHidden(before, { ...before, seedCursor: before.seedCursor + 1 })).toBe(true);
    const first = Object.values(before.cards)[0];
    if (!first) throw new Error("No card");
    expect(showedHidden(before, { ...before, cards: { ...before.cards, spawned: { ...first, id: "spawned" } } })).toBe(true);
  });
});

describe("a Lost Island's facedown side", () => {
  it("is hidden while the card lies on its Lost Island side: turning it over or looking at it cannot be taken back, a card already face up can be", () => {
    const [{ before }] = playGame(1).slice(-1);
    const first = Object.values(before.cards).find((card) => card.zone === "play" || card.zone === "heroes");
    if (!first) throw new Error("No card");
    const island = { ...first, id: "island", zone: "staging" as const, face: "B" as const };
    const withIsland = { ...before, uncharted: { deck: [], codes: [first.code] }, cards: { ...before.cards, island } };
    const flipped = { ...withIsland, cards: { ...withIsland.cards, island: { ...island, face: "A" as const } } };
    expect(showedHidden(withIsland, flipped)).toBe(true);
    // The same card face up (explored, seen) moving about shows nothing new.
    const shown = { ...withIsland, cards: { ...withIsland.cards, island: { ...island, face: "A" as const } } };
    expect(showedHidden(shown, { ...shown, cards: { ...shown.cards, island: { ...shown.cards.island!, zone: "victory" as const } } })).toBe(false);
    // A look at the other side opens a window that names the card with side A.
    expect(showedHidden(withIsland, { ...withIsland, window: { kind: "look", seat: 0, cardIds: ["island"], side: "A" } })).toBe(true);
    // The card seen only on its Lost Island side is not new either way.
    expect(showedHidden(withIsland, { ...withIsland })).toBe(false);
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
    expect(store.getState().moment).toMatchObject({ kind: "undone", intent: step.intent, left: step.after });
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

describe("a table that opens on an Undo a result screen made", () => {
  it("holds the undone moment as the last moment and the one to tell, and goes on from its number", () => {
    const [{ before, after, intent, steps }] = playGame(1).slice(0, 1);
    const landing = { seq: 7, kind: "undone" as const, intent, left: after, after: before, steps };
    const store = createTableStore({ ctx, game: before, landing });
    expect(store.getState().moment).toBe(landing);
    expect(store.getState().shown).toBe(landing);
    expect(createTableStore({ ctx, game: before }).getState().moment).toBeNull();
    expect(store.getState().dispatch(intent)).toBe(true);
    expect(store.getState().moment?.seq).toBe(8);
  });
});

describe("reopening a save", () => {
  it("keeps the same round log and Undo list as the table that sent the intents", () => {
    const played = playGame(2);
    const upTo = played.slice(0, 120);
    const start = upTo[0]?.before;
    if (!start) throw new Error("No game");
    const store = createTableStore({ ctx, game: start });
    for (const { intent } of upTo) expect(store.getState().dispatch(intent)).toBe(true);
    let kept: Kept = { roundSteps: [], history: [] };
    for (const { before, after, steps, intent } of upTo) kept = keepIntent(kept, before, after, steps, intent, ctx);
    expect(kept.roundSteps).toEqual(store.getState().roundSteps);
    expect(kept.history.map((entry) => entry.intent)).toEqual(store.getState().history.map((entry) => entry.intent));
    expect(kept.history.length).toBe(store.getState().history.length);
  });
});
