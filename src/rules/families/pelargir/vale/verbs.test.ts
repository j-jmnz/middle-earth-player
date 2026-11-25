// Rules: ats.setup-the-morgul-vale-to-the-tower, rr.removed-from-game, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 06147:A:2, 06149:A:1
// The engine facts of the two verbs of The Morgul Vale that work on a card by its title, each on the table of the scenario with its own records: progress tokens placed on To the Tower by title, and every Faramir removed from the game at Setup. The cards that use them are tested on their lines in src/campaign/scenarios/the-morgul-vale/.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../core/intents.ts";
import { shadowCards } from "../../../core/zones.ts";
import { idOf, resolveRecords } from "../../../../../test/harness/scene-kit.ts";
import { CODES, run, table, tokens, where } from "../../../../../test/scenarios/the-morgul-vale/table.ts";

const { rearguard, tower, sorcerer, tracker, murzag } = CODES;
const TOWER_NAME = "To the Tower";
const FARAMIRS = { hero: "06081", otherHero: "144002", ally: "01014", otherAlly: "21005" } as const;

describe("PlaceProgressOnNamed", () => {
  it("places the tokens on To the Tower where it lies in the staging area, as one placement the log names", () => {
    const t = table({ staging: [tower] });
    const steps: EngineStep[] = [];
    const placed = run(t, t.state, { verb: "PlaceProgressOnNamed", name: TOWER_NAME, amount: 3 }, { steps });
    expect(tokens(placed)).toBe(3);
    expect(steps.filter((step) => step.kind === "progress")).toEqual([expect.objectContaining({ targetId: idOf(placed, tower), amount: 3 })]);
  });

  it("places nothing, and asks nobody, when no card with the title is in play", () => {
    const t = table({ staging: [murzag] });
    const steps: EngineStep[] = [];
    const placed = run(t, t.state, { verb: "PlaceProgressOnNamed", name: TOWER_NAME, amount: 1 }, { steps });
    expect(steps.filter((step) => step.kind === "progress")).toEqual([]);
    expect(placed.window).toEqual(t.state.window);
  });

  it("is heard once for the three tokens of one placement: a Morgul Sorcerer in the staging area is dealt one shadow card, and one more for the next placement (06149:A:1)", () => {
    const t = table({ staging: [tower, sorcerer], deck: [tracker, tracker, tracker] });
    const one = run(t, t.state, { verb: "PlaceProgressOnNamed", name: TOWER_NAME, amount: 3 });
    expect(shadowCards(one.cards[idOf(one, sorcerer)])).toHaveLength(1);
    const two = run(t, one, { verb: "PlaceProgressOnNamed", name: TOWER_NAME, amount: 1 });
    expect(shadowCards(two.cards[idOf(two, sorcerer)])).toHaveLength(2);
    expect(tokens(two)).toBe(4);
  });

  it("is read from the game's own cards: the count a card reads (`ofNamed`) follows the tokens at once (The Dead City Looms raises threat by them, 06160:A:1)", () => {
    const t = table({ staging: [tower], threat: [30, 30] });
    const placed = run(t, t.state, { verb: "PlaceProgressOnNamed", name: TOWER_NAME, amount: 2 });
    const raised = run(t, placed, { verb: "RaiseThreat", amount: { stat: "progress", ofNamed: TOWER_NAME }, who: "eachSeat" });
    expect(raised.seats[0]?.threat).toBe(32);
  });
});

describe("RemoveAllNamedFromGame", () => {
  const layout = {
    seats: 2 as const,
    staging: [tower],
    heroes: [{ code: FARAMIRS.hero, seat: 0 }],
    play: [{ code: FARAMIRS.ally, seat: 1 }],
    hand: [{ code: FARAMIRS.otherAlly, seat: 0 }],
    deckOf: [{ code: FARAMIRS.otherHero, seat: 1 }],
  };
  const extra = Object.values(FARAMIRS);

  it("removes every Faramir the players own, in play, in a hand and in a deck, with no leaving of play announced", () => {
    const t = table(layout, undefined, extra);
    const steps: EngineStep[] = [];
    const removed = run(t, t.state, { verb: "RemoveAllNamedFromGame", name: "Faramir" }, { steps });
    for (const code of extra) expect(where(removed, code)).toBe("removed");
    expect((removed.pendingEvents ?? []).filter((event) => event.trigger === "leftPlay")).toEqual([]);
    // The other heroes of the seat stay; the removed hero is no longer one of the seat's heroes, and its threat stays on the dial (06147:A:2, Readings).
    expect(removed.seats[0]?.heroes).not.toContain(idOf(removed, FARAMIRS.hero));
    expect(where(removed, "dh1")).toBe("heroes");
    expect(removed.seats[0]?.threat).toBe(t.state.seats[0]?.threat);
  });

  it("leaves a card of another title, and the encounter card Faramir that is no player card, where it lies", () => {
    const t = table({ ...layout, hand: [{ code: FARAMIRS.otherAlly, seat: 0 }, { code: "ally", seat: 0 }] }, undefined, extra);
    const removed = run(t, t.state, { verb: "RemoveAllNamedFromGame", name: "Faramir" });
    expect(where(removed, "ally")).toBe("hand");
  });

  it("is run by To the Tower's own Forced effect when the Setup announces it added to the staging area (06147:A:2)", () => {
    const t = table(layout, undefined, extra);
    const source = idOf(t.state, rearguard);
    const done = resolveRecords(t.state, t.ctx, rearguard, "setup", source);
    for (const code of extra) expect(where(done.state, code)).toBe("removed");
    expect(where(done.state, tower)).toBe("staging");
  });
});
