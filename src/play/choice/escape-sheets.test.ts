// Rules: sotm.escape-test, sotm.escape-test-example (data/rules/entries.json). The words of an escape test's commit sheet and its action window (docs/design-system-table.md, Choice tray): the player asked leads two-handed, the cards dealt, the stat counted,
// the most that may commit and, for a party test, that every player commits; the action window gives the stat committed so far and what the table adds to each card, and its armed Pass says the test fails while nobody is committed.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../rules/core/intents.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { reduce } from "../../rules/engine/reduce.ts";
import { revealFromTop, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { momentOf } from "../store/outcome.ts";
import { logLines, type LogNames } from "../store/log.ts";
import { readoutFor } from "../readouts/readout.ts";
import type { Sheet, SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";

function sheetOf(layout: Layout, code: string, commit?: readonly string[]): Sheet | null {
  const made = tableFromLayout("the-dead-marshes", layout);
  let state = revealFromTop(made.state, made.ctx, code, [] as EngineStep[]).state;
  if (commit) {
    const done = reduce(state, { type: "CommitEscape", cardIds: commit.map((c) => Object.values(state.cards).find((card) => card.code === c)?.id ?? "") }, made.ctx);
    if (!done.ok) throw new Error("refused");
    state = done.state;
  }
  const names: SheetNames = { card: (id) => made.ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
  return sheetFor(state, made.ctx, legalIntents(state, made.ctx), names);
}

describe("the escape test's sheets", () => {
  it("the commit sheet says who commits, the stat, the cards dealt and a tie failing, solo", () => {
    const sheet = sheetOf({ stage: "02105", staging: [{ code: "02107" }], deck: ["f0", "f0", "f0"] }, "02109");
    expect(sheet?.note).toBe("Exhaust ready characters to commit them to the escape test. 2 encounter cards are dealt next, and your committed Willpower must be higher than their Escape.");
    expect(sheet?.title).toBe("Nightfall: Escape test");
  });

  it("the commit sheet leads with the player asked two-handed, and counts Attack for Through the Mist", () => {
    const sheet = sheetOf({ stage: "02105", seats: 2, staging: [{ code: "02107" }], deck: ["f0", "f0", "f0"] }, "02110");
    expect(sheet?.note).toBe("Player 1: exhaust ready characters to commit them to the escape test. 2 encounter cards are dealt next, and your committed Attack must be higher than their Escape.");
  });

  it("the action window gives the stat committed so far, and the armed Pass says the test fails while nobody is committed", () => {
    const sheet = sheetOf({ stage: "02105", staging: [{ code: "02107" }], deck: ["f0", "f0", "f0"] }, "02109", []);
    expect(sheet?.note).toContain("Willpower 0 committed. 2 encounter cards are dealt after the actions");
    expect(JSON.stringify(sheet)).toContain("Tap again: no one is committed, so the escape test fails");
  });
});

// The table a test is open on: Nightfall (Willpower) or Through the Mist (Attack), two-handed when asked, a party test when `party`.
function openTest(layout: Layout, code: string, party = false) {
  const made = tableFromLayout("the-dead-marshes", layout);
  const revealed = revealFromTop(made.state, made.ctx, code, [] as EngineStep[]).state;
  const state = party ? { ...revealed, stack: revealed.stack.map((item) => (item.data.kind === "escape" ? { ...item, data: { ...item.data, seats: [0, 1] } } : item)) } : revealed;
  const names: SheetNames = { card: (id) => made.ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
  return { state, ctx: made.ctx, names, sheet: sheetFor(state, made.ctx, legalIntents(state, made.ctx), names) };
}

const NIGHTFALL = { stage: "02105", seats: 2, staging: [{ code: "02107" }], deck: ["f0", "f0", "f0"] } as const;

describe("the escape test's party words and numbers", () => {
  it("a party test's commit sheet says the players' committed stat, a single player's says yours", () => {
    expect(openTest(NIGHTFALL, "02109", true).sheet?.note).toContain("and the players' committed Willpower must be higher than their Escape");
    expect(openTest(NIGHTFALL, "02109").sheet?.note).toContain("and your committed Willpower must be higher than their Escape");
  });

  it("the commit sheet's readout counts the stat already committed with the rows picked, in the stat's icon", () => {
    const { state, ctx, sheet } = openTest(NIGHTFALL, "02110");
    const readout = readoutFor(state, ctx, sheet, { key: "escape", ids: sheet?.kind === "multi" ? sheet.options.slice(0, 2).map((option) => option.id) : [], shares: [] }, (id) => id);
    expect(readout?.kind).toBe("escape");
    expect(readout?.stats[0]).toMatchObject({ icon: "attack", word: "Attack" });
    expect(readout?.result).toBe("2 encounter cards are dealt next");
    const none = readoutFor(state, ctx, sheet, null, (id) => id);
    expect(none?.stats[0]?.value).toBe(0);
  });

  it("the action window's note leads with no seat for a party test, and names the player for a single one", () => {
    const party = openTest(NIGHTFALL, "02109", true);
    let state = party.state;
    for (let guard = 0; guard < 4 && state.window?.kind === "escapeCommit"; guard += 1) {
      const done = reduce(state, { type: "CommitEscape", cardIds: [] }, party.ctx);
      if (!done.ok) throw new Error("refused");
      state = done.state;
    }
    const window = sheetFor(state, party.ctx, legalIntents(state, party.ctx), party.names);
    expect(window?.note).toMatch(/^Escape test: Willpower 0 committed/);
    const single = sheetOf(NIGHTFALL, "02109", []);
    expect(single?.note).toMatch(/^Player 1, Escape test: Willpower 0 committed/);
  });
});

describe("a finished escape test", () => {
  const step = (over: Partial<Extract<EngineStep, { kind: "escapeTest" }>>): EngineStep => ({ kind: "escapeTest", seat: 0, dealtIds: [], committed: 5, escape: 4, success: true, ...over });
  const { state } = openTest(NIGHTFALL, "02109");
  const names = { card: (id: string) => id };

  it("the banner carries the stat and, two-handed, the player who tested", () => {
    const moment = momentOf(state, state, [step({ stat: "attack", seat: 1, success: false })], names);
    expect(moment?.title).toBe("Player 2's escape test failed");
    expect(moment?.lines[0]).toMatchObject({ text: "Attack 5 against 4 Escape", mark: "attack" });
    expect(momentOf(state, state, [step({ seat: null })], names)?.title).toBe("Escape test passed");
    expect(momentOf(state, state, [step({})], names)?.lines[0]).toMatchObject({ text: "Willpower 5 against 4 Escape", mark: "willpower" });
  });

  it("the log line names the stat, the player and the mark", () => {
    const logNames = { card: (id: string) => id, code: (code: string) => code, effectCard: () => null, rule: () => null, line: () => null } satisfies LogNames;
    const [line] = logLines([step({ stat: "defense", seat: 1, success: false })], logNames);
    expect(line).toMatchObject({ text: "Player 2's escape test failed: Defense 5 against 4 Escape", mark: "defense" });
  });
});
