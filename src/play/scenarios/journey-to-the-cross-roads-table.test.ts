// Rules: mec112.setup-journey-to-the-cross-roads (data/rules/entries.json); ledger lines 144027:A:1, 144027:A:2, 144030:A:2, 144068:B:1. What the table says of Journey to the Cross-roads' pieces: the Gate dial (the enemies facedown under The Black
// Gate against the players + 3 at which the players lose, warming toward it, never the accent), the Harad deck dial (the cards left under The Cross-roads and the Threat they take), the enemies drawn under The Black Gate as one counted
// peek, and the Harad deck as the second slot's pile. The engine decided each number; nothing here changes one.
import { describe, expect, it } from "vitest";

import { settle } from "../../rules/engine/machine.ts";
import { syncConstants } from "../../rules/interpret/constants.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import { tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";

import { tableLayout, type LayoutViews, type PileViews } from "../layout/layout.ts";
import { dialProps, type TableDial } from "../readouts/dials.ts";
import { roadsDials } from "../readouts/roads.ts";
import { PILES, TABLE_ZONES, pileSelector, secondPilesOf, zoneSelector } from "../store/selectors.ts";
import { PILE_WORDS } from "../store/pile-ids.ts";
import { zoneFactsOf } from "../store/zone-facts.ts";
import { gateWords, haradWords } from "../words/scenarios/roads.ts";

const ID = "journey-to-the-cross-roads";
const GATE = "144027";
const table = (layout: Layout = {}) => tableFromLayout(ID, layout);
const names = (made: ReturnType<typeof table>) => (code: string) => made.cards.get(code)?.name ?? code;
const under = (...codes: string[]) => codes.map((code) => ({ code, to: GATE }));
const dialsOf = (layout: Layout): readonly TableDial[] => {
  const made = table(layout);
  return roadsDials(syncConstants(made.state, made.ctx), made.ctx, names(made));
};
const dial = (dials: readonly TableDial[], id: string) => dials.find((one) => one.id === id);

describe("the Gate dial", () => {
  it("144027:A:2 shows the enemies facedown under The Black Gate against the players + 3, warming toward it and never the accent", () => {
    const shown = dial(dialsOf({ staging: [GATE], under: under("144057") }), "gate");
    expect(shown).toMatchObject({ label: "Gate", value: 1, limit: 4, testID: "roads-gate", name: "Enemies facedown under The Black Gate, the players lose at 4:", warms: true });
    expect(shown?.goal).toBeUndefined();
    expect(shown?.warn).toBeUndefined();
    expect(shown?.limitWords).toBe(gateWords(1, 4));
    // A warming dial reaches the ring as an elimination-like limit.
    expect(dialProps(shown!)).toMatchObject({ elimination: true, limit: 4, testID: "roads-gate" });
  });

  it("144027:A:2 warns at 2 and at 1 enemy from the loss, driven by the cards left", () => {
    expect(dial(dialsOf({ staging: [GATE], under: under("144057", "144058") }), "gate")?.warn).toEqual({ level: "near", words: "2 more enemies under The Black Gate and the players lose the game" });
    expect(dial(dialsOf({ staging: [GATE], under: under("144057", "144058", "144028") }), "gate")?.warn).toEqual({ level: "critical", words: "1 more enemy under The Black Gate and the players lose the game" });
  });

  it("144027:A:2 reads the limit from the players in the game: 5 with two", () => {
    expect(dial(dialsOf({ seats: 2, staging: [GATE], under: under("144057", "144058", "144028") }), "gate")).toMatchObject({ value: 3, limit: 5, warn: { level: "near" } });
  });

  it("144027:A:1 is not there with no Black Gate in play", () => {
    expect(dial(dialsOf({}), "gate")).toBeUndefined();
  });
});

describe("the Harad deck dial", () => {
  it("144030:A:2 shows the cards left under The Cross-roads and the Threat they take from it", () => {
    const shown = dial(dialsOf({ staging: ["144030"], piles: { haradDeck: ["144057", "144058", "144028"] } }), "harad");
    expect(shown).toMatchObject({ label: "Harad", value: 3, testID: "roads-harad", name: "Cards facedown under The Cross-roads:" });
    expect(shown?.limit).toBeUndefined();
    expect(shown?.note).toBe(haradWords(3, 6));
    // The last card revealed leaves the pile empty, not undealt: the dial stays at 0.
    const made = table({ staging: ["144030"], piles: { haradDeck: ["144057"] } });
    const emptied = { ...made.state, piles: { ...made.state.piles, haradDeck: [] } };
    expect(dial(roadsDials(syncConstants(emptied, made.ctx), made.ctx, names(made)), "harad")).toMatchObject({ value: 0, note: haradWords(0, 9) });
  });

  it("144068:B:1 follows the deck down by one card at a time and is not there in a game that did not deal it", () => {
    expect(haradWords(1, 8)).toBe("1 card facedown under The Cross-roads; The Cross-roads has 8 Threat. One is revealed each quest phase. The players cannot travel there while any is left, nor before 20 progress is on the stage");
    expect(dial(dialsOf({ staging: ["144030"] }), "harad")).toBeUndefined();
  });
});

describe("the cards on the table", () => {
  const drawn = (layout: Layout): { state: ScenarioState; views: LayoutViews; piles: PileViews } => {
    const made = table(layout);
    const state = settle(made.state, made.ctx, []);
    const facts = zoneFactsOf(made.ctx.cards);
    const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0, facts)(state)])) as unknown as LayoutViews;
    const piles = Object.fromEntries([...PILES, ...secondPilesOf(state)].map((pile) => [pile, pileSelector(pile, 0)(state)])) as unknown as PileViews;
    return { state, views, piles };
  };

  it("144027:A:2 draws the enemies facedown under The Black Gate under it, and with more than one a single peek and the count", () => {
    const one = drawn({ staging: [GATE, "144030"], under: under("144057") });
    const gate = one.views.staging.entries.find((entry) => entry.card.code === GATE);
    expect(gate?.attached.map((card) => [card.code, card.zone, card.face])).toEqual([["144057", "under", "down"]]);
    expect(one.views.staging.entries.find((entry) => entry.card.code === "144030")?.attached).toEqual([]);
    expect(one.views.staging.entries.map((entry) => entry.card.code)).toEqual([GATE, "144030"]);
    const peeks = tableLayout(667, 375, one.views, one.piles, { stacks: true }).slots.filter((slot) => slot.zone === "staging" && slot.kind === "attachment");
    expect(peeks).toHaveLength(1);
    expect(peeks[0]).toMatchObject({ faceDown: true });
    const three = drawn({ staging: [GATE], under: under("144057", "144058", "144028") });
    const stacked = tableLayout(667, 375, three.views, three.piles, { stacks: true }).slots.filter((slot) => slot.zone === "staging" && slot.kind === "attachment");
    expect(stacked).toHaveLength(1);
    expect(stacked[0]).toMatchObject({ faceDown: true, stack: 3 });
  });

  it("144030:A:2 draws the Harad deck as the second slot's pile, with its count, named in the table's words", () => {
    const { state, piles } = drawn({ staging: ["144030"], piles: { haradDeck: ["144057", "144058"] } });
    expect(secondPilesOf(state)).toEqual(["haradDeck"]);
    expect(piles.haradDeck?.ids).toHaveLength(2);
    expect(PILE_WORDS.haradDeck).toBe("Harad deck");
    const layout = tableLayout(667, 375, drawn({ staging: ["144030"], piles: { haradDeck: ["144057", "144058"] } }).views, piles, { stacks: true });
    expect(layout.piles.haradDeck).toBeDefined();
    expect(secondPilesOf(drawn({}).state)).toEqual([]);
  });
});
