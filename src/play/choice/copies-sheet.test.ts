import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents } from "../../rules/engine/reduce.ts";
import { updateCard } from "../../rules/core/state.ts";
import { begin, buildTable, FRODO, idsOf, RIDER, sceneCards, send } from "../../../test/harness/scene.ts";

import { copyLabel } from "./sheet-parts.ts";
import { sheetFor } from "./sheets.ts";

// Copies of one card in play are separate choices (docs/brief.md, The engine plays the game): Mr. Underhill (141017:A:3)
// with two Black Riders engaged asks which one, and the sheet's rows say what tells the two apart.
let base: Awaited<ReturnType<typeof sceneCards>>;

beforeAll(async () => {
  base = await sceneCards();
});

const names = { card: (id: string) => (id.startsWith("i") ? "Black Rider" : id), line: () => null };

describe("rows of copies in play", () => {
  it("Mr. Underhill's pick offers both engaged Black Riders, told apart by their damage", () => {
    const table = buildTable(base, { start: "planning", attached: [{ code: "141017", host: FRODO }], engaged: [{ code: RIDER, seat: 0 }, { code: RIDER, seat: 0 }] });
    const riders = Object.values(table.state.cards).filter((card) => card.code === RIDER).map((card) => card.id);
    const hurt = riders[1] ?? "";
    const state = updateCard(table.state, hurt, { damage: 2 });
    const run = send(begin(state), { type: "Trigger", cardId: idsOf(table, "141017"), effectId: "141017:action:1" }, table.ctx);
    const sheet = sheetFor(run.state, table.ctx, legalIntents(run.state, table.ctx), { card: (id) => (run.state.cards[id]?.code === RIDER ? "Black Rider" : id), line: () => null });
    expect(sheet?.kind).toBe("pick");
    const labels = sheet?.kind === "pick" ? sheet.options.map((option) => option.label) : [];
    expect(labels).toEqual(["Black Rider · engaged with you", "Black Rider · engaged with you · 2 damage"]);
  });

  it("names the attacking copy, and says nothing for a row whose name no other row has", () => {
    const table = buildTable(base, { engaged: [{ code: RIDER, seat: 0 }, { code: RIDER, seat: 0 }] });
    const riders = Object.values(table.state.cards).filter((card) => card.code === RIDER).map((card) => card.id);
    const attacker = riders[0] ?? "";
    const state = { ...table.state, pendingAttack: { enemyId: attacker, seat: 0 } };
    expect(copyLabel(state, names, attacker, riders)).toBe("Black Rider · attacking · engaged with you");
    expect(copyLabel(state, names, attacker, [attacker])).toBeUndefined();
  });
});
