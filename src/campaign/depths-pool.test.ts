// Rules: dcce.scalable-upgradable, dcce.campaign-setup-the-thing-in-the-depths, dcce.encounter-cards, rr.victory, rr.destroy, rr.attacks-outside-the-combat-phase (data/rules/entries.json). The cards the campaign
// card of The Thing in the Depths adds: Come Together (an event) and Sea Serpent (a burden, on its Menacing and its Enraged side), on a table of plain-number heroes (test/scenarios/the-thing-in-the-depths/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/interpret/constants.ts";
import { settle } from "../rules/engine/machine.ts";
import { modifiedStat } from "../rules/core/keywords.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { updateCard } from "../rules/core/state.ts";
import { spawn } from "../rules/core/zones.ts";
import { CODES, depthsFight, depthsTable, finish, idOf, loadDepthsWorld, resolveRecords, send, start, type DepthsLayout, type DepthsWorld } from "../../test/scenarios/the-thing-in-the-depths/scene.ts";

let world: DepthsWorld;

beforeAll(async () => {
  world = await loadDepthsWorld();
});

const make = (layout: DepthsLayout = {}) => depthsTable(world, layout);
const stat = (state: ScenarioState, id: string, which: "attack" | "defense" | "willpower" | "threat" | "hitPoints") => modifiedStat(state, state.cards[id]!, which, world.cards);
const withLevels = (state: ScenarioState, levels: Record<string, number>): ScenarioState => ({ ...state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, levels } });

describe("Come Together (11195)", () => {
  // The event is played from the first hand with the first seat's resources; every question is answered with the first option unless a test picks.
  const played = (level: number, chosen: boolean, heroes: readonly string[], pick?: (state: ScenarioState) => string, layout: DepthsLayout = {}) => {
    const made = make({ phase: "Combat", hand: [CODES.comeTogether], play: ["ally", "ally"], ...layout });
    let state = withLevels(made.state, level > 0 ? { [CODES.comeTogether]: level } : {});
    if (chosen) state = { ...state, chosenAtSetup: [{ code: CODES.comeTogether, seat: 0 }] };
    for (const code of heroes) state = spawn(state, code, { zone: "heroes", seat: 0 }).state;
    state = updateCard(state, made.hero, { resources: 2 });
    const card = idOf(state, CODES.comeTogether);
    const run = finish(send(start(state), { type: "PlayCard", cardId: card, payments: [{ heroId: made.hero, amount: 1 }] }, made.ctx), made.ctx, pick);
    return { made, run, card };
  };
  // Picks the next character (not yet chosen) in the order the table lists them, or stops.
  const takes = (count: number) => {
    let left = count;
    return (state: ScenarioState): string => {
      if (state.window?.kind !== "choose") return "";
      const options = state.window.options;
      left -= 1;
      return left >= 0 ? (options.find((option) => option !== "done" && state.cards[option] != null) ?? options.at(-1) ?? "") : (options.find((option) => state.cards[option] == null) ?? options.at(-1) ?? "");
    };
  };

  it("is Scalable: X is its level plus 1 for the copy the campaign card gave this game, and 0 in any other game", () => {
    const zero = played(0, false, []);
    expect(zero.run.state.cards[zero.card]?.zone).toBe("victory");
    const options = (level: number, chosen: boolean) => {
      const made = make({ phase: "Combat", hand: [CODES.comeTogether], play: ["ally", "ally"] });
      let state = withLevels(made.state, level > 0 ? { [CODES.comeTogether]: level } : {});
      if (chosen) state = { ...state, chosenAtSetup: [{ code: CODES.comeTogether, seat: 0 }] };
      state = updateCard(state, made.hero, { resources: 2 });
      const sent = send(start(state), { type: "PlayCard", cardId: idOf(state, CODES.comeTogether), payments: [{ heroId: made.hero, amount: 1 }] }, made.ctx);
      return sent.state.window?.kind === "choose" ? sent.state.window.options.length : 0;
    };
    // With X = 0 nobody is chosen; with X >= 1 the first character is asked for.
    expect(options(0, false)).toBe(0);
    expect(options(0, true)).toBeGreaterThan(0);
    expect(options(2, false)).toBeGreaterThan(0);
  });

  it("gives each chosen character +2 Defense with a Leadership hero, +2 Attack with a Tactics hero and +2 Willpower with a Spirit hero until the end of the round, and goes to the victory display", () => {
    const { made, run, card } = played(1, true, ["hl", "hs"], takes(2));
    expect(run.state.cards[card]?.zone).toBe("victory");
    // X = 1 + 1: two characters are chosen. The first two characters of the table are the heroes of the first seat.
    const chosen = [made.hero, made.hero2].map((id) => ({ id, defense: stat(run.state, id, "defense") - 2, attack: stat(run.state, id, "attack") - 2, willpower: stat(run.state, id, "willpower") - 2 }));
    expect(chosen.every((row) => row.defense === 2 && row.attack === 2 && row.willpower === 2)).toBe(true);
    const bare = played(1, true, [], takes(2));
    // The first seat controls a Tactics hero (the table's own), so only Attack is raised.
    expect([stat(bare.run.state, bare.made.hero, "attack"), stat(bare.run.state, bare.made.hero, "defense"), stat(bare.run.state, bare.made.hero, "willpower")]).toEqual([4, 2, 2]);
  });

  it("heals 2 damage from each chosen character and gives it a Trait of the player's choice with a Lore hero", () => {
    const made = make({ phase: "Combat", hand: [CODES.comeTogether], damage: [["dh1", 5]] });
    let state: ScenarioState = { ...made.state, chosenAtSetup: [{ code: CODES.comeTogether, seat: 0 }] };
    state = spawn(state, "hr", { zone: "heroes", seat: 0 }).state;
    state = updateCard(state, made.hero, { resources: 2 });
    const order = (s: ScenarioState): string => (s.window?.kind === "choose" ? (s.window.options.includes(made.hero) ? made.hero : s.window.options.includes("Hobbit") ? "Hobbit" : (s.window.options.at(-1) ?? "")) : "");
    const run = finish(send(start(state), { type: "PlayCard", cardId: idOf(state, CODES.comeTogether), payments: [{ heroId: made.hero, amount: 1 }] }, made.ctx), made.ctx, order);
    expect(run.state.cards[made.hero]?.damage).toBe(3);
    expect(run.state.modifiers.some((modifier) => modifier.stat === "traitGained" && modifier.instanceId === made.hero)).toBe(true);
  });
});

describe("Sea Serpent (11196)", () => {
  it("has Threat and Defense X, the number of players, on its Menacing side and twice that on its Enraged side (A:2, B:2)", () => {
    for (const seats of [1, 2] as const) {
      const menacing = make({ seats, staging: [CODES.seaSerpent] });
      const id = idOf(menacing.state, CODES.seaSerpent);
      expect([stat(menacing.state, id, "threat"), stat(menacing.state, id, "defense")]).toEqual([seats, seats]);
      expect(stat(menacing.state, id, "attack")).toBe(6);
      expect(stat(menacing.state, id, "hitPoints")).toBe(6);
      const flipped = syncConstants({ ...menacing.state, cards: { ...menacing.state.cards, [id]: { ...menacing.state.cards[id]!, face: "B" as const } } }, menacing.ctx);
      expect([stat(flipped, id, "threat"), stat(flipped, id, "defense")]).toEqual([2 * seats, 2 * seats]);
      expect([stat(flipped, id, "attack"), stat(flipped, id, "hitPoints")]).toEqual([8, 8]);
    }
  });

  it("deals X damage divided among the characters its defending player controls after it attacks and destroys an ally (A:3)", () => {
    const { run, made } = depthsFight(world, "f0", CODES.seaSerpent, { play: ["ally"] }, { defender: (table) => idOf(table.state, "ally") });
    expect(run.state.cards[idOf(run.state, "ally")]?.zone).toBe("discard");
    // X = 1 player: 1 damage on a hero.
    expect((run.state.cards[made.hero]?.damage ?? 0) + (run.state.cards[made.hero2]?.damage ?? 0)).toBe(1);
  });

  it("flips over and is put into the staging area after it is destroyed on its Menacing side (A:4), then scores its Victory 8 when destroyed on its Enraged side", () => {
    const made = make({ phase: "PlayerAttacks", engaged: [{ code: CODES.seaSerpent, seat: 0, damage: 5 }], deck: ["f0"] });
    const serpent = idOf(made.state, CODES.seaSerpent);
    const first = finish(send(start(made.state), { type: "DeclareAttackers", enemyId: serpent, attackerIds: [made.hero, made.hero2] }, made.ctx), made.ctx);
    expect(first.state.cards[serpent]).toMatchObject({ zone: "staging", face: "B", damage: 0 });
    expect(first.state.victory).toEqual([]);
    const enraged = make({ phase: "PlayerAttacks", engaged: [{ code: CODES.seaSerpent, seat: 0, damage: 7 }] });
    const id = idOf(enraged.state, CODES.seaSerpent);
    const flipped = { ...enraged.state, cards: { ...enraged.state.cards, [id]: { ...enraged.state.cards[id]!, face: "B" as const } } };
    const second = finish(send(start(settle(flipped, enraged.ctx, [])), { type: "DeclareAttackers", enemyId: id, attackerIds: [enraged.hero, enraged.hero2] }, enraged.ctx), enraged.ctx);
    expect(second.state.cards[id]?.zone).toBe("victory");
  });

  it("makes an attack against the first player at the end of the round on its Enraged side, from the staging area or engaged with a player (B:4)", () => {
    for (const where of ["staging", "engaged"] as const) {
      const table = make({ seats: 2, ...(where === "staging" ? { staging: [CODES.seaSerpent] } : { engaged: [{ code: CODES.seaSerpent, seat: 1 }] }), deck: ["f0", "f0"] });
      const id = idOf(table.state, CODES.seaSerpent);
      const enraged = settle({ ...table.state, cards: { ...table.state.cards, [id]: { ...table.state.cards[id]!, face: "B" as const } } }, table.ctx, []);
      const run = resolveRecords(enraged, table.ctx, CODES.seaSerpent, "forced", id);
      expect(run.state.pendingAttack, where).toMatchObject({ enemyId: id, seat: 0 });
    }
    const menacing = make({ staging: [CODES.seaSerpent] });
    expect(menacing.ctx.effects.some((effect) => effect.id === "11196:forced:4")).toBe(true);
  });
});
