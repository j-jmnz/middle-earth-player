// Rules: rr.quest-advancement, faq.progress-without-advancing (data/rules/entries.json). The quest advance screen's button
// (quest-advance.ts, advanceButton): Progress only where the stage can progress (user request, 2026-10-29).
import { beforeAll, describe, expect, it } from "vitest";

import { buildTable, sceneCards } from "../../scripts/test-scene.ts";

import { ledgerLine } from "./ledger.ts";
import { advanceButton } from "./quest-advance.ts";

let base: Awaited<ReturnType<typeof sceneCards>>;

beforeAll(async () => {
  base = await sceneCards();
});

describe("the quest advance screen's button", () => {
  it("begins a new game on the table's opening and continues a resumed one", () => {
    const table = buildTable(base, { stage: "141023" });
    const opening = { seq: 0, stageId: table.state.questStage! };
    expect(advanceButton({ ...table.state, round: 1 }, table.ctx, opening, ledgerLine).label).toBe("Begin");
    expect(advanceButton({ ...table.state, round: 4 }, table.ctx, opening, ledgerLine).label).toBe("Continue");
    // A save reopened in round 1 with intents already played continues it too (user request, 2026-11-01).
    expect(advanceButton({ ...table.state, round: 1 }, table.ctx, opening, ledgerLine, true).label).toBe("Continue");
  });

  it("says Progress on an advance to a stage that can progress, and Continue on one held back (141022:B:2)", () => {
    const free = buildTable(base, { stage: "141023" });
    expect(advanceButton(free.state, free.ctx, { seq: 3, stageId: free.state.questStage! }, ledgerLine).label).toBe("Progress");
    const held = buildTable(base, { stage: "141022" });
    expect(advanceButton(held.state, held.ctx, { seq: 3, stageId: held.state.questStage! }, ledgerLine).label).toBe("Continue");
  });
});
