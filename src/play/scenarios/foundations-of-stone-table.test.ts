// Rules: rr.attachment-cards, mec109.multiple-staging-areas, dwd.creating-a-staging-area (data/rules/entries.json); docs/design-system-table.md, Cards, "Foundations of Stone". The Table step of Foundations of Stone: the player cards a Nameless enemy holds lie under it,
// in the staging area and engaged, Durin's Axe and Helm lie under their hero, a stage 4 says it is complete and waits for the travel phase; ledger lines 04114:B:2, 04119:A:2, 04120:A:2, 04125:A:1, 901704:A:1. The table adds no zone or dial.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { runInstruction } from "../../rules/interpret/interpret.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { tableLayout, type LayoutViews, type PileViews } from "../layout/layout.ts";
import { PILES, TABLE_ZONES, pileSelector, secondPilesOf, zoneSelector } from "../store/selectors.ts";
import { zoneFactsOf } from "../store/zone-facts.ts";
import { questTitle } from "../cards/table-preview.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";

const table = (layout: Layout) => tableFromLayout("foundations-of-stone", layout, { effects: EFFECTS });

function viewsOf(state: ScenarioState, ctx: ReturnType<typeof table>["ctx"]) {
  const facts = zoneFactsOf(ctx.cards);
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0, facts)(state)])) as unknown as LayoutViews;
  const piles = Object.fromEntries([...PILES, ...secondPilesOf(state)].map((pile) => [pile, pileSelector(pile, 0)(state)])) as unknown as PileViews;
  return { views, piles };
}

/** The codes drawn as cards in each zone's row, and the attachments each host carries. */
const rowsOf = (views: LayoutViews) => Object.entries(views).flatMap(([zone, view]) => view.entries.map((entry) => ({ zone, code: entry.card.code, attached: entry.attached.map((card) => card.code) })));

describe("Foundations of Stone's held cards", () => {
  it("04125:A:1 draws the player cards a Nameless Thing holds under it, in the staging area and engaged, and not as cards of a row", () => {
    for (const where of ["staging", "engaged"] as const) {
      const made = table(where === "staging" ? { staging: ["04125"], deckOf: ["c2", "c3"] } : { engaged: ["04125"], deckOf: ["c2", "c3"] });
      const thing = idOf(made.state, "04125");
      const held = runInstruction({ ...made.state, window: null }, { verb: "AttachDeckTop", count: 2 }, { seat: 0, sourceId: thing }, made.ctx, []);
      const { views, piles } = viewsOf(held, made.ctx);
      const rows = rowsOf(views);
      expect(rows.some((row) => row.code === "c2" || row.code === "c3"), where).toBe(false);
      expect(rows.find((row) => row.code === "04125")?.attached, where).toEqual(["c2", "c3"]);
      const slots = tableLayout(844, 390, views, piles).slots;
      expect(slots.filter((slot) => slot.kind === "attachment").map((slot) => slot.code), where).toEqual(["c2", "c3"]);
    }
  });

  it("901704:A:1 draws the card an Unspeakable Thing holds under it", () => {
    const made = table({ engaged: ["901704"], deckOf: ["c3"] });
    const thing = idOf(made.state, "901704");
    const held = runInstruction({ ...made.state, window: null }, { verb: "AttachDeckTop" }, { seat: 0, sourceId: thing }, made.ctx, []);
    expect(rowsOf(viewsOf(held, made.ctx).views).find((row) => row.code === "901704")?.attached).toEqual(["c3"]);
  });

  it("04119:A:2 draws Durin's Axe and 04120:A:2 Durin's Helm under their hero, not as cards of a row", () => {
    const made = table({ phase: "Quest", attached: [{ code: "04119", to: "dh1" }, { code: "04120", to: "dh1" }] });
    const rows = rowsOf(viewsOf(made.state, made.ctx).views);
    expect(rows.some((row) => row.code === "04119" || row.code === "04120")).toBe(false);
    expect(rows.find((row) => row.code === "dh1")?.attached).toEqual(expect.arrayContaining(["04119", "04120"]));
  });
});

describe("A stage 4 that waits for the travel phase", () => {
  const line = (id: string) => (id === "04114:B:2" ? "Forced: After the 11th progress token is placed on Sheltered Rocks, join another player at the beginning of the travel phase. If you cannot join another player, all players continue on to stage 5 together." : null);

  it("04114:B:2 reads its progress over its quest points and, in the rule's own sentence, that it joins another player at the beginning of the travel phase", () => {
    const made = table({ stage: "04114" });
    const stage = made.state.questStage ?? "";
    const full = updateCard(made.state, stage, { progress: 11 });
    const title = questTitle(full, made.ctx, stage, "Sheltered Rocks", line);
    expect(title?.title).toBe("Sheltered Rocks · 11 / 11");
    expect(title?.detail).toContain("join another player at the beginning of the travel phase");
    const part = questTitle(updateCard(made.state, stage, { progress: 5 }), made.ctx, stage, "Sheltered Rocks", line);
    expect(part?.title).toBe("Sheltered Rocks · 5 / 11");
  });
});

describe("What a Nameless enemy holds, in a preview", () => {
  it("04125:A:2 says a held card is the owner's, has no title or text and counts its printed cost, and the enemy says what X is", () => {
    const made = table({ seats: 2, engaged: ["04125"], deckOf: ["c2", "c3"] });
    const thing = idOf(made.state, "04125");
    const held = runInstruction({ ...made.state, window: null }, { verb: "AttachDeckTop", count: 2 }, { seat: 0, sourceId: thing }, made.ctx, []);
    const name = (id: string) => made.ctx.cards.get(held.cards[id]?.code ?? "")?.name ?? id;
    const card = held.cards[thing]?.attachments[0] ?? "";
    expect(dungeonDetail(held, made.ctx, card, name)).toContain("Player 1's card, attached to Nameless Thing. It has no title and no text. Its printed cost, 2, counts toward X.");
    expect(dungeonDetail(held, made.ctx, thing, name)).toBe("Holds 2 attached cards. X is their printed cost added up, 5: its Attack and its hit points.");
  });
});
