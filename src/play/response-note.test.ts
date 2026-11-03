// Rules: rr.triggering-condition (data/rules/entries.json). The response window of one commit names the Responses that wait
// for a cost another Response may pay (Aragorn's ready waits for Théodred's resource).
import { beforeAll, describe, expect, it } from "vitest";

import { legalIntents } from "../rules/engine/reduce.ts";
import { starterBase } from "../../scripts/starter-scene.ts";
import { begin, buildTable, idsOf, send } from "../../scripts/test-scene.ts";

import type { SheetNames } from "./sheet-types.ts";
import { sheetFor } from "./sheets.ts";

const names: SheetNames = { card: (id) => id, line: () => null };
let base: Awaited<ReturnType<typeof starterBase>>;

beforeAll(async () => {
  base = await starterBase();
});

describe("the response window of one commit", () => {
  it("names the Response that waits for its cost", () => {
    const tab = buildTable(base, { ring: "none", start: "quest", heroes: [{ code: "01001", seat: 0 }, { code: "01002", seat: 0 }] });
    const aragorn = idsOf(tab, "01001");
    const run = send(begin(tab.state), { type: "Commit", cardIds: [aragorn, idsOf(tab, "01002")] }, tab.ctx);
    const sheet = sheetFor(run.state, tab.ctx, legalIntents(run.state, tab.ctx), names);
    expect(sheet?.kind === "trigger" ? sheet.note : "").toBe(`A Response may be used now, or passed. Waiting for its cost, and offered once it can be paid: ${aragorn}. Passing gives it up too.`);
    // Aragorn was committed first, but only Théodred's Response is listed: the window is named after Théodred.
    expect(sheet?.kind === "trigger" ? [sheet.title, sheet.sourceId] : []).toEqual([idsOf(tab, "01002"), idsOf(tab, "01002")]);
  });
});
