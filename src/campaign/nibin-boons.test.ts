// Rules: rr.action, rr.campaign-pool, rr.removed-from-game, rr.campaign-cards, rr.drawing-cards (data/rules/entries.json). "No Time to Waste!" (41048) and Ranger Sense (41049), the two
// boon events of The Caves of Nibin-Dûm (ledger data/printed/mirkwood-paths.json): "choose one" of two Actions, one that removes the card from the game and from the Campaign Pool.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/constants.ts";
import { legalIntents } from "../rules/legal.ts";
import { seatThreat } from "../rules/families/play/hooks.ts";
import type { ScenarioState } from "../rules/state.ts";
import { causeProblems } from "../../scripts/cause-check.ts";
import { codesIn, loadCavesWorld, cavesTable, settleChoices, type CavesLayout, type CavesWorld } from "../../scripts/nibin-dum-scene.ts";
import { first, send, start, type Run } from "../../scripts/past-scene.ts";

let world: CavesWorld;

beforeAll(async () => {
  world = await loadCavesWorld();
});

function make(layout: CavesLayout = {}) {
  const made = cavesTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

type Table = ReturnType<typeof make>;

// The card in the first seat's hand is played (its cost is 0) and the Action named is chosen: "When playing this card, choose one".
function play(made: Table, code: string, effectId: string, pick: (state: ScenarioState) => string = (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")): Run {
  const card = first(made.state, code);
  let run: Run = send(start(made.state), { type: "PlayCard", cardId: card, payments: [] }, made.ctx);
  if (run.state.window?.kind === "choose") expect(run.state.window.options).toContain(effectId);
  run = send(run, { type: "Choose", optionId: effectId }, made.ctx);
  return settleChoices(run, made.ctx, pick);
}

const canPlay = (made: Table, state: ScenarioState, code: string) => legalIntents(state, made.ctx).some((intent) => intent.type === "PlayCard" && state.cards[intent.cardId]?.code === code);

describe("\"No Time to Waste!\" (41048:A:2, 41048:A:3)", () => {
  it("removes itself from the game and the Campaign Pool, lowers each player's threat by 3 and reveals the top encounter card (41048:A:2)", () => {
    const made = make({ seats: 2, hand: ["41048"], deck: ["f0", "f3"], threat: [30, 25] });
    const run = play(made, "41048", "41048:action:1");
    expect(seatThreat(run.state, 0)).toBe(27);
    expect(seatThreat(run.state, 1)).toBe(22);
    expect(codesIn(run.state, "staging")).toContain("f0");
    // One card for each seat's copy, and each seat's copy is its own.
    const card = Object.values(run.state.cards).filter((entry) => entry.code === "41048");
    expect(card.map((entry) => entry.zone)).toEqual(["removed", "hand"]);
    expect(run.state.removedFromPool).toEqual([{ code: "41048", seat: 0 }]);
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("is a Quest Action: not offered in another phase (41048:A:2, 41048:A:3)", () => {
    const made = make({ hand: ["41048"], phase: "Planning" });
    expect(canPlay(made, made.state, "41048")).toBe(false);
    const quest = make({ hand: ["41048"], phase: "Quest" });
    expect(canPlay(quest, quest.state, "41048")).toBe(true);
  });

  it("draws 1 card and stays in the Campaign Pool (41048:A:3)", () => {
    const made = make({ hand: ["41048"], deckOf: ["ally", "filler"] });
    const run = play(made, "41048", "41048:action:2");
    expect(run.state.seats[0].hand.map((id) => run.state.cards[id]?.code)).toEqual(["ally"]);
    expect(run.state.cards[first(run.state, "41048")]?.zone).toBe("discard");
    expect(run.state.removedFromPool).toBeUndefined();
  });
});

describe("Ranger Sense (41049:A:2, 41049:A:3)", () => {
  it("removes itself from the game and the Campaign Pool to look at the top 4 cards of the deck, add 1 to the hand and put the rest back (41049:A:2)", () => {
    const made = make({ hand: ["41049"], deckOf: ["filler", "ally", "blade", "costly", "filler", "filler"] });
    // The look window closes with a pass; the card to take is chosen; the rest go back in the order the player chooses (the first order offered).
    const card = first(made.state, "41049");
    let run: Run = send(start(made.state), { type: "PlayCard", cardId: card, payments: [] }, made.ctx);
    run = send(run, { type: "Choose", optionId: "41049:action:1" }, made.ctx);
    for (let guard = 0; guard < 12 && run.state.window != null && run.state.window.kind !== "pass"; guard += 1) {
      const window = run.state.window;
      if (window.kind === "look") run = send(run, { type: "Pass" }, made.ctx);
      else if (window.kind === "choose") run = send(run, { type: "Choose", optionId: window.options.find((id) => run.state.cards[id]?.code === "blade") ?? window.options[0] ?? "" }, made.ctx);
      else break;
    }
    expect(run.state.seats[0].hand.map((id) => run.state.cards[id]?.code)).toEqual(["blade"]);
    expect(run.state.seats[0].deck).toHaveLength(5);
    expect(run.state.cards[first(run.state, "41049")]?.zone).toBe("removed");
    expect(run.state.removedFromPool).toEqual([{ code: "41049", seat: 0 }]);
  });

  it("draws 1 card as the other Action, any phase (41049:A:3)", () => {
    const made = make({ hand: ["41049"], deckOf: ["ally"], phase: "Planning" });
    const run = play(made, "41049", "41049:action:2");
    expect(run.state.seats[0].hand.map((id) => run.state.cards[id]?.code)).toEqual(["ally"]);
    expect(run.state.removedFromPool).toBeUndefined();
  });
});
