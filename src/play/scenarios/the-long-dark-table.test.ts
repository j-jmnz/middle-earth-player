// Rules: rr.attachment-cards, rr.active-location, dwd.locate-test, dwd.cave-torch-the-long-dark (data/rules/entries.json); docs/design-system-table.md, Cards, "The Long Dark". The Table step of The Long Dark: Durin's Greaves, Lost and Helpless and Cave Torch lie in zone `attached` and are drawn under their hero, Gathering Ground under its
// location (staging area or active location), none as a card of a row; the locate test's banner lists each encounter card it discarded and whether it prints PASS. The table adds no zone or tracker; ledger lines 04086:A:1, 04088:A:1, 04095:A:1, 901608:A:2, 04087:B:1.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { finish, revealFromTop, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { tableLayout, type LayoutViews, type PileViews } from "../layout/layout.ts";
import { PILES, TABLE_ZONES, pileSelector, secondPilesOf, zoneSelector } from "../store/selectors.ts";
import { zoneFactsOf } from "../store/zone-facts.ts";
import { momentOf } from "../store/outcome.ts";
import { printedOf } from "../../rules/core/printed.ts";

const table = (layout: Layout) => tableFromLayout("the-long-dark", layout, { effects: EFFECTS });

function viewsOf(state: ScenarioState, ctx: ReturnType<typeof table>["ctx"]) {
  const facts = zoneFactsOf(ctx.cards);
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0, facts)(state)])) as unknown as LayoutViews;
  const piles = Object.fromEntries([...PILES, ...secondPilesOf(state)].map((pile) => [pile, pileSelector(pile, 0)(state)])) as unknown as PileViews;
  return { views, piles };
}

/** The codes drawn as cards in each zone's row, and the attachments each host carries. */
const rowsOf = (views: LayoutViews) => Object.entries(views).flatMap(([zone, view]) => view.entries.map((entry) => ({ zone, code: entry.card.code, attached: entry.attached.map((card) => card.code) })));

describe("The Long Dark's held cards", () => {
  it("04088:A:1 draws Durin's Greaves under its hero, not as a card of any row", () => {
    const made = table({ phase: "Quest", attached: [{ code: "04088", to: "dh1" }] });
    const { views, piles } = viewsOf(made.state, made.ctx);
    const rows = rowsOf(views);
    expect(rows.some((row) => row.code === "04088")).toBe(false);
    expect(rows.find((row) => row.code === "dh1")?.attached).toContain("04088");
    const slots = tableLayout(844, 390, views, piles, { stacks: true }).slots;
    expect(slots.some((slot) => slot.kind === "attachment" && slot.code === "04088")).toBe(true);
  });

  it("04086:A:1 draws Cave Torch under the hero the first player chose", () => {
    const made = table({ stage: "04086", side: "A", attached: [{ code: "03041", to: "dh2" }] });
    const { views } = viewsOf(made.state, made.ctx);
    expect(rowsOf(views).find((row) => row.code === "dh2")?.attached).toContain("03041");
  });

  it("901608:A:2 draws Lost and Helpless under its hero, a treachery lying as an attachment", () => {
    const made = table({ phase: "Quest", deck: ["f0"] });
    const revealed = revealFromTop(made.state, made.ctx, "901608", []);
    const state = finish({ state: revealed.state, steps: [] }, made.ctx).state;
    expect(state.cards[revealed.id]?.zone).toBe("attached");
    const { views } = viewsOf(state, made.ctx);
    const rows = rowsOf(views);
    expect(rows.some((row) => row.code === "901608")).toBe(false);
    expect(rows.some((row) => row.attached.includes("901608"))).toBe(true);
  });

  it("04095:A:1 draws Gathering Ground under its location in the staging area, and under the active location", () => {
    for (const where of ["staging", "active"] as const) {
      const made = table(where === "staging" ? { staging: ["04092"], attached: [{ code: "04095", to: "04092" }] } : { active: "04092", attached: [{ code: "04095", to: "04092" }] });
      const { views } = viewsOf(made.state, made.ctx);
      const rows = rowsOf(views);
      expect(rows.some((row) => row.code === "04095"), where).toBe(false);
      expect(rows.find((row) => row.code === "04092")?.attached, where).toContain("04095");
    }
  });
});

describe("The locate test's banner", () => {
  it("04087:B:1 lists each encounter card the test discarded and whether it prints PASS", () => {
    const made = table({ stage: "04087", hand: ["filler", "filler"], deck: ["04093", "04092"] });
    const [fatigue, passage] = made.state.encounterDeck;
    const [held, other] = made.state.seats[0]?.hand ?? [];
    const step = { kind: "locateTest" as const, seat: 0, handIds: [held ?? "", other ?? ""], dealtIds: [fatigue ?? "", passage ?? ""], success: true };
    const names = { card: (id: string) => made.cards.get(made.state.cards[id]?.code ?? id)?.name ?? id, passes: (id: string) => printedOf(made.ctx.cards, made.state.cards[id]?.code ?? "").keywords.pass === true };
    const moment = momentOf(made.state, made.state, [step], names);
    expect(moment?.title).toBe("Locate test passed");
    expect(moment?.lines.map((line) => line.text)).toEqual(["filler discarded, Fatigue has no PASS", "filler discarded, Twisting Passage has PASS"]);
    expect(moment?.lines[1]?.cards).toEqual([other, passage]);
  });
});
