// Rules: rr.guarded, rr.reveal (data/rules/entries.json); ledger lines 51205:B:1, 51241:A:1 (docs/scenarios/standalone-scenarios/the-mines-of-moria.md, The Mines of Moria, The table and readings 10 and 11; docs/design-system-table.md, Top bar).
// What the table shows of The Mines of Moria's two holding cards: the facedown cards Hidden Threat lays under the main quest ("1 hidden") and the attachments Narrow Paths holds under its stage ("2 held", with their owners).
import { describe, expect, it } from "vitest";

import { updateCard } from "../../../rules/core/state.ts";
import { idOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { hiddenMark, isHeldFaceup, keptMark } from "./wizards-quest.ts";

const made = (layout: Layout) => tableFromLayout("the-mines-of-moria", layout);

describe("the cards under the quest of The Mines of Moria", () => {
  it("51241:A:1 the main quest says how many facedown cards Hidden Threat laid under it, and names none", () => {
    const table = made({ stage: "51203", under: [{ code: "51212", to: "51203" }, { code: "51213", to: "51203" }] });
    expect(hiddenMark(table.state, idOf(table.state, "51203"))).toBeNull();
    let state = table.state;
    for (const [at, code] of ["51212", "51213"].entries()) state = updateCard(state, idOf(state, code), { hiddenAt: at + 1 });
    expect(hiddenMark(state, idOf(state, "51203"))).toEqual({ text: "2 hidden", count: 2, loses: false, speech: "2 cards hidden facedown underneath, revealed after the next successful quest" });
    expect(JSON.stringify(hiddenMark(state, idOf(state, "51203")))).not.toContain("Savage");
  });

  it("51205:B:1 the stage that holds attachments counts them with their owners, as Carried Away does", () => {
    const table = made({ stage: "51205", attached: [{ code: "attachment", to: "dh1" }], deck: ["f0", "f0"] });
    expect(keptMark(table.state, table.ctx, idOf(table.state, "51205"), isHeldFaceup)).toBeNull();
    const done = resolveRecords(table.state, table.ctx, "51205", "whenRevealed", idOf(table.state, "51205")).state;
    expect(keptMark(done, table.ctx, idOf(done, "51205"), isHeldFaceup)).toMatchObject({ text: "1 held", count: 1 });
  });
});
