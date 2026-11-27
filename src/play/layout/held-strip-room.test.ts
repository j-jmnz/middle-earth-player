// Rules: hrd.captives-of-cirith-gurat, hrd.guarded-heroes (data/rules/entries.json). The room a held character's strip takes (layout.ts, heldRoom): the table's card gets smaller instead of the play area getting less room, so at 667 x 375 a hero's
// attachments still peek out above the hand with a tap band, with a strip under a staging enemy (The Dungeons of Cirith Gurat) or under an engaged enemy (a guarded hero of Lost in Mirkwood and The Long Arm of Mordor).
import { describe, expect, it } from "vitest";

import { tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { PILES, TABLE_ZONES, pileSelector, secondPilesOf, zoneSelector } from "../store/selectors.ts";
import { zoneFactsOf } from "../store/zone-facts.ts";
import { bandBounds } from "./hits.ts";
import { tableLayout, type LayoutViews, type PileViews } from "./layout.ts";

const laid = (scenario: string, layout: Layout, width: number, height: number, stacks = false) => {
  const t = tableFromLayout(scenario, { phase: "Quest", seats: 2, ...layout }, { extra: ["01013"] });
  const facts = zoneFactsOf(t.ctx.cards);
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0, facts)(t.state)])) as unknown as LayoutViews;
  const piles = Object.fromEntries([...PILES, ...secondPilesOf(t.state)].map((pile) => [pile, pileSelector(pile, 0)(t.state)])) as unknown as PileViews;
  const strip = tableLayout(width, height, views, piles, { scale: 1, stacks });
  return { strip, t };
};

const ATTACH = [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh1" }] as const;
const CASES: readonly { name: string; scenario: string; layout: Layout; bare: Layout }[] = [
  {
    name: "an ally under a staging enemy (The Dungeons of Cirith Gurat)",
    scenario: "the-dungeons-of-cirith-gurat",
    layout: { stage: "17132", side: "B", staging: ["17125"], play: ["01013"], captive: [{ hero: "01013", under: "17125" }], attached: ATTACH },
    bare: { stage: "17132", side: "B", staging: ["17125"], attached: ATTACH },
  },
  {
    name: "a guarded hero under an engaged enemy (Lost in Mirkwood)",
    scenario: "lost-in-mirkwood",
    layout: { engaged: ["f0"], staged: [{ hero: "dh2", under: "f0" }], attached: ATTACH },
    bare: { engaged: ["f0"], attached: ATTACH },
  },
  {
    name: "a guarded hero under an engaged enemy (The Long Arm of Mordor)",
    scenario: "the-long-arm-of-mordor",
    layout: { stage: "16073", side: "B", engaged: ["16062"], staged: [{ hero: "dh2", under: "16062" }], attached: ATTACH },
    bare: { stage: "16073", side: "B", engaged: ["16062"], attached: ATTACH },
  },
];
const CANVASES = [[667, 375], [844, 390], [1280, 800]] as const;

describe("the room a held character's strip takes", () => {
  for (const one of CASES) {
    it(`keeps every card and tap band of the play area above the hand with ${one.name}`, () => {
      for (const [width, height] of CANVASES) {
        const { strip } = laid(one.scenario, one.layout, width, height);
        const where = `${one.scenario} ${width}x${height}`;
        const held = strip.slots.filter((slot) => slot.strip != null);
        expect(held.length, where).toBeGreaterThan(0);
        for (const slot of strip.slots.filter((slot) => slot.zone === "play" && slot.kind === "attachment")) {
          // The attachment's peek is the last peek of its card: it lies above the hand, and its tap band keeps its 44 pt.
          expect(slot.y + slot.h, `${where} ${slot.id}`).toBeLessThanOrEqual(strip.zones.hand.y + 1e-6);
          const band = bandBounds(slot);
          expect(band.y + band.h, `${where} ${slot.id} band`).toBeLessThanOrEqual(strip.zones.hand.y + 1e-6);
          expect(band.h, `${where} ${slot.id} band`).toBeGreaterThanOrEqual(44);
        }
        for (const slot of strip.slots.filter((slot) => slot.zone === "play" && slot.kind === "card")) expect(slot.y + slot.h, `${where} ${slot.id}`).toBeLessThanOrEqual(strip.zones.hand.y + 10 + 1e-6);
      }
    });

    it(`leaves the play area the room it has with no strip, and no row of the table lower than the hand, with ${one.name}`, () => {
      for (const [width, height] of CANVASES) {
        const held = laid(one.scenario, one.layout, width, height).strip;
        const bare = laid(one.scenario, one.bare, width, height).strip;
        const where = `${one.scenario} ${width}x${height}`;
        // The strip costs the table's card some height, and costs no row its room: the play area is as tall as without a strip.
        expect(held.card.h, where).toBeLessThanOrEqual(bare.card.h);
        expect(held.zones.play.y + held.zones.play.h, where).toBeLessThanOrEqual(held.zones.hand.y + 10 + 1e-6);
        const lowest = Math.max(...held.slots.filter((slot) => slot.zone === "staging" || slot.zone === "engaged").map((slot) => slot.y + slot.h));
        expect(lowest, where).toBeLessThanOrEqual(held.zones.play.y + held.zones.play.h);
      }
    });
  }

  it("draws a strip under a staging card within the staging row's drop where the table stacks what lies under a card", () => {
    const { strip } = laid("the-dungeons-of-cirith-gurat", CASES[0]!.layout, 844, 390, true);
    const under = strip.slots.find((slot) => slot.zone === "staging" && slot.strip != null);
    expect(under).toBeDefined();
    expect((under?.y ?? 0) + (under?.h ?? 0), "the strip ends above the engagement row").toBeLessThanOrEqual(strip.zones.engaged.y + 1e-6);
  });
});
