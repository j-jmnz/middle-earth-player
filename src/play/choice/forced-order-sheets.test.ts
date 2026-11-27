// Rules: rr.forced, rr.first-player, faq.simultaneous-effects (data/rules/entries.json); ledger lines 16068:B:1, 16023:A:2. The first player's order window of Desert Crossing (Seek Shade and the stage's +4 at temperature 36): its title,
// the question first, one row for each card with its Forced line in its printed words and what that order does, found by sending the Choose on a copy of the game.
import { describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/legal.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import type { PlayerIntent } from "../../rules/engine/reduce.ts";
import { asksForcedOrder } from "../../../test/harness/forced-order.ts";
import { start, send, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { spawn } from "../../rules/core/zones.ts";
import { orderForcedWords } from "../words/forced-order.ts";
import { ledgerLine } from "../cards/ledger.ts";

import { sheetFor } from "./sheets.ts";
import { trayTiles } from "./tray-logic.ts";

const SOLO: Layout = { seats: 1, stage: "16068", progress: 6, temperature: 36, staging: ["16023"], phase: "Combat" };

// The table passes until the engine opens the order window at the end of the round.
function asked(layout: Layout, scenario = "desert-crossing") {
  const made = tableFromLayout(scenario, layout);
  let run = start(made.state);
  for (let pass = 0; pass < 60 && !asksForcedOrder(run.state); pass += 1) {
    const intent = legalIntents(run.state, made.ctx).find((one) => ["Pass", "DeclineAttack", "DeclineEngage", "DeclineTravel", "Keep"].includes(one.type));
    if (!intent) break;
    run = send(run, intent as PlayerIntent, made.ctx);
  }
  const ctx = made.ctx;
  const names = { card: (id: string) => made.ctx.cards.get(run.state.cards[id]?.code ?? "")?.name ?? id, line: ledgerLine, code: (code: string) => made.ctx.cards.get(code)?.name ?? code };
  const sheet = sheetFor(run.state, made.ctx, legalIntents(run.state, made.ctx), names);
  if (sheet?.kind !== "pick") throw new Error(`no pick sheet: ${JSON.stringify(run.state.window)}`);
  return { state: run.state as ScenarioState, sheet, ctx, names };
}

describe("the order of simultaneous Forced effects on the sheet", () => {
  const { sheet } = asked(SOLO);

  it("is titled for what it asks and starts with the question", () => {
    expect(sheet.title).toBe("Order the Forced effects");
    expect(sheet.note?.startsWith("Choose the one that resolves first.")).toBe(true);
    expect(sheet.note).toContain("2 Forced effects trigger at the end of the round. The other resolves after it.");
    expect(sheet.verb).toBe("Resolve first");
    expect(sheet.bare).toBe(true);
  });

  it("gives each row its card, its printed Forced line and what that order does", () => {
    const rows = trayTiles(sheet);
    expect(rows.map((row) => row.label).sort()).toEqual(["Seek Shade", "The Desert of Harad"]);
    for (const row of rows) {
      expect(row.detail, row.label).toContain("Forced:");
      expect(row.detail, row.label).toContain("Result:");
    }
    const shade = rows.find((row) => row.label === "Seek Shade");
    const stage = rows.find((row) => row.label === "The Desert of Harad");
    // Seek Shade removes 4 progress at 40 and 3 at 36 (the stage's +4 comes first or after).
    expect(stage?.detail).toContain("Progress on The Desert of Harad 6 to 2");
    expect(shade?.detail).toContain("Progress on The Desert of Harad 6 to 3");
    // The temperature rises either way: it is not what the order decides.
    expect(stage?.detail?.split("Forced:")[0]).not.toContain("emperature");
  });

  it("two-handed the title names the first player and the note still starts with the question", () => {
    const two = asked({ ...SOLO, seats: 2, firstPlayer: 1 }).sheet;
    expect(two.note).toMatch(/^Choose the one that resolves first\. 2 Forced effects/);
    expect(two.title).toBe("Order the Forced effects");
  });
});

describe("three cards or more", () => {
  it("counts what is left, and copies of one card show how many", () => {
    const { state, ctx, names } = asked(SOLO);
    const shade = Object.values(state.cards).find((card) => card.code === "16023");
    const stage = Object.values(state.cards).find((card) => card.code === "16068");
    if (!shade || !stage) throw new Error("no Seek Shade or stage");
    const copy = spawn(state, "16023", { zone: "staging" });
    const entries = [
      { effectId: "16023:forced:1", sourceId: shade.id },
      { effectId: "16023:forced:1", sourceId: copy.id },
      { effectId: "16068:forced:1", sourceId: stage.id },
    ];
    const next = orderForcedWords(copy.state, ctx, names, { verb: "OrderForced", entries, total: 4 }, [shade.id, stage.id]);
    expect(next.prompt).toBe("Choose the one that resolves next (3 of 4 left).");
    expect(next.verb).toBe("Resolve next");
    expect(next.rows?.[shade.id]?.label).toBe("Seek Shade (2 copies)");
    expect(next.rows?.[stage.id]?.label).toBe("The Desert of Harad");
  });
});

describe("what the words claim of an order", () => {
  it("keeps the sentence of when the effects trigger in the first question when what a card prints narrows the options", () => {
    const { state, ctx, names } = asked(SOLO);
    const shade = Object.values(state.cards).find((card) => card.code === "16023");
    const stage = Object.values(state.cards).find((card) => card.code === "16068");
    if (!shade || !stage) throw new Error("no Seek Shade or stage");
    const entries = [
      { effectId: "16023:forced:1", sourceId: shade.id },
      { effectId: "16068:forced:1", sourceId: stage.id },
    ];
    const words = orderForcedWords(state, ctx, names, { verb: "OrderForced", entries, total: 2 }, [shade.id]);
    expect(words.prompt).toContain("2 Forced effects trigger at the end of the round.");
  });
});

describe("what a sheet says when an order cannot be read", () => {
  // Annúminas, a Battering Ram and a City Wall at 2 tokens: the Wall's order reveals a hidden card, the other two stop at the next order question.
  const THREE: Layout = { seats: 1, phase: "Combat", deck: ["50821", "50822"], staging: [{ code: "50820", resources: 2 }, "50814", { code: "50812", resources: 10 }] };

  it("names its whole change on the row it can read and says why the other has none (50820:A:2, 50814:A:2)", () => {
    const { sheet } = asked(THREE, "the-siege-of-annuminas");
    const rows = trayTiles(sheet);
    expect(rows.find((row) => row.label === "City Wall")?.detail).toContain("Result: shown after it resolves (a hidden card turns up).");
    expect(rows.find((row) => row.label === "Battering Ram")?.detail).toContain("Result: Resource tokens on Battering Ram 0 to 1,");
    expect(sheet.note).not.toContain("Same result");
  });

  it("puts the Result before the printed line, so a cut detail keeps the Result", () => {
    const { sheet } = asked(THREE, "the-siege-of-annuminas");
    for (const row of trayTiles(sheet)) expect(row.detail?.startsWith("Result:"), row.label).toBe(true);
  });

  it("gives no Result and no equal-result claim for a copy that stops on a question of its own card (50813:A:3: the attack on the first player)", () => {
    const { sheet } = asked({ seats: 1, phase: "Combat", deck: ["50821", "50822"], staging: ["50813", { code: "50812", resources: 10 }] }, "the-siege-of-annuminas");
    for (const row of trayTiles(sheet)) expect(row.detail, row.label).not.toContain("Result:");
    expect(sheet.note).not.toContain("Same result");
  });

  it("says Same result in either order when the two orders leave equal tables (50820:A:2 at 0 tokens, 50812:A:1)", () => {
    const { sheet } = asked({ seats: 1, phase: "Combat", deck: ["50821", "50822"], staging: [{ code: "50820", resources: 0 }, { code: "50812", resources: 10 }] }, "the-siege-of-annuminas");
    expect(sheet.note).toContain("Same result in either order.");
    for (const row of trayTiles(sheet)) expect(row.detail, row.label).not.toContain("Result:");
  });
});
