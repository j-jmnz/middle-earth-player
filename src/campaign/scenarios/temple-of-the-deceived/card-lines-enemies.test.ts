// Rules: rr.the-letter-x, rr.optional-engagement, rr.engagement-check, rr.guarded, rr.objective-cards, rr.action, rr.in-play-and-out-of-play, dcce.campaign-mode (data/rules/entries.json); ledger lines
// 110077:A:1, 110077:A:3, 110077:A:4, 110077:B:4, 110077:B:5, 110078:B:2, 11199:A:2 (data/printed/dream-chaser.json). The Campaign Expansion's Temple Guardian on both sides, its Gate Key on its Campaign
// Mode only side, and Recurring Nightmare leaving play, each test run on a table of plain-number heroes (test/scenarios/temple-of-the-deceived/scene.ts) and run again with the records of its line (and of
// the same line on the card's other side) left out, where the table must come out otherwise.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../../rules/interpret/constants.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { CODES, answer, finish, idOf, legalIntents, legalTargets, loadTempleWorld, send, start, templeTable, type TempleLayout, type TempleWorld } from "../../../../test/scenarios/temple-of-the-deceived/scene.ts";

let world: TempleWorld;

beforeAll(async () => {
  world = await loadTempleWorld();
});

// Row by row; the Temple column is the last. Index 6 (row 1, column 1) is Cursed Temple, faceup; index 7 is Winding Caverns, faceup.
const MAP = [
  "12072", "12073", "12074", "11072", "?12068",
  "?11073", "11074", "12073", "?12073", "?12069",
  "?12074", "?11072", "?11073", "?11074", "?12069",
] as const;
const STOP = { engaged: [{ code: "mild", seat: 0 }] } as const;
const make = (layout: TempleLayout = {}) => templeTable(world, { map: MAP, at: 6, ...STOP, ...layout });
type Table = ReturnType<typeof make>;
const pointsOf = (code: string): number => world.cards.get(code)?.questPoints ?? 0;
// The first card of `code` turned to `face`, and the constants synced again.
const turned = (made: Table, code: string, face: "A" | "B"): ScenarioState => {
  const id = idOf(made.state, code);
  return syncConstants({ ...made.state, cards: { ...made.state.cards, [id]: { ...made.state.cards[id]!, face } } }, made.ctx);
};

describe("Temple Guardian (110077)", () => {
  // "X is the number of players in the game." Side A prints Threat X.
  it("110077:A:1 has Threat X, the number of players, with one player and with two", () => {
    const threats = (without: readonly string[]) => ([1, 2] as const).map((seats) => {
      const made = make({ seats, at: 7, staging: [CODES.guardian], without });
      const state = turned(made, CODES.guardian, "A");
      return modifiedStat(state, state.cards[idOf(state, CODES.guardian)]!, "threat", world.cards);
    });
    expect(threats([])).toEqual([1, 2]);
    expect(threats(["110077:A:1", "110077:B:2"])).not.toEqual([1, 2]);
  });

  // "Cannot be optionally engaged." The optional engagement step offers the other enemy in the staging area, not Temple Guardian.
  for (const [line, face] of [["110077:A:3", "A"], ["110077:B:4", "B"]] as const) {
    it(`${line} cannot be optionally engaged, while another enemy in the staging area can (side ${face})`, () => {
      const offered = (without: readonly string[]) => {
        const made = make({ at: 7, phase: "Encounter", engaged: [], staging: [CODES.guardian, "undead"], without });
        const state = turned(made, CODES.guardian, face);
        const engageable = legalTargets(state, { type: "Engage" }, made.ctx);
        return [engageable.includes(idOf(state, "undead")), engageable.includes(idOf(state, CODES.guardian))];
      };
      expect(offered([])).toEqual([true, false]);
      expect(offered(["110077:A:3", "110077:B:4"])).toEqual([true, true]);
    });
  }

  // "Temple Guardian gets -50 engagement cost while Cursed Temple is the active location." The players travel from Winding Caverns (index 7, full) to Cursed Temple (index 6): the cost drops by 50
  // once Cursed Temple is active, read in the state the Travel intent returns.
  for (const [line, face] of [["110077:A:4", "A"], ["110077:B:5", "B"]] as const) {
    it(`${line} gets -50 engagement cost once the players travel to Cursed Temple, and not before (side ${face})`, () => {
      const costs = (without: readonly string[]) => {
        const made = make({ at: 7, cellProgress: [[7, pointsOf("12073")]], phase: "Travel", staging: [CODES.guardian], without });
        const state = turned(made, CODES.guardian, face);
        const guardian = idOf(state, CODES.guardian);
        const run = send(start(state), { type: "Travel", locationId: made.cells[6]! }, made.ctx);
        expect(run.state.activeLocation).toBe(made.cells[6]);
        return [modifiedStat(state, state.cards[guardian]!, "engagementCost", world.cards), modifiedStat(run.state, run.state.cards[guardian]!, "engagementCost", world.cards)];
      };
      const [before, after] = costs([]);
      // Winding Caverns active gives each enemy +10 engagement cost (12073:A:1); Cursed Temple gives nothing.
      expect(before! - 10 - after!).toBe(50);
      expect(after).toBe(Math.max(0, (world.cards.get(CODES.guardian)?.engagementCost ?? 0) - 50));
      expect(costs(["110077:A:4", "110077:B:5"])[1]).not.toBe(after);
    });
  }
});

describe("Gate Key on its Campaign Mode only side (110078:B:2)", () => {
  // "If unattached, return Gate Key to the staging area and it gains: 'Action: Exhaust a hero to claim Gate Key and attach it to that hero.'"
  const BOTH = ["110078:A:1", "110078:B:2"];

  it("110078:B:2 is claimed by the hero a player exhausts: the key attaches to that hero, the other hero stays ready", () => {
    const claimed = (without: readonly string[]) => {
      const made = make({ key: "free", phase: "Planning", without });
      const state = turned(made, CODES.gateKey, "B");
      const key = idOf(state, CODES.gateKey);
      if (!legalIntents(state, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "110078:action:3")) return null;
      // Two ready heroes: the player chooses the second.
      const run = answer(send(start(state), { type: "Trigger", cardId: key, effectId: "110078:action:3" }, made.ctx), made.ctx, (asked) => (asked.window?.kind === "choose" && asked.window.options.includes(made.hero2) ? made.hero2 : ""));
      return { key: run.state.cards[key], heroes: [run.state.cards[made.hero]?.exhausted, run.state.cards[made.hero2]?.exhausted] };
    };
    const made = make();
    expect(claimed([])).toMatchObject({ key: { zone: "attached", host: made.hero2, controller: 0, claimed: true }, heroes: [false, true] });
    expect(claimed(BOTH)).toBeNull();
  });

  it("110078:B:2 cannot be claimed with no ready hero to exhaust", () => {
    const made = make({ key: "free", phase: "Planning" });
    const faced = turned(made, CODES.gateKey, "B");
    const state = { ...faced, cards: { ...faced.cards, [made.hero]: { ...faced.cards[made.hero]!, exhausted: true }, [made.hero2]: { ...faced.cards[made.hero2]!, exhausted: true } } };
    expect(legalIntents(state, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "110078:action:3")).toBe(false);
    expect(legalIntents(faced, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "110078:action:3")).toBe(true);
  });

  it("110078:B:2 returns to the staging area, unattached and uncontrolled, when Temple Guardian leaves play", () => {
    const after = (without: readonly string[]) => {
      const made = make({ at: 7, staging: [CODES.guardian], key: "guard", phase: "Combat", without });
      const state = turned(made, CODES.gateKey, "B");
      const guardian = idOf(state, CODES.guardian);
      const key = idOf(state, CODES.gateKey);
      expect(state.cards[key]).toMatchObject({ zone: "attached", host: guardian, face: "B" });
      const gone = settle({ ...state, cards: { ...state.cards, [guardian]: { ...state.cards[guardian]!, damage: 99 } }, window: null }, made.ctx, []);
      expect(gone.cards[guardian]?.zone).toBe("victory");
      const card = gone.cards[key];
      return { zone: card?.zone, host: card?.host, controller: card?.controller };
    };
    expect(after([])).toEqual({ zone: "staging", host: null, controller: null });
    expect(after(BOTH)).not.toEqual({ zone: "staging", host: null, controller: null });
  });
});

describe("Recurring Nightmare (11199:A:2)", () => {
  // "When Recurring Nightmare leaves play, shuffle it into any player's deck." It leaves play from the staging area as well as from an engagement area (rr.in-play-and-out-of-play).
  const destroyed = (seats: 1 | 2, without: readonly string[], pick?: (state: ScenarioState) => string) => {
    const made = make({ seats, phase: "Combat", engaged: [{ code: CODES.nightmare, seat: 0 }, { code: "mild", seat: 0 }], deckOf: ["c0", "c1"], without });
    const nightmare = idOf(made.state, CODES.nightmare);
    const watched = settle({ ...made.state, window: null, mode: "stopped" }, made.ctx, []);
    const run = finish({ state: settle(placeDamage(watched, nightmare, 99, world.cards, [], "framework", ruleCause("test")), made.ctx, []), steps: [] }, made.ctx, pick);
    const card = run.state.cards[nightmare];
    return { zone: card?.zone, controller: card?.controller, inDeck: run.state.seats.findIndex((seat) => seat.deck.includes(nightmare)) };
  };

  it("11199:A:2 is shuffled into the player's deck when it is destroyed, with one player", () => {
    expect(destroyed(1, [])).toEqual({ zone: "deck", controller: 0, inDeck: 0 });
    expect(destroyed(1, ["11199:A:2"])).not.toEqual({ zone: "deck", controller: 0, inDeck: 0 });
  });

  it("11199:A:2 goes into any player's deck: with two players the first player chooses the second player's", () => {
    expect(destroyed(2, [], (state) => (state.window?.kind === "choose" && state.window.options.includes("seat:1") ? "seat:1" : ""))).toEqual({ zone: "deck", controller: 1, inDeck: 1 });
  });

  it("11199:A:2 is shuffled into the player's deck when it is discarded from the staging area", () => {
    const discarded = (without: readonly string[]) => {
      const made = make({ phase: "Combat", staging: [CODES.nightmare], deckOf: ["c0", "c1"], without });
      const nightmare = idOf(made.state, CODES.nightmare);
      const watched = settle({ ...made.state, window: null, mode: "stopped" }, made.ctx, []);
      const run = finish({ state: settle(moveCard(watched, nightmare, { zone: "encounterDiscard" }), made.ctx, []), steps: [] }, made.ctx);
      return run.state.cards[nightmare]?.zone;
    };
    expect(discarded([])).toBe("deck");
    expect(discarded(["11199:A:2"])).toBe("encounterDiscard");
  });
});
