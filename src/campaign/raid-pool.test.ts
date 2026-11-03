// Rules: dcce.scalable-upgradable, dcce.campaign-setup-raid-on-the-grey-havens, dcce.encounter-cards, rr.victory, rr.step-3-4 (data/rules/entries.json). The cards the campaign card of Raid on the Grey Havens places or
// the Resolution earns: Black Key (boon), the four Galdor's Counsel, Parrying Cutlass and Throwing Axe, on a table of plain-number heroes (test/scenarios/raid-on-the-grey-havens/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/interpret/constants.ts";
import { modifiedStat } from "../rules/core/keywords.ts";
import { legalIntents, type PlayerIntent, type ScenarioState } from "../rules/engine/reduce.ts";
import { settle } from "../rules/engine/machine.ts";
import { updateCard } from "../rules/core/state.ts";
import { attachTo, moveCard, spawn } from "../rules/core/zones.ts";
import { CODES, finish, idOf, idsOf, loadRaidWorld, raidTable, send, start, type RaidLayout, type RaidWorld } from "../../test/scenarios/raid-on-the-grey-havens/scene.ts";

let world: RaidWorld;

beforeAll(async () => {
  world = await loadRaidWorld();
});

const make = (layout: RaidLayout = {}) => raidTable(world, layout);
const cardOf = (state: ScenarioState, code: string, at = 0) => state.cards[idsOf(state, code)[at] ?? ""];
const stat = (state: ScenarioState, id: string, which: "attack" | "defense" | "willpower") => modifiedStat(state, state.cards[id]!, which, world.cards);
const withLevels = (state: ScenarioState, levels: Record<string, number>): ScenarioState => ({ ...state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, levels } });
const tokens = (state: ScenarioState, id: string, patch: { resources?: number; damage?: number }): ScenarioState => updateCard(state, id, patch);

describe("Black Key (boon, 11183)", () => {
  it("gives the attached character +1 Willpower, +1 Attack and +1 Defense (A:2)", () => {
    const made = make({ calphon: true });
    const calphon = made.calphon ?? "";
    const bare = make({ calphon: false, play: [] });
    void bare;
    const base = world.cards.get(CODES.calphon);
    expect(stat(made.state, calphon, "willpower")).toBe((base?.willpower ?? 0) + 1);
    expect(stat(made.state, calphon, "attack")).toBe((base?.attack ?? 0) + 1);
    expect(stat(made.state, calphon, "defense")).toBe((base?.defense ?? 0) + 1);
  });

  it("is removed from the game when it leaves play (A:1)", () => {
    const made = make({ calphon: true });
    const key = idOf(made.state, CODES.blackKey);
    const left = moveCard(made.state, key, { zone: "discard", seat: 0 });
    const settled = settle({ ...left, window: { kind: "pass" } }, made.ctx, []);
    expect(settled.cards[key]?.zone).toBe("removed");
  });

  it("on its Upgraded side places 1 resource on the attached character after it quests successfully (B:3), and exhausts to remove 3 resources from it and ready it (B:4)", () => {
    const made = make({ calphon: true });
    const key = idOf(made.state, CODES.blackKey);
    const calphon = made.calphon ?? "";
    const upgraded = syncConstants({ ...made.state, cards: { ...made.state.cards, [key]: { ...made.state.cards[key]!, face: "B" as const }, [calphon]: { ...made.state.cards[calphon]!, resources: 3, exhausted: true } }, phase: "Planning" as const, window: { kind: "pass" as const }, mode: "planning" as const }, made.ctx);
    const actions = legalIntents(upgraded, made.ctx).filter((intent) => intent.type === "Trigger" && intent.cardId === key);
    expect(actions.length).toBeGreaterThan(0);
    const acted = send(start(upgraded), { type: "Trigger", cardId: key, effectId: "11183:action:1", payments: [{ heroId: calphon, amount: 3 }] } as PlayerIntent, made.ctx);
    expect(acted.state.cards[calphon]).toMatchObject({ resources: 0, exhausted: false });
    expect(acted.state.cards[key]?.exhausted).toBe(true);
  });
});

describe("Galdor's Counsel (11184 to 11187)", () => {
  // The event is played from the first hand with the seat's resources; the answers are the first option.
  const played = (code: string, levels: Record<string, number>, layout: RaidLayout = {}, pick?: (state: ScenarioState) => string) => {
    // One copy of this card was chosen at the Setup unless the layout says otherwise (RaidLayout.chosen).
    const made = make({ phase: "Combat", hand: [code], chosen: [[code, 0]], ...layout });
    const hand = withLevels(made.state, levels);
    const stocked = tokens(tokens(hand, made.hero, { resources: 2 }), made.hero2, { resources: 0 });
    const card = idOf(stocked, code);
    const cost = world.cards.get(code)?.cost ?? 0;
    const payments = cost > 0 ? [{ heroId: made.hero, amount: cost }] : [];
    const run = finish(send(start(stocked), { type: "PlayCard", cardId: card, payments }, made.ctx), made.ctx, pick);
    return { made, run, card };
  };

  it("Leadership adds X resources to any hero's pool, X half its level rounded up, plus 1 for the copy dealt; and goes to the victory display", () => {
    const solo = (level: number) => {
      const { made, run } = played(CODES.counselLeadership, { [CODES.counselLeadership]: level });
      // The hero holds 2 resources before and the other none: the pools added to are the difference.
      return (run.state.cards[made.hero]?.resources ?? 0) + (run.state.cards[made.hero2]?.resources ?? 0) - 2;
    };
    expect(solo(0)).toBe(1);
    expect(solo(1)).toBe(2);
    expect(solo(3)).toBe(3);
    expect(solo(5)).toBe(4);
    const { run, card } = played(CODES.counselLeadership, { [CODES.counselLeadership]: 2 });
    expect(run.state.cards[card]?.zone).toBe("victory");
    expect(run.state.victory).toContain(card);
  });

  it("Tactics deals X damage to a non-unique enemy, X its level plus 1 (A:1)", () => {
    for (const level of [0, 2, 4]) {
      const { run } = played(CODES.counselTactics, { [CODES.counselTactics]: level }, { staging: ["f3"] });
      expect(cardOf(run.state, "f3")?.damage ?? 0).toBe(level + 1);
    }
  });

  it("X is plus 1 for each copy the players chose at the Setup, so two chosen copies add 2 to each (11182:A:2)", () => {
    // Tactics at level 2: two copies chosen (one by each seat) deal 2 + 2.
    const both = played(CODES.counselTactics, { [CODES.counselTactics]: 2 }, { seats: 2, staging: ["f3"], chosen: [[CODES.counselTactics, 0], [CODES.counselLeadership, 1]] });
    expect(cardOf(both.run.state, "f3")?.damage ?? 0).toBe(4);
    // Leadership at level 3 (half rounded up is 2): the same two copies make it 4.
    const leadership = played(CODES.counselLeadership, { [CODES.counselLeadership]: 3 }, { seats: 2, chosen: [[CODES.counselTactics, 0], [CODES.counselLeadership, 1]] });
    expect((leadership.run.state.cards[leadership.made.hero]?.resources ?? 0) + (leadership.run.state.cards[leadership.made.hero2]?.resources ?? 0) - 2).toBe(4);
  });

  it("X is its level alone in a game whose Setup chose no copy, as in any later scenario (11182:A:2: for this game)", () => {
    const later = played(CODES.counselTactics, { [CODES.counselTactics]: 2 }, { staging: ["f3"], chosen: [] });
    expect(cardOf(later.run.state, "f3")?.damage ?? 0).toBe(2);
  });

  it("Spirit places X progress on a non-unique location in the staging area, X its level plus 1 (A:1)", () => {
    const { run } = played(CODES.counselSpirit, { [CODES.counselSpirit]: 1 }, { staging: ["place"] });
    expect(cardOf(run.state, "place")?.progress ?? 0).toBe(2);
  });

  it("Lore looks at the top X cards of the deck, X half its level rounded up plus 1, adds any number to the hand, and puts the rest back on the top or the bottom in the order chosen (A:1)", () => {
    const made = make({ phase: "Combat", hand: [CODES.counselLore], chosen: [[CODES.counselLore, 0]], deckOf: ["c1", "c2", "c3", "ally", "event"] });
    const stocked = tokens(withLevels(made.state, { [CODES.counselLore]: 2 }), made.hero, { resources: 2 });
    const card = idOf(stocked, CODES.counselLore);
    const deckCodes = (state: ScenarioState) => state.seats[0]?.deck.map((id) => state.cards[id]?.code);
    const handCodes = (state: ScenarioState) => state.seats[0]?.hand.map((id) => state.cards[id]?.code);
    expect(deckCodes(stocked)?.length).toBe(5);
    const top = deckCodes(stocked)?.slice(0, 2) ?? [];
    let moves = 0;
    // The first of the two looked cards goes to the hand; the other is put on the bottom.
    const answers = (state: ScenarioState): string => {
      const options = state.window?.kind === "choose" ? state.window.options : [];
      if (options.includes("top")) return "top";
      if (options.includes("bottom") && options.includes("top") === false) return "bottom";
      if (options.includes("done")) {
        moves += 1;
        return moves === 1 ? (options.find((id) => id !== "done") ?? "done") : "done";
      }
      return options[0] ?? "";
    };
    const run = finish(send(start(stocked), { type: "PlayCard", cardId: card, payments: [{ heroId: made.hero, amount: 1 }] }, made.ctx), made.ctx, answers);
    expect(handCodes(run.state)).toContain(top[0]);
    const deck = deckCodes(run.state) ?? [];
    expect(deck).toHaveLength(4);
    expect([...deck].sort()).toEqual(["c3", "ally", "event", top[1]].sort());
    expect(run.state.cards[card]?.zone).toBe("victory");
  });
});

describe("Parrying Cutlass (11189)", () => {
  const worn = (side: "up" | "B", resources: number) => {
    const made = make({});
    const spawned = spawn(made.state, CODES.cutlass, { zone: "play", seat: 0 }, side);
    const attached = attachTo(spawned.state, spawned.id, made.hero);
    const state = syncConstants(tokens(attached, made.hero, { resources }), made.ctx);
    return { made, state, id: spawned.id };
  };

  it("gives the attached hero +1 Defense, +2 with 2 or more resources in its pool (A:2)", () => {
    const base = world.cards.get("dh1")?.defense ?? 0;
    expect(stat(worn("up", 0).state, worn("up", 0).made.hero, "defense")).toBe(base + 1);
    expect(stat(worn("up", 1).state, worn("up", 1).made.hero, "defense")).toBe(base + 1);
    expect(stat(worn("up", 2).state, worn("up", 2).made.hero, "defense")).toBe(base + 2);
  });

  it("on its Upgraded side gives +2 Defense, +3 with 2 or more resources (B:2)", () => {
    const base = world.cards.get("dh1")?.defense ?? 0;
    expect(stat(worn("B", 1).state, worn("B", 1).made.hero, "defense")).toBe(base + 2);
    expect(stat(worn("B", 4).state, worn("B", 4).made.hero, "defense")).toBe(base + 3);
  });
});

describe("Throwing Axe (11190)", () => {
  const worn = (side: "up" | "B", damage: number) => {
    const made = make({});
    const spawned = spawn(made.state, CODES.axe, { zone: "play", seat: 0 }, side);
    const attached = attachTo(spawned.state, spawned.id, made.hero);
    return { made, state: syncConstants(tokens(attached, made.hero, { damage }), made.ctx), id: spawned.id };
  };

  it("gives the attached hero +1 Attack, +2 with 2 or more damage on it (A:2)", () => {
    const base = world.cards.get("dh1")?.attack ?? 0;
    expect(stat(worn("up", 0).state, worn("up", 0).made.hero, "attack")).toBe(base + 1);
    expect(stat(worn("up", 1).state, worn("up", 1).made.hero, "attack")).toBe(base + 1);
    expect(stat(worn("up", 2).state, worn("up", 2).made.hero, "attack")).toBe(base + 2);
  });

  it("on its Upgraded side gives +2 Attack, +3 with 2 or more damage, and an Action once a game: 1 damage to an enemy, or the toss the player reports (B:2, B:3)", () => {
    const base = world.cards.get("dh1")?.attack ?? 0;
    expect(stat(worn("B", 0).state, worn("B", 0).made.hero, "attack")).toBe(base + 2);
    expect(stat(worn("B", 3).state, worn("B", 3).made.hero, "attack")).toBe(base + 3);
    const { made, state, id } = worn("B", 0);
    const staged = spawn(state, "f3", { zone: "staging" }).state;
    const ready = { ...staged, phase: "Combat" as const, mode: "combatActions" as const, window: { kind: "pass" as const } };
    const acted = (option: string) => finish(send(start(ready), { type: "Trigger", cardId: id, effectId: "11190:action:1", payments: [] } as PlayerIntent, made.ctx), made.ctx, (current) => (current.window?.kind === "choose" ? (current.window.options.includes(option) ? option : (current.window.options[0] ?? "")) : ""));
    expect(cardOf(acted("damage").state, "f3")?.damage).toBe(1);
    expect(cardOf(acted("hit").state, "f3")?.damage).toBe(4);
    expect(cardOf(acted("miss").state, "f3")?.damage ?? 0).toBe(0);
    // Once a game: the Action is not offered again.
    const after = acted("miss").state;
    expect(legalIntents(after, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === id)).toBe(false);
  });
});
