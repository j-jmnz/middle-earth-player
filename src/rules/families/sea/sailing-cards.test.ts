import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../core/printed.ts";
import { legalTargets } from "../../engine/reduce.ts";
import type { ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { hero, seaTable, send, ship, type Table } from "./table.ts";
import { syncConstants } from "../../interpret/constants.ts";

// Rules: dcce.sailing-tests (data/rules/entries.json); ledger lines 11050:A:1, 11053:A:1. A card in play can add cards to the Sailing test's look ("look at 2 additional cards from the top
// of the encounter deck during each Sailing test", the table's `sailingLook`) and cancel Sailing success symbols found ("cancel the first Sailing success symbol", `sailingCancel`).
const treachery = (code: string, success: number) => definePrinted({ code, name: code, type: "treachery", keywords: success > 0 ? { sailingSuccess: success } : {} });
const table$ = (code: string, stat: "sailingLook" | "sailingCancel", amount: number): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat, amount, until: "whileSourceInPlay", target: "table" }] });
const sailsAny: Effect = { id: "dc:constant:1", cardCode: "dc", lines: ["dc:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "sailsAnyTest", amount: 1, until: "whileSourceInPlay" }] };

// A game on a Sailing quest, in the quest phase's commit step, with a known encounter deck and the cards in `extras` in the staging area.
function sailing(extras: readonly string[]): Table {
  const built = seaTable({
    cards: [hero("aragorn"), ship("dc", "Dream-chaser"), definePrinted({ code: "qsail", name: "qsail", type: "quest", keywords: { sailing: true } }), treachery("s0", 0), treachery("s1", 1), treachery("s2", 2), definePrinted({ code: "calm", name: "calm", type: "location", threat: 0, questPoints: 3 }), definePrinted({ code: "rough", name: "rough", type: "location", threat: 0, questPoints: 3 })],
    effects: [sailsAny, table$("calm", "sailingLook", 2), table$("rough", "sailingCancel", 1)],
    heroes: [{ code: "aragorn" }],
    allies: [{ code: "dc" }],
    staging: extras.map((code) => ({ code })),
    encounter: ["s1", "s0", "s2", "s0", "s1", "s0"],
  });
  let state = spawn(built.state, "qsail", { zone: "questStage" }, "B").state;
  state = { ...state, sea: { heading: "Sun", headingCard: null, routes: state.sea?.routes ?? {} }, phase: "Planning", mode: "planning", boundaryPhase: "Planning", window: { kind: "pass" }, planningSeat: 0, passed: [], round: 1 };
  while (state.mode === "planning") state = send(state, { type: "Pass" }, built.ctx);
  return { ...built, state: syncConstants(state, built.ctx) };
}

const looked = (state: ScenarioState): number => (state.sea?.sailing?.step === "shift" || state.sea?.sailing?.step === "look" ? state.sea.sailing.looked.length : 0);

describe("a card that adds to the Sailing test's look (11050:A:1)", () => {
  it("looks at 2 additional cards, whether or not a character commits", () => {
    const plain = sailing([]);
    const calm = sailing(["calm"]);
    // Aragorn and the Dream-chaser commit: 2 cards. With the calm location, 4.
    const commit = (built: Table) => send(built.state, { type: "Commit", cardIds: legalTargets(built.state, { type: "Commit" }, built.ctx) }, built.ctx);
    expect(looked(commit(plain))).toBe(2);
    expect(looked(commit(calm))).toBe(4);
    // A Pass commits no one, yet the additional cards are still looked at.
    expect(looked(send(plain.state, { type: "Pass" }, plain.ctx))).toBe(0);
    expect(looked(send(calm.state, { type: "Pass" }, calm.ctx))).toBe(2);
  });
});

describe("a card that cancels a Sailing success symbol (11053:A:1)", () => {
  it("cancels one symbol found: the test asks one fewer shift, and none when the only symbol is canceled", () => {
    // The first two cards of the deck (s1, s0) show 1 symbol.
    const plain = sailing([]);
    const rough = sailing(["rough"]);
    const commit = (built: Table) => send(built.state, { type: "Commit", cardIds: legalTargets(built.state, { type: "Commit" }, built.ctx) }, built.ctx);
    const left = (state: ScenarioState): number => (state.sea?.sailing?.step === "shift" ? state.sea.sailing.left : 0);
    expect(left(commit(plain))).toBe(1);
    expect(left(commit(rough))).toBe(0);
    // No symbol left to answer: the test waits for the first player's Done over the cards looked at.
    expect(commit(rough).sea?.sailing?.step).toBe("look");
  });
});
