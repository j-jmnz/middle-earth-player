// Rules: hob.venom-poison, hob.unconscious-characters (data/rules/entries.json); ledger lines 132026:A:1, 132027:A:1, 132029:A:2, 132034:A:1. The pick filters `poisoned`, `unconscious`, `mostPoison` and `poison`, the amount `poison`, on tables of Flies and Spiders.
import { describe, expect, it } from "vitest";

import type { PickSpec } from "../../../catalog/boundary.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { spiderTable } from "../../../../test/scenarios/flies-and-spiders/scene.ts";
import { givePoison, makeUnconscious } from "./poison.ts";

const characters = (type: PickSpec["type"] = "character"): PickSpec => ({ type, control: "any" });
const ids = (table: ReturnType<typeof spiderTable>, state: typeof table.state, spec: PickSpec, seat = 0) => pickCandidates(state, spec, seat, [], null, table.ctx);

describe("the pick filters of poison", () => {
  it("`poisoned` keeps the characters with any poison, `false` those with none", () => {
    const t = spiderTable({ seats: 1 });
    const state = givePoison(t.state, t.hero, 1, t.ctx);
    expect(ids(t, state, { ...characters(), poisoned: true })).toEqual([t.hero]);
    expect(ids(t, state, { ...characters(), poisoned: false })).toEqual([t.hero2]);
  });

  it("`unconscious` keeps the unconscious characters, `false` the others", () => {
    const t = spiderTable({ seats: 1 });
    const state = makeUnconscious(t.state, t.hero2, t.ctx);
    expect(ids(t, state, { ...characters(), unconscious: true })).toEqual([t.hero2]);
    expect(ids(t, state, { ...characters(), unconscious: false })).toEqual([t.hero]);
  });

  it("`mostPoison` keeps the characters with the most poison, every character when none is poisoned", () => {
    const t = spiderTable({ seats: 1 });
    expect(ids(t, t.state, { ...characters(), mostPoison: true }).sort()).toEqual([t.hero, t.hero2].sort());
    const state = givePoison(givePoison(t.state, t.hero, 2, t.ctx), t.hero2, 1, t.ctx);
    expect(ids(t, state, { ...characters(), mostPoison: true })).toEqual([t.hero]);
    const tied = givePoison(state, t.hero2, 1, t.ctx);
    expect(ids(t, tied, { ...characters(), mostPoison: true }).sort()).toEqual([t.hero, t.hero2].sort());
  });

  it("`mostPoison` reads every character of the table, the other player's too", () => {
    const t = spiderTable({ seats: 2 });
    const state = givePoison(t.state, t.seat1Hero ?? "", 1, t.ctx);
    expect(ids(t, state, { ...characters(), mostPoison: true })).toEqual([t.seat1Hero]);
  });

  it("the state filter `exhausted` leaves out an unconscious character, which is neither ready nor exhausted", () => {
    const t = spiderTable({ seats: 1 });
    const state = makeUnconscious(t.state, t.hero, t.ctx);
    expect(ids(t, state, { ...characters(), state: "exhausted" })).toEqual([]);
    expect(ids(t, state, { ...characters(), state: "ready" })).toEqual([t.hero2]);
  });
});

describe("the amount `poison`", () => {
  it("is the poison under the card the reference names", () => {
    const t = spiderTable({ seats: 1 });
    const state = givePoison(t.state, t.hero, 3, t.ctx);
    expect(resolveAmount(state, { poison: "picked" }, { actor: 0, sourceId: null, picked: [t.hero] }, t.ctx)).toBe(3);
    expect(resolveAmount(state, { poison: "picked" }, { actor: 0, sourceId: null, picked: [t.hero2] }, t.ctx)).toBe(0);
  });
});

describe("Giant Web and Forest Stream (132026:A:1, 132027:A:1)", () => {
  it("Giant Web takes 1 Willpower, Attack and Defense for each poison from the character that has it, and no other", () => {
    const t = spiderTable({ seats: 1, active: "132026" });
    const stat = (state: typeof t.state, id: string, which: "willpower" | "attack" | "defense") => modifiedStat(state, state.cards[id]!, which, t.cards);
    const poisoned = syncConstants(givePoison(t.state, t.hero, 2, t.ctx), t.ctx);
    for (const which of ["willpower", "attack", "defense"] as const) {
      expect(stat(poisoned, t.hero, which)).toBe(Math.max(0, stat(t.state, t.hero, which) - 2));
      expect(stat(poisoned, t.hero2, which)).toBe(stat(t.state, t.hero2, which));
    }
  });

  it("Forest Stream bars a poisoned character from the quest, and no other", () => {
    const t = spiderTable({ seats: 1, active: "132027" });
    const poisoned = syncConstants(givePoison(t.state, t.hero, 1, t.ctx), t.ctx);
    const barred = (id: string) => poisoned.modifiers.some((modifier) => modifier.instanceId === id && modifier.stat === "cannotQuest" && modifier.amount > 0);
    expect(barred(t.hero)).toBe(true);
    expect(barred(t.hero2)).toBe(false);
  });
});
