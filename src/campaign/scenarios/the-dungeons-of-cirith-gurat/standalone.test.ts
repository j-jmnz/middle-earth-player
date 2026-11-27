// Rules: rr.setup, hrd.setup-the-dungeons-of-cirith-gurat, hrd.captives-of-cirith-gurat (data/rules/entries.json).
// What is The Dungeons of Cirith Gurat's own in the standalone game: no Nightmare deck (the cycle's Nightmare decks are not dealt), and the same Setup on Easy and Normal (the Captives and one Dungeon Cell staged, Abaan held by Dungeon Cell,
// one Orc enemy for each player staged, the Uruk Chieftain set aside, each player's first ally held by an enemy). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned,
// the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { guratStart, guratWorld } from "../../../../test/scenarios/the-dungeons-of-cirith-gurat/game.ts";

const gurat = loadAnyScenario("the-dungeons-of-cirith-gurat");

async function opened(seatCount: 1 | 2, difficulty: "Easy" | "Normal") {
  const { ctx } = await guratWorld();
  // Each seat keeps its opening hand, then the Setup runs.
  let state = startScenario(guratStart(seatCount, 1, difficulty), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  // The Setup's picks (the Orc enemy each player finds, the enemy that holds each ally) take their first option.
  for (let guard = 0; guard < 20 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
type Opened = Awaited<ReturnType<typeof opened>>;
const cardsOf = (state: Opened, code: string) => Object.values(state.cards).filter((card) => card.code === code);

describe("The Dungeons of Cirith Gurat in the haradrim cycle", () => {
  it("has no Nightmare deck to deal", () => {
    expect(gurat.nightmare).toBeUndefined();
  });

  it("17132:A:1 runs the same Setup on Easy and Normal: Dungeon Cell holds Abaan, an Orc enemy for each player is staged, the Chieftain is set aside and each player's ally is held", async () => {
    for (const difficulty of ["Easy", "Normal"] as const) {
      for (const seatCount of [1, 2] as const) {
        const state = await opened(seatCount, difficulty);
        const label = `${difficulty} ${seatCount}`;
        expect(cardsOf(state, "17119").map((card) => card.zone), label).toEqual(["staging"]);
        expect(cardsOf(state, "17125").filter((card) => card.zone === "staging"), label).toHaveLength(1);
        expect(cardsOf(state, "17120").map((card) => card.zone), label).toEqual(["captive"]);
        expect(cardsOf(state, "16061").map((card) => card.zone), label).toEqual(["setAside"]);
        const held = Object.values(state.cards).filter((card) => card.captive && card.code !== "17120");
        expect(held.map((card) => card.owner).sort(), label).toEqual(Array.from({ length: seatCount }, (_, seat) => seat));
      }
    }
  });

  it("17121 deals fewer copies of an encounter card on Easy than on Normal (the scenario's pile quantities)", async () => {
    const count = (state: Opened) => Object.values(state.cards).filter((card) => card.zone === "encounterDeck").length;
    expect(count(await opened(2, "Easy"))).toBeLessThan(count(await opened(2, "Normal")));
  });
});
