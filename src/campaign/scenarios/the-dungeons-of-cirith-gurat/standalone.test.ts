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

describe("The Dungeons of Cirith Gurat in the haradrim cycle", () => {
  it("has no Nightmare deck to deal", () => {
    expect(gurat.nightmare).toBeUndefined();
  });

  it("17132:A:1 runs the same Setup on Easy as on Normal (the golden suite checks the Setup itself on Normal)", async () => {
    // What the Setup placed that does not depend on which cards the smaller Easy deck holds: the scenario's own cards and the owner of each held character.
    const placed = (state: Opened) => [...Object.values(state.cards).filter((card) => ["17119", "17120", "16061"].includes(card.code) || (card.code === "17125" && card.zone === "staging")).map((card) => `${card.code} ${card.zone}`), ...Object.values(state.cards).filter((card) => card.captive && card.code !== "17120").map((card) => `held by seat ${card.owner}`)].sort();
    for (const seatCount of [1, 2] as const) {
      const easy = placed(await opened(seatCount, "Easy"));
      expect(easy.length, `Easy ${seatCount}`).toBeGreaterThan(0);
      expect(easy, `Easy ${seatCount}`).toEqual(placed(await opened(seatCount, "Normal")));
    }
  });

  it("deals fewer encounter cards on Easy than on Normal (the scenario's pile quantities)", async () => {
    const count = (state: Opened) => Object.values(state.cards).filter((card) => card.zone === "encounterDeck").length;
    expect(count(await opened(2, "Easy"))).toBeLessThan(count(await opened(2, "Normal")));
  });
});
