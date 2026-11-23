// Rules: docs/scenarios/standalone-scenarios/the-battle-of-lake-town.md (The Battle of Lake-town, Fisherman's Dock), rr.active-location, rr.step-3-4; ledger line 50223:A:2.
// With two active locations, one of them Fisherman's Dock, the progress from questing is split as the first player chooses; a split that fills both is not asked, and two active locations without the Dock fill in order (The Ring Goes South).
import { describe, expect, it } from "vitest";

import { settle } from "../../engine/machine.ts";
import { send } from "../defense/table.ts";
import { moveCard } from "../../core/zones.ts";
import { placeQuestProgress } from "../../quest/quest.ts";
import type { ScenarioState } from "../../core/state.ts";
import { DOCK, lakeTable, run } from "./fixture.ts";
import { splitShares } from "./split.ts";

function twoActive(withDock: boolean) {
  const made = lakeTable({ staging: [{ code: "plain", key: "a" }, { code: withDock ? DOCK : "plain", key: "dock" }] });
  const a = made.ids.a ?? "";
  const dock = made.ids.dock ?? "";
  const base = { ...moveCard(moveCard(made.state, a, { zone: "activeLocation" }), dock, { zone: "secondActiveLocation" }), activeLocation: a, secondActiveLocation: dock };
  return { made, state: base as ScenarioState, a, dock };
}

describe("the shares of a split", () => {
  it("run from what the second location cannot take to what the first can", () => {
    expect(splitShares(3, [3, 2])).toEqual([1, 2, 3]);
    expect(splitShares(2, [3, 2])).toEqual([0, 1, 2]);
  });
});

describe("progress on two active locations with Fisherman's Dock (50223:A:2)", () => {
  it("is not placed: the question opens as a choice of the first player with the amount", () => {
    const { made, state, a, dock } = twoActive(true);
    const questing = placeQuestProgress(state, 3, made.ctx.cards, [], () => true, true);
    expect(questing.cards[a]?.progress).toBe(0);
    expect(questing.cards[dock]?.progress).toBe(0);
    const asked = settle({ ...questing, window: null }, made.ctx, []);
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0, options: ["split:1", "split:2", "split:3"] });
  });

  it("asks the first player how much goes on the first location and puts the rest on the Dock", () => {
    const { made, state, a, dock } = twoActive(true);
    const asked = run(made, state, { verb: "SplitProgress", amount: 3 });
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0, options: ["split:1", "split:2", "split:3"] });
    const chosen = send(asked, { type: "Choose", optionId: "split:1" }, made.ctx);
    expect(chosen.cards[a]?.progress).toBe(1);
    expect(chosen.cards[dock]?.progress).toBe(2);
  });

  it("is placed in order, without asking, when it fills both locations or no Dock is there", () => {
    const withDock = twoActive(true);
    const full = placeQuestProgress(withDock.state, 5, withDock.made.ctx.cards, [], () => true, true);
    expect(settle({ ...full, window: null }, withDock.made.ctx, []).window?.kind).not.toBe("choose");
    const plain = twoActive(false);
    const placed = placeQuestProgress(plain.state, 3, plain.made.ctx.cards, [], () => true, true);
    expect(placed.cards[plain.a]?.progress).toBe(3);
  });
});
