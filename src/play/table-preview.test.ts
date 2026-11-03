// Rules: rr.quest-cards-quest-deck, rr.winning-the-game, rr.quest-advancement, faq.progress-without-advancing (data/rules/entries.json). The quest card's preview carries what the
// removed quest band said (phase 22): the stage's name and its progress over its quest points as the title line, or how a stage
// with no quest points is won.
import { beforeAll, describe, expect, it } from "vitest";

import { updateCard } from "../rules/core/state.ts";
import { buildTable, idsOf, sceneCards } from "../../test/harness/scene.ts";

import { ledgerLine } from "./ledger.ts";
import { seaFixture } from "./sea-fixture.ts";
import { previewCards, questTitle, tokenLines } from "./table-preview.ts";

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

describe("the Heading card's preview (dcce.heading)", () => {
  it("lists the four steps under their own field with the current one marked, and leaves 'Effects on it' to the effects", () => {
    const fixture = seaFixture({ heading: "Rain", ships: [{ code: "dream-chaser", seat: 0 }] });
    const card = fixture.ids.heading!;
    const { cards, start } = previewCards(fixture.state, fixture.ctx, card, describeCode, (id) => id, [], ledgerLine);
    const shown = cards[start];
    expect(shown?.title).toBe("Heading · Rain (off-course)");
    expect(shown?.turn).toBe(180);
    expect(shown?.steps?.map((row) => row.text)).toEqual(["Sun: on-course", "Cloud: off-course", "Rain: off-course", "Storm: off-course, the worst"]);
    expect(shown?.steps?.filter((row) => row.current).map((row) => row.text)).toEqual(["Rain: off-course"]);
    expect((shown?.effects ?? []).some((line) => line.includes("Sun: on-course"))).toBe(false);
  });
});

describe("the tokens on a previewed card", () => {
  it("lists damage, progress, resources and exhaustion, and nothing for a bare card", () => {
    expect(tokenLines({ damage: 2, progress: 0, resources: 1, exhausted: true, committed: false })).toEqual(["2 damage", "1 resource", "Exhausted"]);
    expect(tokenLines({ damage: 0, progress: 3, resources: 4, exhausted: false, committed: true })).toEqual(["3 progress", "4 resources", "Committed"]);
    expect(tokenLines({ damage: 0, progress: 0, resources: 0, exhausted: false, committed: false })).toEqual([]);
  });

  it("is on the previewed card", () => {
    const table = buildTable(base, { stage: "141022", staging: ["f0"] });
    const id = idsOf(table, "f0");
    const hurt = updateCard(table.state, id, { damage: 2 });
    const shown = previewCards(hurt, table.ctx, id, describeCode, (name) => name, [], ledgerLine);
    expect(shown.cards[shown.start]?.tokens).toEqual(["2 damage"]);
  });

  it("opens a shadow card that left its enemy as itself, not as the enemy it still names as host", () => {
    const table = buildTable(base, { stage: "141022", staging: ["f0", "f0"] });
    const [enemy, moved] = table.ids.f0 as [string, string];
    const stale = updateCard(table.state, moved, { host: enemy });
    const shown = previewCards(stale, table.ctx, moved, describeCode, (name) => name, [], ledgerLine);
    expect(shown.cards.map((card) => card.code)).toEqual([stale.cards[moved]?.code]);
  });

  it("still opens a shadow card its enemy lists on the enemy first, at the shadow card", () => {
    const table = buildTable(base, { stage: "141022", staging: ["f0", "f0"] });
    const [enemy, dealt] = table.ids.f0 as [string, string];
    const linked = updateCard(updateCard(table.state, dealt, { host: enemy, zone: "shadow", face: "up" }), enemy, { shadowId: dealt });
    const shown = previewCards(linked, table.ctx, dealt, describeCode, (name) => name, [], ledgerLine);
    expect(shown.start).toBe(1);
    expect(shown.cards.map((card) => card.code)).toEqual([linked.cards[enemy]?.code, linked.cards[dealt]?.code]);
  });
});
