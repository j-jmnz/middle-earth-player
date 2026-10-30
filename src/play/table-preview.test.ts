// Rules: rr.quest-cards-quest-deck, rr.winning-the-game, rr.quest-advancement, faq.progress-without-advancing (data/rules/entries.json). The quest card's preview carries what the
// removed quest band said (phase 22): the stage's name and its progress over its quest points as the title line, or how a stage
// with no quest points is won.
import { beforeAll, describe, expect, it } from "vitest";

import { updateCard } from "../rules/state.ts";
import { buildTable, idsOf, sceneCards } from "../../scripts/test-scene.ts";

import { ledgerLine } from "./ledger.ts";
import { previewCards, questTitle } from "./table-preview.ts";

let base: Awaited<ReturnType<typeof sceneCards>>;

beforeAll(async () => {
  base = await sceneCards();
});

const describeCode = (code: string) => ({ name: `name ${code}`, source: null });

describe("the quest card's preview title", () => {
  it("is the stage name over progress / quest points, and follows the engine's progress", () => {
    const table = buildTable(base, { stage: "141022" });
    const stage = table.state.questStage!;
    const first = questTitle(table.state, table.ctx, stage, "Flight", ledgerLine);
    expect(first?.title).toMatch(/^Flight · 0 \/ \d+$/);
    const moved = updateCard(table.state, stage, { progress: 3 });
    expect(questTitle(moved, table.ctx, stage, "Flight", ledgerLine)?.title).toMatch(/^Flight · 3 \/ \d+$/);
    // Bag End is not in the victory display yet: the stage says what holds it back (141022:B:2), so progress past its quest
    // points reads as the rule (faq.progress-without-advancing).
    expect(first?.detail).toBe("The players cannot advance unless Bag End is in the victory display.");
  });

  it("says nothing holds a stage that nothing holds back", () => {
    const table = buildTable(base, { stage: "141023" });
    expect(questTitle(table.state, table.ctx, table.state.questStage!, "Stage", ledgerLine)?.detail).toBeUndefined();
  });

  it("names the stage alone with the printed way to win it when it has no quest points", () => {
    const ferry = buildTable(base, { stage: "141024", staging: ["141035"] });
    const title = questTitle(ferry.state, ferry.ctx, ferry.state.questStage!, "Ferry", ledgerLine);
    expect(title?.title).toBe("Ferry");
    expect(title?.detail).toBe("To win: After Bucklebury Ferry leaves play as an explored location, the players win the game.");
  });

  it("is nothing for a card that is not the quest stage", () => {
    const table = buildTable(base, { stage: "141022", staging: ["f0"] });
    expect(questTitle(table.state, table.ctx, idsOf(table, "f0"), "Enemy", ledgerLine)).toBeNull();
  });

  it("is the title of the first card in the preview of the stage, and not of the others", () => {
    const table = buildTable(base, { stage: "141022", staging: ["f0"] });
    const stage = previewCards(table.state, table.ctx, table.state.questStage!, describeCode, (id) => id, [], ledgerLine);
    expect(stage.cards[stage.start]?.title).toMatch(/ · 0 \/ \d+$/);
    const enemy = previewCards(table.state, table.ctx, idsOf(table, "f0"), describeCode, (id) => id, [], ledgerLine);
    expect(enemy.cards[enemy.start]?.title).toBeUndefined();
  });
});
