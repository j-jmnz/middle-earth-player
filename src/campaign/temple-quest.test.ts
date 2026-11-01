// Rules: dcce.island-map, dcce.exploration, dcce.uncharted, rr.guarded, rr.travel, rr.action, rr.attachment-cards, rr.search (data/rules/entries.json); ledger lines 12067:B:1, 12067:B:2, 12068:A:1, 12068:A:2, 12068:B:3,
// 12068:B:4, 12069:A:1, 12069:A:2, 12070:A:1, 12070:A:3, 12070:A:4, 110077:B:2, 12071:A:1, 12071:A:2, 110078:B:3, 11197:A:3. The quest card, the Temple locations, Temple Guardian, the Gate Key and the secrets: each
// line of the ledger (data/printed/dream-chaser.json) has a record, run on a table that makes it true (scripts/temple-scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/constants.ts";
import { settle } from "../rules/machine.ts";
import { hasKeyword, modifiedStat } from "../rules/keywords.ts";
import { placeQuestProgress } from "../rules/quest.ts";
import { reduce } from "../rules/reduce.ts";
import type { ScenarioState } from "../rules/state.ts";
import { legalIntents } from "../rules/legal.ts";
import { CODES, answer, finish, idOf, loadTempleWorld, send, start, templeTable, type TempleLayout, type TempleWorld } from "../../scripts/temple-scene.ts";

let world: TempleWorld;

beforeAll(async () => {
  world = await loadTempleWorld();
});

// Row by row; the Temple column is the last. Index 6 is row 1, column 1.
const MAP = [
  "12072", "12073", "12074", "11072", "?12068",
  "?11073", "11074", "?12072", "?12073", "?12069",
  "?12074", "?11072", "?11073", "?11074", "?12069",
] as const;
const STOP = { engaged: [{ code: "mild", seat: 0 }] } as const;

function make(layout: TempleLayout = {}) {
  const made = templeTable(world, { map: MAP, at: 6, ...STOP, ...layout });
  return { ...made, state: syncConstants(made.state, made.ctx) };
}
type Table = ReturnType<typeof make>;

const cardOf = (made: Table, state: ScenarioState, index: number) => state.cards[made.cells[index] ?? ""];
const stat = (made: Table, state: ScenarioState, id: string, which: "attack" | "defense" | "threat" | "engagementCost") => modifiedStat(state, state.cards[id]!, which, made.ctx.cards);
const pointsOf = (code: string): number => world.cards.get(code)?.questPoints ?? 0;

// The quest phase gave this much progress: the active location takes its share, the rest is the stage's, and the stage's record asks where it goes (the first option takes the first location).
function quest(made: Table, amount: number, pick?: (state: ScenarioState) => string) {
  const steps: never[] = [];
  const placed = placeQuestProgress({ ...made.state, window: null, mode: "stopped" }, amount, world.cards, steps, () => true, true);
  return finish({ state: settle(placed, made.ctx, steps), steps }, made.ctx, pick);
}

describe("Searching the Island (12067:B:1, 12067:B:2)", () => {
  it("holds the Exploration keyword for the table (B:1)", () => {
    const made = make();
    expect(made.state.modifiers.some((modifier) => modifier.stat === "exploration" && modifier.instanceId === "table")).toBe(true);
    expect(made.state.modifiers.some((modifier) => modifier.stat === "progressToStaging")).toBe(true);
  });

  it("asks the first player where the progress that would go on the stage goes: a location in the staging area, all it can take, and then again for what is left (B:2)", () => {
    // The active location (Cursed Temple, face up) takes its quest points; the 5 left over may go on the neighbors: row 1 column 1's are 1 (Winding Caverns, flipped), 5 (Lost Island), 7 (Lost Island) and 11 (Lost Island).
    const made = make({ cellProgress: [[6, 0]] });
    const points = pointsOf("11074");
    const run = quest(made, points + 5, (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === made.cells[5]) ?? state.window.options[0] ?? "") : ""));
    expect(cardOf(made, run.state, 6)?.progress).toBe(points);
    // A Lost Island has no quest points: it takes everything left (no card takes more than a quest-point total).
    expect(cardOf(made, run.state, 5)?.progress).toBe(5);
    expect(run.state.cards[run.state.questStage ?? ""]?.progress).toBe(0);
    expect(run.steps.filter((step) => step.kind === "progress").length).toBeGreaterThan(0);
  });

  it("splits what a location cannot take between locations, and the first player may keep the rest on the stage", () => {
    // Winding Caverns (index 1, flipped, 6 quest points) takes at most 6.
    const made = make({ cellProgress: [[6, pointsOf("11074")]], phase: "Quest" });
    const run = quest(made, 9, (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === made.cells[1]) ?? state.window.options[0] ?? "") : ""));
    expect(cardOf(made, run.state, 1)?.progress).toBe(6);
    // 3 are left and the first player is asked again: the Lost Island in the choices takes them.
    const left = Object.values(run.state.cards).filter((card) => card.zone === "staging" && card.progress > 0 && card.id !== made.cells[1]);
    expect(left.map((card) => card.progress)).toEqual([3]);
    const keep = quest(made, 9, (state) => (state.window?.kind === "choose" ? (state.window.options.includes(made.cells[1] ?? "") ? (made.cells[1] ?? "") : "keep") : ""));
    expect(cardOf(made, keep.state, 1)?.progress).toBe(6);
    expect(Object.values(keep.state.cards).filter((card) => card.zone === "staging" && card.progress > 0).map((card) => card.id)).toEqual([made.cells[1]]);
  });
});

describe("Temple Guardian (12070:A:1, 12070:A:3, 12070:A:4, 110077:B:2)", () => {
  it("has Threat X, the number of players, and cannot be optionally engaged", () => {
    for (const seats of [1, 2] as const) {
      const made = make({ seats, staging: [CODES.guardian] });
      const guardian = idOf(made.state, CODES.guardian);
      expect(stat(made, made.state, guardian, "threat")).toBe(seats);
      expect(made.state.modifiers.some((modifier) => modifier.stat === "cannotBeOptionallyEngaged" && modifier.instanceId === guardian)).toBe(true);
    }
  });

  it("gets -50 engagement cost while Cursed Temple is the active location, so it engages every player (12070:A:4)", () => {
    const away = make({ staging: [CODES.guardian] });
    // Row 1 column 1 is Cursed Temple (11074): the guardian costs 0.
    expect(stat(away, away.state, idOf(away.state, CODES.guardian), "engagementCost")).toBe(0);
    const elsewhere = make({ staging: [CODES.guardian], at: 7 });
    expect(stat(elsewhere, elsewhere.state, idOf(elsewhere.state, CODES.guardian), "engagementCost")).toBe(50);
  });

  it("reads the same on the original card, and its Campaign Mode only side adds Archery X and Defense X (110077:B:2)", () => {
    const original = make({ staging: [CODES.guardianOriginal], at: 7 });
    expect(stat(original, original.state, idOf(original.state, CODES.guardianOriginal), "engagementCost")).toBe(50);
    const base = make({ seats: 2, staging: [CODES.guardian], at: 7 });
    const id = idOf(base.state, CODES.guardian);
    expect(stat(base, base.state, id, "defense")).toBe(4);
    const flipped = syncConstants({ ...base.state, cards: { ...base.state.cards, [id]: { ...base.state.cards[id]!, face: "B" } } }, base.ctx);
    // Side B prints Defense X (the number of players) in place of 4, Threat X and Archery X, and Attack 5.
    expect(stat(base, flipped, id, "defense")).toBe(2);
    expect(stat(base, flipped, id, "attack")).toBe(5);
    expect(flipped.modifiers.some((modifier) => modifier.stat === "archery" && modifier.instanceId === id && modifier.amount === 2)).toBe(true);
    expect(base.state.modifiers.some((modifier) => modifier.stat === "archery" && modifier.instanceId === id)).toBe(false);
  });
});

describe("the Gate Key (12071:A:1, 12071:A:2, 110078:B:3)", () => {
  it("returns to the staging area, uncontrolled, when Temple Guardian leaves play (rr.guarded)", () => {
    const made = make({ staging: [CODES.guardian], key: "guard", phase: "Combat" });
    const guardian = idOf(made.state, CODES.guardian);
    const key = idOf(made.state, CODES.gateKey);
    expect(made.state.cards[key]).toMatchObject({ zone: "attached", host: guardian });
    const gone = syncConstants(settle({ ...reduceDestroy(made, guardian), window: null }, made.ctx, []), made.ctx);
    expect(gone.cards[guardian]?.zone).toBe("victory");
    expect(gone.cards[key]).toMatchObject({ zone: "staging", controller: null, host: null });
  });

  it("is claimed by a hero that exhausts: the key is attached to it and counts as its attachment (12071:A:1)", () => {
    const made = make({ key: "free", phase: "Planning" });
    const key = idOf(made.state, CODES.gateKey);
    const claim = legalIntents(made.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === key);
    expect(claim).toMatchObject({ effectId: "110078:action:1" });
    const run = answer(send(start(made.state), { type: "Trigger", cardId: key, effectId: "110078:action:1" }, made.ctx), made.ctx);
    expect(run.state.cards[key]).toMatchObject({ zone: "attached", host: made.hero, controller: 0, claimed: true });
    expect(run.state.cards[made.hero]?.exhausted).toBe(true);
  });

  it("cannot be claimed while Temple Guardian holds it", () => {
    const made = make({ staging: [CODES.guardian], key: "guard", phase: "Planning" });
    expect(legalIntents(made.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "110078:action:1")).toBe(false);
  });

  it("looks at the facedown side of a Temple location for 3 resources from the hero it is attached to, exhausting the key and the hero (12071:A:2)", () => {
    const made = make({ key: "hero", phase: "Planning" });
    const key = idOf(made.state, CODES.gateKey);
    // No resources: the Action is not offered.
    expect(legalIntents(made.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "110078:action:2")).toBe(false);
    const paid = { ...made.state, cards: { ...made.state.cards, [made.hero]: { ...made.state.cards[made.hero]!, resources: 3 } } };
    expect(legalIntents(paid, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "110078:action:2")).toBe(true);
    let run = send(start(paid), { type: "Trigger", cardId: key, effectId: "110078:action:2", payments: [{ heroId: made.hero, amount: 3 }] }, made.ctx);
    run = answer(run, made.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === made.cells[9]) ?? state.window.options[0] ?? "") : ""));
    expect(run.state.window).toMatchObject({ kind: "look", cardIds: [made.cells[9]] });
    expect(run.state.cards[key]?.exhausted).toBe(true);
    expect(run.state.cards[made.hero]).toMatchObject({ exhausted: true, resources: 0 });
    // The card stays facedown: nothing on its other side happens.
    expect(run.state.cards[made.cells[9] ?? ""]?.face).toBe("B");
  });
});

// Damage that destroys the enemy, through the rules (keywords.ts).
function reduceDestroy(made: Table, id: string): ScenarioState {
  const card = made.state.cards[id]!;
  return { ...made.state, cards: { ...made.state.cards, [id]: { ...card, damage: 99 } } };
}

describe("the Temple locations (12068, 12069)", () => {
  it("cannot be traveled to without exhausting the Gate Key, which a player must control (12068:B:3)", () => {
    const points = pointsOf("11074");
    const without = make({ cellProgress: [[6, points]], at: 8, map: [...MAP.slice(0, 8), "11074", ...MAP.slice(9)] as string[], phase: "Travel" });
    expect(legalIntents(without.state, without.ctx).some((intent) => intent.type === "Travel")).toBe(false);
    const free = make({ cellProgress: [[8, points]], at: 8, map: [...MAP.slice(0, 8), "11074", ...MAP.slice(9)] as string[], phase: "Travel", key: "free" });
    expect(reduce(free.state, { type: "Travel", locationId: free.cells[9]! }, free.ctx).ok).toBe(false);
  });

  it("flips once it is the active location, and Temple Guardian comes back from the victory display engaged with the player with the highest threat (12068:A:1, 12069:A:2)", () => {
    const map = [...MAP.slice(0, 8), "11074", ...MAP.slice(9)] as string[];
    const made = make({ seats: 2, map, at: 8, cellProgress: [[8, pointsOf("11074")]], phase: "Travel", key: "hero", victory: [CODES.guardian], threat: [30, 35] });
    const key = idOf(made.state, CODES.gateKey);
    const run = finish(send(start(made.state), { type: "Travel", locationId: made.cells[9]! }, made.ctx), made.ctx);
    const state = run.state;
    // Temple Halls (index 9 is the Temple column's row 1) lies faceup now; the Gate Key was exhausted to pay for the travel.
    expect(cardOf(made, state, 9)?.face).toBe("A");
    expect(state.activeLocation).toBe(made.cells[9]);
    expect(state.cards[key]?.exhausted).toBe(true);
    const guardian = Object.values(state.cards).find((card) => card.code === CODES.guardian);
    expect(guardian).toMatchObject({ zone: "engaged", controller: 1 });
  });

  it("asks the first player which of the tied players the Temple Guardian engages (12069:A:2)", () => {
    const map = [...MAP.slice(0, 8), "11074", ...MAP.slice(9)] as string[];
    const made = make({ seats: 2, map, at: 8, cellProgress: [[8, pointsOf("11074")]], phase: "Travel", key: "hero", victory: [CODES.guardian], threat: [32, 32] });
    const run = send(start(made.state), { type: "Travel", locationId: made.cells[9]! }, made.ctx);
    expect(run.state.window).toMatchObject({ kind: "choose", options: ["seat:0", "seat:1"] });
    const done = finish(run, made.ctx, () => "seat:1");
    expect(Object.values(done.state.cards).find((card) => card.code === CODES.guardian)).toMatchObject({ zone: "engaged", controller: 1 });
  });

  it("wins the game when the 8th progress is placed on The Grotto's Entrance (12068:A:2)", () => {
    const made = make({ map: [...MAP.slice(0, 6), "12068", ...MAP.slice(7)] as string[], at: 6 });
    expect(pointsOf("12068")).toBe(8);
    const seven = quest(made, 7);
    expect(seven.state.stageCleared).toBe(false);
    const eight = quest(made, 8);
    expect(cardOf(made, eight.state, 6)?.progress).toBe(8);
    expect(eight.state.stageCleared).toBe(true);
    expect(eight.state.lost).toBe(false);
  });

  it("gives every character -1 Attack and -1 Defense while Temple Halls is the active location (12069:A:1)", () => {
    const halls = make({ map: [...MAP.slice(0, 6), "12069", ...MAP.slice(7)] as string[], at: 6 });
    expect(stat(halls, halls.state, halls.hero, "attack")).toBe(1);
    expect(stat(halls, halls.state, halls.hero, "defense")).toBe(1);
    const away = make();
    expect(stat(away, away.state, away.hero, "attack")).toBe(2);
    expect(hasKeyword(away.state, away.hero, "ranged", away.ctx.cards)).toBe(false);
  });
});

describe("the secrets under the Temple locations (11197:A:3)", () => {
  // The action window of the Travel phase (rr.framework-steps, step 4.2): a pass window, the travel opportunity over.
  const atTemple = (secret: string) => {
    const made = make({ map: [...MAP.slice(0, 9), "12069", ...MAP.slice(10)] as string[], at: 9, secrets: ["", secret, ""], phase: "Travel", campaign: true });
    return { ...made, state: { ...made.state, window: { kind: "pass" as const } } };
  };

  it("is a Travel Action: flips the secret at the active location; Starla comes into play ready under the player who flips it", () => {
    const made = atTemple(CODES.starla);
    const card = idOf(made.state, CODES.campaignCard);
    expect(legalIntents(made.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === card)).toBe(true);
    const run = finish(send(start(made.state), { type: "Trigger", cardId: card, effectId: "11197:action:1" }, made.ctx), made.ctx);
    const starla = Object.values(run.state.cards).find((other) => other.code === CODES.starla);
    expect(starla).toMatchObject({ zone: "play", controller: 0, exhausted: false, face: "up" });
    // It is not a secret any more, so a second flip finds none.
    expect(legalIntents(run.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "11197:action:1")).toBe(false);
  });

  it("engages the player who flips a Recurring Nightmare", () => {
    const made = atTemple(CODES.nightmare);
    const card = idOf(made.state, CODES.campaignCard);
    const run = finish(send(start(made.state), { type: "Trigger", cardId: card, effectId: "11197:action:1" }, made.ctx), made.ctx);
    const enemy = Object.values(run.state.cards).find((other) => other.code === CODES.nightmare);
    expect(enemy).toMatchObject({ zone: "engaged", controller: 0, face: "up" });
  });

  it("is offered only in the Travel phase and only with a secret at the active location", () => {
    const made = atTemple(CODES.starla);
    const quest = { ...made.state, phase: "Quest" as const, mode: "questCommit" as const, window: { kind: "pass" as const } };
    expect(legalIntents(quest, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "11197:action:1")).toBe(false);
    const empty = make({ phase: "Travel", campaign: true });
    expect(legalIntents(empty.state, empty.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "11197:action:1")).toBe(false);
  });
});
