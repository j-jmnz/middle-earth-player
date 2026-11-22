// Rules: dcce.island-map, dcce.exploration, dcce.uncharted, rr.travel, rr.immune, rr.attachment-cards, rr.action, rr.forced (data/rules/entries.json); ledger lines 12068:B:2, 12069:B:2, 12069:B:3,
// 12069:B:4, 12072:B:2 to 12072:B:4, 12073:B:2 to 12073:B:4, 12074:B:2 to 12074:B:4 (data/printed/dream-chaser.json). The Temple of the Deceived side of the Temple locations and the Lost Island side of
// Jagged Cliffs, Winding Caverns and Jungle Path, each test run on a table of plain-number heroes (test/scenarios/temple-of-the-deceived/scene.ts) and run again with the records of its line left out,
// where the table must come out otherwise.
import { beforeAll, describe, expect, it } from "vitest";

import { reduce } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { CODES, finish, idOf, legalIntents, legalTargets, loadTempleWorld, send, start, templeTable, type TempleLayout, type TempleWorld } from "../../../../test/scenarios/temple-of-the-deceived/scene.ts";

// Power in the Earth (Core Set): "Attach to a location." A player card attachment.
const POWER = "01056";

let world: TempleWorld;

beforeAll(async () => {
  world = await loadTempleWorld();
  for (const [code, card] of await loadPrinted([POWER])) world.cards.set(code, card);
});

// Row by row; the Temple column is the last. Index 6 (row 1, column 1) is Cursed Temple, faceup; index 7 and 9 are replaced by the card a test is about.
const MAP = [
  "12072", "12073", "12074", "11072", "?12068",
  "?11073", "11074", "?12072", "?12073", "?12069",
  "?12074", "?11072", "?11073", "?11074", "?12069",
] as const;
const STOP = { engaged: [{ code: "mild", seat: 0 }] } as const;
const withMap = (...cells: readonly (readonly [number, string])[]): string[] => MAP.map((code, at) => cells.find(([index]) => index === at)?.[1] ?? code);
const make = (layout: TempleLayout = {}) => templeTable(world, { map: MAP, at: 6, ...STOP, ...layout });
const pointsOf = (code: string): number => world.cards.get(code)?.questPoints ?? 0;
const offers = (state: ScenarioState, made: ReturnType<typeof make>, effectId: string): boolean => legalIntents(state, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === effectId);

describe("the Temple of the Deceived side is immune to player card effects (12068:B:2, 12069:B:2)", () => {
  // Northern Tracker: "Response: After Northern Tracker commits to a quest, place 1 progress token on each location in the staging area." With Cursed Temple (index 8) active, the covered Temple
  // location to its right (index 9) and the Lost Island to its left (index 7) stand in the staging area: the Lost Island takes 1, the Temple location none.
  const tracked = (temple: string, without: readonly string[]) => {
    const made = make({ map: withMap([8, "11074"], [9, temple]), at: 8, phase: "Quest", play: [CODES.northernTracker], without });
    const tracker = idOf(made.state, CODES.northernTracker);
    const run = finish(send(send(start(made.state), { type: "Commit", cardIds: [made.hero, tracker] }, made.ctx), { type: "Trigger", cardId: tracker, effectId: "01045:response:1" }, made.ctx), made.ctx);
    expect(made.state.cards[made.cells[9]!]).toMatchObject({ zone: "staging", face: "B" });
    return [run.state.cards[made.cells[7]!]?.progress, run.state.cards[made.cells[9]!]?.progress];
  };

  for (const [line, temple] of [["12068:B:2", "?12068"], ["12069:B:2", "?12069"]] as const) {
    it(`${line} gets no progress from Northern Tracker while the Lost Island next to it does`, () => {
      expect(tracked(temple, [])).toEqual([1, 0]);
      expect(tracked(temple, [line])).not.toEqual([1, 0]);
    });
  }
});

describe("Temple Halls (12069:B:3, 12069:B:4)", () => {
  // Cursed Temple (index 8) is active and full; Temple Halls lies covered to its right (index 9). The first hero holds the Gate Key.
  const atHalls = (without: readonly string[], keyExhausted = false) => {
    const made = make({ map: withMap([8, "11074"]), at: 8, cellProgress: [[8, pointsOf("11074")]], phase: "Travel", key: "hero", without });
    const key = idOf(made.state, CODES.gateKey);
    const state = keyExhausted ? { ...made.state, cards: { ...made.state.cards, [key]: { ...made.state.cards[key]!, exhausted: true } } } : made.state;
    return { made, key, state };
  };

  it("12069:B:3 travel here only by exhausting the Gate Key: the ready key is exhausted, and with it exhausted the travel is refused", () => {
    const outcome = (without: readonly string[]) => {
      const ready = atHalls(without);
      const run = finish(send(start(ready.state), { type: "Travel", locationId: ready.made.cells[9]! }, ready.made.ctx), ready.made.ctx);
      const spent = atHalls(without, true);
      return { active: run.state.activeLocation === ready.made.cells[9], keyExhausted: run.state.cards[ready.key]?.exhausted, refused: !reduce(spent.state, { type: "Travel", locationId: spent.made.cells[9]! }, spent.made.ctx).ok };
    };
    expect(outcome([])).toEqual({ active: true, keyExhausted: true, refused: true });
    expect(outcome(["12069:B:3"])).not.toEqual({ active: true, keyExhausted: true, refused: true });
  });

  it("12069:B:4 flips over after it becomes the active location, showing Temple Halls with no progress", () => {
    const faceAfter = (without: readonly string[]) => {
      const { made, state } = atHalls(without);
      const run = finish(send(start(state), { type: "Travel", locationId: made.cells[9]! }, made.ctx), made.ctx);
      expect(run.state.activeLocation).toBe(made.cells[9]);
      return run.state.cards[made.cells[9]!]?.face;
    };
    expect(faceAfter([])).toBe("A");
    expect(faceAfter(["12069:B:4"])).toBe("B");
  });
});

// The three Lost Island sides print the same three lines: one table each, the card at index 7, to the right of Cursed Temple.
for (const [code, name] of [["12072", "Jagged Cliffs"], ["12073", "Winding Caverns"], ["12074", "Jungle Path"]] as const) {
  describe(`${name}'s Lost Island side (${code}:B:2 to ${code}:B:4)`, () => {
    it(`${code}:B:2 cannot have player card attachments: Power in the Earth may go on a faceup location in the staging area, not on this Lost Island`, () => {
      const hosts = (without: readonly string[]) => {
        const made = make({ map: withMap([7, `?${code}`]), phase: "Planning", hand: [POWER], without });
        const power = idOf(made.state, POWER);
        const targets = legalTargets(made.state, { type: "PlayCard", cardId: power }, made.ctx);
        // Index 1 is Winding Caverns faceup, in the staging area above Cursed Temple.
        expect(targets).toContain(made.cells[1]);
        return targets.includes(made.cells[7]!);
      };
      expect(hosts([])).toBe(false);
      expect(hosts([`${code}:B:2`])).toBe(true);
    });

    it(`${code}:B:3 flips over after it becomes the active location, and the progress on it is gone`, () => {
      const after = (without: readonly string[]) => {
        const made = make({ map: withMap([7, `?${code}`]), cellProgress: [[6, pointsOf("11074")], [7, 2]], phase: "Travel", without });
        const run = finish(send(start(made.state), { type: "Travel", locationId: made.cells[7]! }, made.ctx), made.ctx);
        expect(run.state.activeLocation).toBe(made.cells[7]);
        const card = run.state.cards[made.cells[7]!];
        return [card?.face, card?.progress];
      };
      expect(after([])).toEqual(["A", 0]);
      expect(after([`${code}:B:3`])).not.toEqual(["A", 0]);
    });

    it(`${code}:B:4 removes 4 progress from the Lost Island to look at its facedown side, which stays facedown; not offered with 3 progress`, () => {
      const looked = (without: readonly string[], progress: number) => {
        const made = make({ map: withMap([7, `?${code}`]), cellProgress: [[7, progress]], phase: "Planning", without });
        const cell = made.cells[7]!;
        if (!offers(made.state, made, `${code}:action:1`)) return { offered: false };
        const run = send(start(made.state), { type: "Trigger", cardId: cell, effectId: `${code}:action:1` }, made.ctx);
        return { offered: true, window: run.state.window, progress: run.state.cards[cell]?.progress, face: run.state.cards[cell]?.face, cell };
      };
      const five = looked([], 5);
      expect(five).toMatchObject({ offered: true, window: { kind: "look", cardIds: [five.cell] }, progress: 1, face: "B" });
      expect(looked([], 3)).toEqual({ offered: false });
      expect(looked([], 4)).toMatchObject({ offered: true, progress: 0 });
      expect(looked([`${code}:B:4`], 5)).toEqual({ offered: false });
    });
  });
}
