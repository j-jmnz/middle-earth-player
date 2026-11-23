// Rules: hob.sack-deck, hob.sack-x (data/rules/entries.json); ledger lines 131023:A:1, 131044:A:1. What the table says for We Must Away, Ere Break of Day's Sack deck: a dial with the cards left of the 7, the cards attached, and a warning when the deck is empty; and the deck as a pile of the second slot.
import { describe, expect, it } from "vitest";

import { tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { pileIds, secondPilesOf } from "../../store/pile-ids.ts";

import { sackDials } from "./sack.ts";

const ID = "we-must-away-ere-break-of-day";
const SACKS = ["131044", "131045", "131046", "131047", "131048", "131049", "131050"];
const table = (layout: Parameters<typeof tableFromLayout>[1]) => tableFromLayout(ID, layout, { effects: EFFECTS });

describe("the Sack deck's dial", () => {
  it("counts the cards left of the 7 and those attached to characters", () => {
    const made = table({ piles: { sackDeck: SACKS.slice(0, 5) }, attached: [{ code: "131049", to: "dh1", encounter: true }, { code: "131050", to: "dh2", encounter: true }] });
    const [dial] = sackDials(made.state);
    expect(dial).toMatchObject({ id: "sack", value: 5, limit: 7, label: "Sacks" });
    expect(dial?.note).toBe("5 of the 7 Sack cards are in the Sack deck, 2 attached to characters.");
    expect(dial?.warn).toBeUndefined();
  });

  it("warns when the deck is empty, since Sack X is then ignored", () => {
    const made = table({ attached: [{ code: "131050", to: "dh2", encounter: true }] });
    const [dial] = sackDials({ ...made.state, piles: { ...made.state.piles, sackDeck: [] } });
    expect(dial).toMatchObject({ value: 0, warn: { level: "near", words: "The Sack deck is empty: Sack X is ignored" } });
  });

  it("is absent before the Setup built the deck and in another scenario", () => {
    expect(sackDials(table({}).state)).toEqual([]);
    expect(sackDials({ ...table({ piles: { sackDeck: SACKS } }).state, scenarioId: "the-hills-of-emyn-muil" })).toEqual([]);
  });
});

describe("the Sack deck's pile", () => {
  it("is the one pile of the second slot, a back with its count that opens no list", () => {
    const made = table({ piles: { sackDeck: SACKS } });
    expect(secondPilesOf(made.state)).toEqual(["sackDeck"]);
    expect(pileIds(made.state, "sackDeck", 0)).toHaveLength(7);
  });
});
