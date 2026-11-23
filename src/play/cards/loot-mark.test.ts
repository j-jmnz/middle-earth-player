// Rules: rr.guarded (data/rules/entries.json). The Burglar's Turn (22024:B:2): the table's pills for the loot deck on the contract and
// the loot a location guards (card-effects.ts, lootMark), and the loot card itself, drawn faceup under its location and read in the
// location's preview (store/selectors.ts, table-preview.ts).
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../effects/authored/families/sidequests.ts";
import { codes, fixtureDefinition } from "../../rules/core/test-fixture.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { reduce, startScenario } from "../../rules/engine/reduce.ts";
import { queueEvent } from "../../rules/windows/queue.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { put, run, SIDE_CARDS, synced } from "../../rules/families/sidequests/fixture.ts";
import { lootUnder } from "../../rules/families/sidequests/loot.ts";
import { tableLayout } from "../layout/layout.ts";
import { PILES, TABLE_ZONES, inspectTargets, pileSelector, zoneSelector, type PileId, type PileView, type ZoneId, type ZoneView } from "../store/selectors.ts";
import { slotNumbers } from "./card-effects.ts";
import { previewCards } from "./table-preview.ts";

const filler = codes("f", 20);
const cards = new Map([...SIDE_CARDS, ...filler.map((code) => [code, definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0 })] as const)]);
const ctx = { effects: RECORDS, cards };

function started(): ScenarioState {
  const opening = startScenario(
    { seatCount: 1, seed: 7, threatModifier: 0, definition: fixtureDefinition(["stage"]), seats: [{ heroes: ["dwarf"], deck: ["22024", ...filler], loot: ["rblade", "rblade", "rblade"] }], encounterDeck: [], questDeck: ["stage"] },
    ctx,
  );
  const kept = reduce(opening, { type: "Keep" }, ctx);
  return kept.ok ? kept.state : opening;
}

describe("loot pills on the table (22024:B:2)", () => {
  it("shows the loot deck on the contract and the guarded loot on the location", () => {
    const made = put(started(), "forest-road", "play");
    const active: ScenarioState = updateCard({ ...made.state, activeLocation: made.id }, made.id, { zone: "activeLocation" });
    const traveled = synced(run(queueEvent(synced(active, ctx), { trigger: "traveled", seat: 0, subject: made.id }), ctx), ctx);
    const contract = Object.values(traveled.cards).find((card) => card.code === "22024")!;
    expect(slotNumbers(traveled, ctx, contract.id).under).toMatchObject({ text: "2 left", speech: "2 cards left in the loot deck" });
    expect(slotNumbers(traveled, ctx, made.id).under?.text).toBe("1 loot");
    // A contract whose player chose no loot deck (another seat's, two-handed) has no pill.
    const unchosen: ScenarioState = { ...traveled, lootPlan: [[]] };
    expect(slotNumbers(unchosen, ctx, contract.id).under).toBeNull();
  });

  // "attach the top card of your loot deck faceup to that location": the player may read the card before the location is explored.
  it("draws the loot card faceup under its location and lists it in the location's preview", () => {
    const made = put(started(), "forest-road", "play");
    const active: ScenarioState = updateCard({ ...made.state, activeLocation: made.id }, made.id, { zone: "activeLocation" });
    const before = synced(active, ctx);
    expect(zoneSelector("activeLocation", 0)(before).entries.map((entry) => entry.attached)).toEqual([[]]);
    const traveled = synced(run(queueEvent(before, { trigger: "traveled", seat: 0, subject: made.id }), ctx), ctx);
    const [loot] = lootUnder(traveled, made.id);
    expect(traveled.cards[loot ?? ""]).toMatchObject({ code: "rblade", face: "up" });
    expect(zoneSelector("activeLocation", 0)(traveled).entries.map((entry) => entry.attached.map((card) => card.id))).toEqual([[loot]]);
    // The table lays it out as an attachment's strip below the location, face up.
    const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0)(traveled)])) as Record<ZoneId, ZoneView>;
    const piles = Object.fromEntries(PILES.map((pile) => [pile, pileSelector(pile, 0)(traveled)])) as Record<PileId, PileView>;
    const slots = tableLayout(390, 844, views, piles).slots;
    const location = slots.find((slot) => slot.id === made.id);
    const strip = slots.find((slot) => slot.id === loot);
    expect(strip).toMatchObject({ code: "rblade", kind: "attachment", zone: "activeLocation", faceDown: false });
    expect(strip?.y ?? 0).toBeGreaterThan(location?.y ?? 0);
    // A long press on the location, or on the loot card's strip, opens both.
    expect(inspectTargets(traveled, made.id)).toEqual([made.id, loot]);
    expect(inspectTargets(traveled, loot ?? "")).toEqual([made.id, loot]);
    const describeCode = (code: string) => ({ name: code, source: null, text: null });
    const preview = previewCards(traveled, ctx, loot ?? "", describeCode, (id) => id);
    expect(preview.cards.map((card) => [card.name, card.role ?? null])).toEqual([["forest-road", null], ["rblade", "Guarded loot"]]);
    expect(preview.start).toBe(1);
  });
});
