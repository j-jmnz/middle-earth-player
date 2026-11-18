// Rules: rr.attachment-cards, rr.active-location, dwd.doors-of-durin, dwd.encounter-card-actions (data/rules/entries.json); docs/design-system-table.md, Cards, "The Watcher in the Water". The Table step of The Watcher in the Water: Wrapped! and the Grasping, Writhing and
// Choking Tentacle lie in zone `attached` with the printed type enemy and are drawn under their host, never as an enemy in a staging or engaged row; Doors of Durin is the active location with no quest points and its Action is offered to any seat; The Watcher stands in the staging area.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../effects/index.ts";
import { legalIntents } from "../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import { finish, idOf, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { tableLayout, type CardSlot, type LayoutViews, type PileViews } from "../layout/layout.ts";
import { PILES, TABLE_ZONES, pileSelector, secondPilesOf, zoneSelector } from "../store/selectors.ts";
import { zoneFactsOf } from "../store/zone-facts.ts";

const table = (layout: Layout) => tableFromLayout("the-watcher-in-the-water", layout, { effects: EFFECTS });

function viewsOf(state: ScenarioState, ctx: ReturnType<typeof table>["ctx"]) {
  const facts = zoneFactsOf(ctx.cards);
  const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0, facts)(state)])) as unknown as LayoutViews;
  const piles = Object.fromEntries([...PILES, ...secondPilesOf(state)].map((pile) => [pile, pileSelector(pile, 0)(state)])) as unknown as PileViews;
  return { views, piles };
}

/** The codes drawn as cards in each zone's row, and the attachments each host carries. */
const rowsOf = (views: LayoutViews) => Object.entries(views).flatMap(([zone, view]) => view.entries.map((entry) => ({ zone, code: entry.card.code, attached: entry.attached.map((card) => card.code) })));

describe("The Watcher in the Water's held cards", () => {
  it("040076:A:1 draws Wrapped! under its hero, not as a card of any row", () => {
    const made = table({ phase: "Quest", deck: ["f0", "f0"] });
    const steps: Parameters<typeof revealFromTop>[3] = [];
    const revealed = revealFromTop(made.state, made.ctx, "040076", steps);
    const state = finish({ state: revealed.state, steps }, made.ctx).state;
    expect(state.cards[revealed.id]?.zone).toBe("attached");
    const { views, piles } = viewsOf(state, made.ctx);
    const rows = rowsOf(views);
    expect(rows.some((row) => row.code === "040076")).toBe(false);
    expect(rows.find((row) => row.code === "dh1")?.attached).toContain("040076");
    const slots = tableLayout(844, 390, views, piles, { stacks: true }).slots;
    expect(slots.some((slot) => slot.kind === "attachment" && slot.code === "040076")).toBe(true);
  });

  it("04073:A:1 draws a Grasping Tentacle that attached itself under its host and in no enemy row", () => {
    const made = table({ phase: "PlayerAttacks", engaged: [{ code: "04073" }], deck: ["04066", "f0", "f0"] });
    const state = syncConstants(made.state, made.ctx);
    const run = send(start(state), { type: "DeclareAttackers", enemyId: idOf(state, "04073"), attackerIds: [made.hero] }, made.ctx);
    const done = finish(run, made.ctx).state;
    expect(done.cards[idOf(done, "04073")]?.zone).toBe("attached");
    const { views } = viewsOf(done, made.ctx);
    const rows = rowsOf(views);
    expect(rows.some((row) => row.code === "04073")).toBe(false);
    expect(rows.find((row) => row.code === "dh1")?.attached).toContain("04073");
  });

  it("04065:A:2 draws Doors of Durin as the active location with no quest points, its Action offered to either seat, and The Watcher in the staging area", () => {
    const made = table({ seats: 2, active: "04065", staging: ["04072"], hand: ["filler"], deck: ["f0"] });
    const { views } = viewsOf(made.state, made.ctx);
    expect(views.activeLocation.entries.map((entry) => entry.card.code)).toEqual(["04065"]);
    expect(views.staging.entries.map((entry) => entry.card.code)).toEqual(["04072"]);
    const offered = (seat: number) => legalIntents({ ...made.state, activeSeat: seat }, made.ctx).some((intent) => intent.type === "Trigger" && made.state.cards[intent.cardId]?.code === "04065");
    expect(offered(0)).toBe(true);
    expect(offered(1)).toBe(true);
  });
});
