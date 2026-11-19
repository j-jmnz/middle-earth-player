// Rules: rr.attachment-cards, dwd.durins-bane, rr.travel (data/rules/entries.json); docs/design-system-table.md, Cards, "Shadow and Flame". The Table step of Shadow and Flame: the Balrog deck and Balrog discard pile of Nightmare are readouts with their counts, Counter-Spell,
// Fiery Sword and Many Thonged Whip lie under Durin's Bane in the staging area, Durin's Bane says which players it is considered engaged with, and the rows of Fiery Depths' pick name the owner of each hero; ledger lines 901801:A:2, 901801:A:3, 901801:A:4, 04145:A:1,
// 04152:A:1, 04153:A:1, 04150:A:2, 901809:A:2.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { markSeatedRows } from "../../rules/families/encounter/seated.ts";
import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { seatedLabel } from "../choice/sheet-parts.ts";
import { tableLayout, type LayoutViews, type PileViews } from "../layout/layout.ts";
import { dungeonDetail } from "../cards/dungeon-preview.ts";
import { PILES, PILE_WORDS, TABLE_ZONES, isDiscardPile, opensList, pileSelector, secondPilesOf, zoneSelector } from "../store/selectors.ts";
import { zoneFactsOf } from "../store/zone-facts.ts";

const table = (layout: Layout) => tableFromLayout("shadow-and-flame", layout, { effects: EFFECTS });

function viewsOf(state: ScenarioState, ctx: ReturnType<typeof table>["ctx"]) {
  const facts = zoneFactsOf(ctx.cards);
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0, facts)(state)])) as unknown as LayoutViews;
  const piles = Object.fromEntries([...PILES, ...secondPilesOf(state)].map((pile) => [pile, pileSelector(pile, 0)(state)])) as unknown as PileViews;
  return { views, piles };
}

/** The codes drawn as cards in each zone's row, and the attachments each host carries. */
const rowsOf = (views: LayoutViews) => Object.entries(views).flatMap(([zone, view]) => view.entries.map((entry) => ({ zone, code: entry.card.code, attached: entry.attached.map((card) => card.code) })));

describe("The Balrog deck and its discard pile", () => {
  const FLAME: Layout = { nightmare: "901801", staging: ["04150"], piles: { balrogDeck: ["901802", "901803", "901804"], balrogDiscard: ["901805"] } };

  it("901801:A:2 shows the Balrog deck and the Balrog discard pile as the second pair of piles on Nightmare, with their counts, and none otherwise", () => {
    const made = table(FLAME);
    expect(secondPilesOf(made.state)).toEqual(["balrogDeck", "balrogDiscard"]);
    expect(pileSelector("balrogDeck", 0)(made.state).ids).toHaveLength(3);
    expect(pileSelector("balrogDiscard", 0)(made.state).ids).toHaveLength(1);
    expect(PILE_WORDS.balrogDeck).toBe("Balrog deck");
    expect(PILE_WORDS.balrogDiscard).toBe("Balrog discard pile");
    expect(secondPilesOf(table({ staging: ["04150"] }).state)).toEqual([]);
  });

  it("901801:A:4 draws the Balrog discard pile face up and opens its list, and the deck facedown without one", () => {
    expect(isDiscardPile("balrogDiscard")).toBe(true);
    expect(opensList("balrogDiscard")).toBe(true);
    expect(isDiscardPile("balrogDeck")).toBe(false);
    expect(opensList("balrogDeck")).toBe(false);
  });

  it("901801:A:3 puts the pair under the encounter pair, on every screen the table lays out", () => {
    const made = table(FLAME);
    const { views, piles } = viewsOf(made.state, made.ctx);
    for (const [width, height] of [[844, 390], [667, 375], [1024, 768]] as const) {
      const layout = tableLayout(width, height, views, piles);
      const { balrogDeck, balrogDiscard, encounterDeck, encounterDiscard } = layout.piles;
      expect(balrogDeck, `${width}`).toBeDefined();
      expect(balrogDiscard, `${width}`).toBeDefined();
      expect(balrogDeck?.x).toBe(encounterDeck.x);
      expect(balrogDiscard?.x).toBe(encounterDiscard.x);
      expect(balrogDeck?.y).toBe(balrogDiscard?.y);
      expect(balrogDeck?.y).toBeGreaterThan(encounterDeck.y);
    }
  });
});

describe("Durin's Bane in the staging area", () => {
  it("04145:A:1, 04152:A:1 and 04153:A:1 draw Counter-Spell, Fiery Sword and Many Thonged Whip under Durin's Bane, not as cards of a row", () => {
    const made = table({ staging: ["04150"], attached: [{ code: "04145", to: "04150" }, { code: "04152", to: "04150" }, { code: "04153", to: "04150" }] });
    const { views, piles } = viewsOf(made.state, made.ctx);
    const rows = rowsOf(views);
    expect(rows.some((row) => ["04145", "04152", "04153"].includes(row.code))).toBe(false);
    expect(rows.find((row) => row.code === "04150")).toMatchObject({ zone: "staging", attached: ["04145", "04152", "04153"] });
    const slots = tableLayout(844, 390, views, piles).slots;
    expect(slots.filter((slot) => slot.kind === "attachment").map((slot) => slot.code)).toEqual(["04145", "04152", "04153"]);
  });

  it("04150:A:2 says which players Durin's Bane is considered engaged with, read live from their threat", () => {
    const name = (id: string) => id;
    const both = table({ seats: 2, threat: [4, 6], staging: ["04150"] });
    expect(dungeonDetail(both.state, both.ctx, idOf(both.state, "04150"), name)).toBe("Considered engaged with Player 1 and Player 2 (threat 1 or more): it attacks each once in the combat phase.");
    const one = table({ seats: 2, threat: [4, 0], staging: ["04150"] });
    expect(dungeonDetail(one.state, one.ctx, idOf(one.state, "04150"), name)).toBe("Considered engaged with Player 1 (threat 1 or more): it attacks them once in the combat phase. Not engaged with Player 2 (threat 0).");
    const none = table({ threat: [0, 0], staging: ["04150"] });
    expect(dungeonDetail(none.state, none.ctx, idOf(none.state, "04150"), name)).toBe("Engaged with no player: every threat is 0.");
    const solo = table({ threat: [3, 0], staging: ["04150"] });
    expect(dungeonDetail(solo.state, solo.ctx, idOf(solo.state, "04150"), name)).toBe("Considered engaged with you (threat 1 or more): it attacks you once in the combat phase.");
  });

  it("04145:A:1 says an encounter card attached to Durin's Bane is no player's", () => {
    const made = table({ staging: ["04150"], attached: [{ code: "04145", to: "04150" }] });
    const spell = idOf(made.state, "04145");
    // A treachery that attached itself has no controller (the layout gives its attachments to the first seat).
    const attached = { ...made.state, cards: { ...made.state.cards, [spell]: { ...made.state.cards[spell]!, controller: null } } };
    expect(dungeonDetail(attached, made.ctx, spell, () => "Durin's Bane")).toBe("An encounter card attached to Durin's Bane. No player controls it.");
  });
});

describe("901809:A:2 Fiery Depths' pick of a hero", () => {
  it("901809:A:2 names the owner on each row when the heroes of two players are offered, and on none with one player", () => {
    const two = table({ seats: 2, phase: "Travel", staging: ["901809"] });
    const state = markSeatedRows(two.state, two.ctx);
    expect(state.seatedRows).toBe(true);
    const names = { card: (id: string) => two.ctx.cards.get(state.cards[id]?.code ?? "")?.name ?? id, line: () => null };
    const heroes = [...state.seats[0]?.heroes ?? [], ...state.seats[1]?.heroes ?? []];
    const labels = heroes.map((id) => seatedLabel(state, two.ctx, names, id, heroes));
    expect(labels.every((label) => label != null && /Player [12]'s hero$/.test(label))).toBe(true);
    expect(labels[0]).toContain("Player 1's hero");
    expect(labels.at(-1)).toContain("Player 2's hero");
    const solo = table({ phase: "Travel", staging: ["901809"] });
    expect(markSeatedRows(solo.state, solo.ctx).seatedRows).toBeUndefined();
  });
});
