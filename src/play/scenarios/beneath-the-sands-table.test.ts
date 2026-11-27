// Rules: hrd.track (data/rules/entries.json); ledger lines 17076:A:1, 17079:A:1, 17080:A:1, 17074:A:1 (docs/scenarios/haradrim/beneath-the-sands.md, Table).
// What the table says of Beneath the Sands' pieces: the Search objective is one staging card shown by the face it holds with its resources as tokens, Grabbed by Spiders hangs under the main quest, and no dial or seat mark is added.
// The engine decided each number; nothing here changes one. No control types damage, resources, threat, progress or life.
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout, type Layout } from "../../../test/harness/scene-kit.ts";
import { hitSlot } from "../layout/hits.ts";
import { tableLayout, type LayoutViews, type PileViews } from "../layout/layout.ts";
import { PILES, TABLE_ZONES, pileSelector, secondPilesOf, zoneSelector } from "../store/selectors.ts";
import { zoneFactsOf } from "../store/zone-facts.ts";
import { effectById } from "../../rules/windows/listen.ts";
import { asksOption, type AskFacts } from "../words/asks.ts";
import { ASKS } from "../words/asks/beneath-the-sands.ts";
import { seatMarks, scenarioDials } from "../readouts/scenario-dials.ts";

const MAIN = "17076";
const at = (layout: Layout = {}) => tableFromLayout("beneath-the-sands", { seats: 1, stage: MAIN, phase: "Quest", ...layout });

describe("the Search objective", () => {
  it("17076:A:1 lies in the staging area on the face it holds, with its resources as tokens on the card", () => {
    const t = at({ staging: [{ code: "17079", resources: 2 }] });
    const card = t.state.cards[idOf(t.state, "17079")];
    expect(card).toMatchObject({ zone: "staging", resources: 2 });
  });

  it("17080:A:1 shows On Track as the card's own face, so the table needs no side marker", () => {
    const t = at({ staging: ["17080"] });
    expect(t.state.cards[idOf(t.state, "17080")]?.zone).toBe("staging");
  });
});

describe("Grabbed by Spiders", () => {
  it("17074:A:1 hangs under the main quest card like any attachment the table already draws", () => {
    const t = at({ attached: [{ code: "17074", to: MAIN, encounter: true }] });
    const attachment = t.state.cards[idOf(t.state, "17074")];
    expect(attachment).toMatchObject({ zone: "attached", host: idOf(t.state, MAIN) });
  });

  // The table has stacks off here (no sea, capture or Steward's Fear table), so the quest stage's one counted peek must still be drawn.
  it("17074:A:1 is drawn as one peek under the quest stage at every phone size, within the room the sideways card leaves, and a tap on the peek lands on it", () => {
    const t = at({ attached: [{ code: "17074", to: MAIN, encounter: true }] });
    const facts = zoneFactsOf(t.ctx.cards);
    const views = Object.fromEntries(TABLE_ZONES.map((zone) => [zone, zoneSelector(zone, 0, facts)(t.state)])) as unknown as LayoutViews;
    const piles = Object.fromEntries([...PILES, ...secondPilesOf(t.state)].map((pile) => [pile, pileSelector(pile, 0)(t.state)])) as unknown as PileViews;
    for (const [width, height] of [[667, 375], [844, 390], [1280, 800]] as const) {
      const layout = tableLayout(width, height, views, piles, {});
      const peeks = layout.slots.filter((slot) => slot.zone === "questStage" && slot.kind === "attachment");
      expect(peeks, `${width}x${height}`).toHaveLength(1);
      const peek = peeks[0];
      const stage = layout.zones.questStage;
      const room = (layout.card.h - stage.h) / 2;
      // The peek hangs below the stage by at most the room the row leaves, so it stays short of the active location's column.
      expect((peek?.y ?? 0) - stage.y, `${width}x${height}`).toBeGreaterThan(0);
      expect((peek?.y ?? 0) - stage.y, `${width}x${height}`).toBeLessThanOrEqual(room + 0.5);
      // A tap on the visible strip lands on the attachment, not on the stage.
      const inStrip = hitSlot(layout.slots, stage.x + stage.w / 2, stage.y + stage.h + ((peek?.y ?? 0) - stage.y) / 2);
      expect(layout.slots[inStrip]?.id, `${width}x${height}`).toBe(idOf(t.state, "17074"));
    }
  });
});

describe("what no piece adds", () => {
  it("17076:A:1 adds no dial and no seat mark: the Track tokens and the objective are drawn by the cards", () => {
    const t = at({ staging: [{ code: "17079", resources: 1 }] });
    expect(scenarioDials(t.state, t.ctx, (code) => code)).toEqual([]);
    expect(seatMarks(t.state, t.ctx)).toEqual([]);
  });
});

describe("the choice words", () => {
  const asked = (layout: Layout, id: string, at: number) => {
    const t = tableFromLayout("beneath-the-sands", { seats: 1, stage: MAIN, phase: "Quest", ...layout });
    const choose = effectById(t.ctx, id)?.instructions[at];
    const source = effectById(t.ctx, id)?.cardCode;
    const facts: AskFacts = { game: t.state, ctx: t.ctx, names: { card: (card) => t.ctx.cards.get(t.state.cards[card]?.code ?? card)?.name ?? card, code: (code) => code }, instruction: choose!, effectId: id, source: source && Object.values(t.state.cards).some((card) => card.code === source) ? idOf(t.state, source) : null, options: [] };
    return (option: string) => asksOption(facts, option, ASKS);
  };

  it("17079:A:1 names the location that returns, the topmost one in the discard pile, and says the raise by the resources it counts", () => {
    const row = asked({ staging: [{ code: "17079", resources: 3 }], discard: ["17071", "17072", "f0"] }, "17079:forced:1", 1);
    expect(row("location")?.label).toBe("Return Blocked Passage to the staging area");
    expect(row("threat")?.label).toBe("Each player's threat +3 (3 resources on Off Track)");
    expect(row("threat")?.caution).toBeUndefined();
    expect(asked({ staging: [{ code: "17079", resources: 1 }] }, "17079:forced:1", 1)("threat")?.label).toBe("Each player's threat +1 (1 resource on Off Track)");
    // With no location in the discard pile the row keeps its words (the engine offers only the threat).
    expect(asked({ staging: [{ code: "17079", resources: 1 }] }, "17079:forced:1", 1)("location")?.label).toBe("Return the topmost location in the encounter discard pile to the staging area");
  });

  it("17079:A:1 asks for a second tap when the raise takes the player who chooses to 50", () => {
    expect(asked({ staging: [{ code: "17079", resources: 2 }], threat: [48, 28] }, "17079:forced:1", 1)("threat")?.caution).toBe("Tap again: Player 1 reaches 50 and is eliminated. If no player is left, the game is lost");
    expect(asked({ staging: [{ code: "17079", resources: 2 }], threat: [47, 28] }, "17079:forced:1", 1)("threat")?.caution).toBeUndefined();
  });

  it("17073:A:1 says what the flip does now: it flips from On Track, or changes nothing when Off Track is up or Lost Underground blocks it", () => {
    const flip = (layout: Layout) => asked(layout, "17073:whenRevealed:1", 0)("flip");
    expect(flip({ staging: ["17080"] })?.label).toBe("Flip the Search objective from On Track to Off Track");
    expect(flip({ staging: ["17079"] })?.label).toBe("The Search objective is already Off Track: nothing changes");
    expect(flip({ staging: ["17080", "17075"] })?.label).toBe("The Search objective cannot flip while Lost Underground is in play: nothing changes");
  });

  it("17073:A:1 asks for a second tap and names Grabbed by Spiders' discard and stage 3's progress loss when the flip causes them", () => {
    const grabbed = { code: "17074", to: MAIN, encounter: true as const };
    const flip = (layout: Layout) => asked({ staging: ["17080"], ...layout }, "17073:whenRevealed:1", 0)("flip")?.caution;
    expect(flip({})).toBeUndefined();
    expect(flip({ attached: [grabbed] })).toBe("Tap again: each player discards an ally they control, then Grabbed by Spiders is discarded");
    expect(flip({ stage: "17078", side: "B", progress: 3 })).toBe("Tap again: stage 3 loses all its progress");
    expect(flip({ stage: "17078", side: "B", progress: 3, attached: [{ ...grabbed, to: "17078" }] })).toBe("Tap again: each player discards an ally they control, then Grabbed by Spiders is discarded, and stage 3 loses all its progress");
    // Off Track already up: the flip changes nothing, so it costs nothing.
    expect(asked({ staging: ["17079"], attached: [grabbed] }, "17073:whenRevealed:1", 0)("flip")?.caution).toBeUndefined();
  });
});
