import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../rules/interpret/constants.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import { buildTable, begin, FRODO, idsOf, RIDER, sceneCards, send } from "../../../test/harness/scene.ts";

import { sheetFor } from "./sheets.ts";

// Rules: mec109.hide-x, mec109.hide-tests (data/rules/entries.json). The Hide sheet shows the willpower the engine will
// measure, held modifiers included: on stage 141023 each ally of the testing seat adds 1 to the total threat
// (141023:constant:1, printed line 141023:B:2).
let base: Awaited<ReturnType<typeof sceneCards>>;

beforeAll(async () => {
  base = await sceneCards();
});

describe("Hide sheet numbers", () => {
  it("match the Hide test the reducer runs, with stage 141023 and two allies in play", () => {
    const table = buildTable(base, { deck: [RIDER, "f3", "f3", "f3", "f3", "f0"], stage: "141023", allies: [{ code: "ally", seat: 0 }, { code: "ally", seat: 0 }] });
    let run = begin(syncConstants(table.state, table.ctx));
    run = send(run, { type: "Pass" }, table.ctx);
    expect(run.state.window?.kind).toBe("hideCommit");
    run = send(run, { type: "CommitHide", cardIds: [idsOf(table, FRODO)] }, table.ctx);
    expect(run.state.window?.kind).toBe("frameAction");
    const sheet = sheetFor(run.state, table.ctx, legalIntents(run.state, table.ctx), { card: (id) => id, line: () => null });
    const shown = sheet?.kind === "trigger" ? sheet.hide : undefined;
    run = send(run, { type: "Pass" }, table.ctx);
    const step = run.steps.find((entry) => entry.kind === "hideTest");
    // Frodo's 2 willpower against the discarded threat plus 1 for each of the two allies.
    expect(step?.kind === "hideTest" ? [step.willpower, step.threat] : null).toEqual([2, shown?.threat]);
    expect(shown?.willpower).toBe(2);
    // Hide 2 discards two cards of threat 3: 6, plus 2 for the allies.
    expect(shown?.threat).toBe(8);
  });
});
