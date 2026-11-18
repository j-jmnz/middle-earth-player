// A two-sided contract's preview on the table (table-preview.ts, contract-sides.ts): the side it lies on with that side's lines, then its
// other side. The Burglar's Turn (22024) flips to side B at Setup (22024:A:2).
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../effects/authored/families/sidequests.ts";
import { codes, fixtureDefinition } from "../../rules/core/test-fixture.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { reduce, startScenario } from "../../rules/engine/reduce.ts";
import { updateCard, type ScenarioState } from "../../rules/core/state.ts";
import { SIDE_CARDS } from "../../rules/families/sidequests/fixture.ts";
import { previewCards } from "./table-preview.ts";

const filler = codes("f", 20);
const cards = new Map([...SIDE_CARDS, ...filler.map((code) => [code, definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0 })] as const)]);
const ctx = { effects: RECORDS, cards };
const TEXT = "<b>Side A</b>\r\nYou cannot include attachments in your deck.\r\n<b>Side B</b>\r\nThe active location gets +1 quest point.";
const describeCode = (code: string, key = code) => ({ name: code, source: { uri: key }, text: code === "22024" ? TEXT : null });

function started(): ScenarioState {
  const opening = startScenario(
    { seatCount: 1, seed: 7, threatModifier: 0, definition: fixtureDefinition(["stage"]), seats: [{ heroes: ["dwarf"], deck: ["22024", ...filler], loot: ["rblade", "rblade", "rblade"] }], encounterDeck: [], questDeck: ["stage"] },
    ctx,
  );
  const kept = reduce(opening, { type: "Keep" }, ctx);
  return kept.ok ? kept.state : opening;
}

describe("a two-sided contract's preview", () => {
  it("shows the side it lies on, then the other side with its own picture and lines", () => {
    const state = started();
    const contract = Object.values(state.cards).find((card) => card.code === "22024")!;
    expect(contract.face).toBe("B");
    const preview = previewCards(state, ctx, contract.id, describeCode, (id) => id);
    expect(preview.start).toBe(0);
    expect(preview.cards.map((card) => [card.role, card.source, card.text])).toEqual([
      ["Side B", { uri: "22024.B" }, "The active location gets +1 quest point."],
      ["Side A", { uri: "22024" }, "You cannot include attachments in your deck."],
    ]);
    const front: ScenarioState = updateCard(state, contract.id, { face: "A" });
    expect(previewCards(front, ctx, contract.id, describeCode, (id) => id).cards.map((card) => card.role)).toEqual(["Side A", "Side B"]);
  });
});
