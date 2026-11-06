// Rules: emce.discover, emce.loot, emce.immune, rr.quest-advancement, rr.victory, rr.search, rr.first-player, rr.setup, rr.threat-threat-dial (data/rules/entries.json); ledger lines 19109:A:1, 19109:B:1, 19110:A:1, 19110:B:1, 19110:B:2, 19111:A:1, 19111:B:1 to 19111:B:3.
// The three stages of The Ghost of Framsburg on the scenario's scene: the Setup, the When Revealed effects, the Forced effect of stage 2, what keeps each stage from being defeated, and the win.
import { beforeAll, describe, expect, it } from "vitest";

import { victoryPointsOf } from "../../../rules/core/printed-stat.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { CODES, codesIn, finish, framsburg, framsburgTable, idOf, loadFramsburgWorld, resolveRecords, send, start, withLoot, type FramsburgWorld } from "../../../../test/scenarios/the-ghost-of-framsburg/scene.ts";

let world: FramsburgWorld;
beforeAll(async () => {
  world = await loadFramsburgWorld();
}, 120_000);

type Table = ReturnType<typeof framsburgTable>;
const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const take = (id: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === id) ?? state.window.options[0] ?? "") : "");
const LOOT = [CODES.cryptKey, CODES.oldLantern, CODES.scathaSTeeth];
const settled = (t: Table, state: ScenarioState = t.state): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, t.ctx, []);
const quest = (state: ScenarioState): string | undefined => state.cards[state.questStage ?? ""]?.code;

describe("19109 The Haunted Keep", () => {
  it("19109:A:1 Setup: each player searches the encounter deck for a different location and adds it to the staging area, and the deck is shuffled", () => {
    for (const seats of [1, 2] as const) {
      const t = framsburgTable(world, { seats, stage: "19109", deck: [CODES.moonlitPassage, CODES.moonlitPassage, CODES.hauntedHall, CODES.cursedTower, "f0", "f0"] });
      const before = t.state.encounterDeck.slice();
      const run = resolveRecords(t.state, t.ctx, CODES.stage1, "setup", t.state.questStage ?? "");
      const staged = codesIn(run.state, "staging");
      expect(staged, `${seats} seats`).toHaveLength(seats);
      expect(new Set(staged).size, "different locations").toBe(seats);
      expect(run.state.encounterDeck).toHaveLength(before.length - seats);
      // The deck was shuffled: the shuffle moved the seed along.
      expect(run.state.seedCursor).toBeGreaterThan(t.state.seedCursor);
    }
  });

  it("19109:A:1 the Cursed Tomb is set aside, out of play, by the scenario's piles, not shuffled into the deck", () => {
    const tomb = framsburg.cards.find((card) => card.code === CODES.theCursedTomb);
    expect(tomb?.pile).toBe("setAside");
  });

  it("19109:B:1 the stage cannot be defeated unless the players control at least 1 Loot objective", () => {
    const blocked = framsburgTable(world, { stage: "19109", progress: 6 });
    expect(quest(settled(blocked))).toBe(CODES.stage1);
    const one = withLoot(framsburgTable(world, { stage: "19109", progress: 6 }), [CODES.cryptKey]);
    expect(quest(settled(one))).toBe(CODES.stage2);
  });

  it("19109:B:1 a Loot objective that is guarded by a location in the staging area is not controlled, so it does not count", () => {
    const t = framsburgTable(world, { stage: "19109", progress: 6, phase: "Travel", staging: [CODES.moonlitPassage], deck: [CODES.cryptKey, "f0"] });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.moonlitPassage) }, t.ctx), t.ctx);
    expect(where(run.state, CODES.cryptKey)[0]?.zone).toBe("staging");
    expect(quest(settled(t, { ...run.state, window: null }))).toBe(CODES.stage1);
  });
});

describe("19110 Searching the Ruins", () => {
  it("19110:A:1 When Revealed: the encounter discard pile is shuffled into the encounter deck and each player reveals an encounter card", () => {
    const t = framsburgTable(world, { seats: 2, stage: "19110", deck: ["f0", "f0"], discard: ["f3", "f3", "f3"] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage2, "whenRevealed", t.state.questStage ?? "");
    expect(run.state.encounterDiscard.filter((id) => run.state.cards[id]?.code === "f3")).toEqual([]);
    expect(run.state.staging.length + run.state.encounterDiscard.length + run.state.encounterDeck.length).toBeGreaterThanOrEqual(5);
    // Two cards were revealed (one for each player): the two f0 or f3 cards are in the staging area.
    expect(run.state.staging).toHaveLength(2);
    expect(run.state.encounterDeck).toHaveLength(3);
  });

  it("19110:B:1 Forced: at the beginning of the quest phase the first player chooses: raise each player's threat by 2", () => {
    const t = framsburgTable(world, { seats: 2, stage: "19110", threat: [30, 35], deck: ["f0", CODES.moonlitPassage] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage2, "forced", t.state.questStage ?? "", take("threat"));
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([32, 37]);
    expect(codesIn(run.state, "staging")).toEqual([]);
  });

  it("19110:B:1 or cards are discarded from the top of the encounter deck until a location is, and that location is added to the staging area", () => {
    const t = framsburgTable(world, { stage: "19110", threat: [30, 35], deck: ["f0", "f3", CODES.moonlitPassage, "f0"] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage2, "forced", t.state.questStage ?? "", take("location"));
    expect(run.state.seats[0]?.threat).toBe(30);
    expect(codesIn(run.state, "staging")).toEqual([CODES.moonlitPassage]);
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f0", "f3"]);
    expect(codesIn(run.state, "encounterDeck")).toEqual(["f0"]);
  });

  it("19110:B:1 the first player chooses, whoever is asked", () => {
    const t = framsburgTable(world, { seats: 2, stage: "19110", threat: [30, 35], deck: ["f0", CODES.moonlitPassage] });
    const second = { ...t.state, firstPlayer: 1 };
    const run = resolveRecords(second, t.ctx, CODES.stage2, "forced", t.state.questStage ?? "");
    expect(run.state.window ?? null).toBeNull();
    const asked = framsburgTable(world, { seats: 2, stage: "19110", deck: ["f0"] });
    const pending = resolveRecords({ ...asked.state, firstPlayer: 1 }, asked.ctx, CODES.stage2, "forced", asked.state.questStage ?? "", (state) => (state.window?.kind === "choose" ? (state.window.seat === 1 ? "threat" : "location") : ""));
    expect(pending.state.seats[0]?.threat).toBe(30);
  });

  it("19110:B:2 the stage cannot be defeated unless the players control at least 2 Loot objectives", () => {
    for (const [loot, advances] of [[0, false], [1, false], [2, true], [3, true]] as const) {
      const t = withLoot(framsburgTable(world, { stage: "19110", progress: 12 }), LOOT.slice(0, loot));
      expect(quest(settled(t)), `${loot} Loot objectives`).toBe(advances ? CODES.stage3 : CODES.stage2);
    }
  });
});

describe("19111 The Cursed Shade", () => {
  it("19111:A:1 When Revealed: the first player adds The Cursed Tomb to the staging area; each other player searches the encounter deck and discard pile for a non-unique Undead enemy and adds it to the staging area; the deck is shuffled", () => {
    const t = framsburgTable(world, { seats: 2, stage: "19111", setAside: [CODES.theCursedTomb], deck: ["f0", CODES.framSShade, CODES.cryptStalker, "f0"], discard: [CODES.evilSpectre] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage3, "whenRevealed", t.state.questStage ?? "");
    expect(where(run.state, CODES.theCursedTomb)[0]?.zone).toBe("staging");
    const undead = codesIn(run.state, "staging").filter((code) => code !== CODES.theCursedTomb);
    // One Undead enemy for the second player: a non-unique one (never Fram's Shade).
    expect(undead).toHaveLength(1);
    expect([CODES.cryptStalker, CODES.evilSpectre]).toContain(undead[0]);
    expect(where(run.state, CODES.framSShade)[0]?.zone).toBe("encounterDeck");
  });

  it("19111:A:1 alone, the first player adds the Tomb and nobody searches", () => {
    const t = framsburgTable(world, { stage: "19111", setAside: [CODES.theCursedTomb], deck: ["f0", CODES.cryptStalker] });
    const run = resolveRecords(t.state, t.ctx, CODES.stage3, "whenRevealed", t.state.questStage ?? "");
    expect(codesIn(run.state, "staging")).toEqual([CODES.theCursedTomb]);
  });

  it("19111:A:1 the first player is the one who adds the Tomb, wherever the token is", () => {
    const t = framsburgTable(world, { seats: 2, stage: "19111", setAside: [CODES.theCursedTomb], deck: [CODES.cryptStalker, "f0"] });
    const run = resolveRecords({ ...t.state, firstPlayer: 1 }, t.ctx, CODES.stage3, "whenRevealed", t.state.questStage ?? "");
    expect(codesIn(run.state, "staging").sort()).toEqual([CODES.cryptStalker, CODES.theCursedTomb].sort());
  });

  it("19111:B:1 Fram's Shade is immune to player card effects", () => {
    const t = framsburgTable(world, { stage: "19111", staging: [CODES.framSShade, CODES.evilSpectre] });
    expect(flagged(t.state, idOf(t.state, CODES.framSShade), "immuneToPlayerCards")).toBe(true);
    expect(flagged(t.state, idOf(t.state, CODES.evilSpectre), "immuneToPlayerCards")).toBe(false);
    const engaged = framsburgTable(world, { stage: "19111", engaged: [{ code: CODES.framSShade, seat: 0 }] });
    expect(flagged(engaged.state, idOf(engaged.state, CODES.framSShade), "immuneToPlayerCards")).toBe(true);
    // Before stage 3 it is not.
    const early = framsburgTable(world, { stage: "19110", staging: [CODES.framSShade] });
    expect(flagged(early.state, idOf(early.state, CODES.framSShade), "immuneToPlayerCards")).toBe(false);
  });

  it("19111:B:2 while The Cursed Tomb is in the victory display, Fram's Shade gains victory 6", () => {
    const without = framsburgTable(world, { stage: "19111", staging: [CODES.framSShade] });
    const withTomb = framsburgTable(world, { stage: "19111", staging: [CODES.framSShade], victory: [CODES.theCursedTomb] });
    const victory = (table: Table) => victoryPointsOf(table.state, idOf(table.state, CODES.framSShade), world.cards);
    expect(victory(without)).toBe(0);
    expect(victory(withTomb)).toBe(6);
  });

  it("19111:B:2 an enemy destroyed with the Tomb in the victory display goes to the victory display with victory 6", () => {
    const t = framsburgTable(world, { stage: "19111", engaged: [{ code: CODES.framSShade, seat: 0 }], victory: [CODES.theCursedTomb] });
    const shade = idOf(t.state, CODES.framSShade);
    const dead = settled(t, updateCard(t.state, shade, { damage: 6 }));
    expect(dead.cards[shade]?.zone).toBe("victory");
    // Without the Tomb in the victory display it is only discarded.
    const bare = framsburgTable(world, { stage: "19111", engaged: [{ code: CODES.framSShade, seat: 0 }] });
    expect(settled(bare, updateCard(bare.state, idOf(bare.state, CODES.framSShade), { damage: 6 })).cards[idOf(bare.state, CODES.framSShade)]?.zone).not.toBe("victory");
  });

  it("19111:B:3 the stage cannot be defeated unless Fram's Shade is in the victory display", () => {
    const blocked = framsburgTable(world, { stage: "19111", progress: 6, victory: [CODES.theCursedTomb] });
    const done = settled(blocked);
    expect(done.stageCleared).toBeFalsy();
    expect(done.questStage).toBe(blocked.state.questStage);
    const free = framsburgTable(world, { stage: "19111", progress: 6, victory: [CODES.theCursedTomb, CODES.framSShade] });
    expect(settled(free).stageCleared).toBe(true);
  });

  it("19111:B:3 when the players defeat the stage they win the game", () => {
    const t = framsburgTable(world, { stage: "19111", progress: 6, victory: [CODES.theCursedTomb, CODES.framSShade] });
    const run = send(start(t.state), { type: "Pass" }, t.ctx);
    expect(settled(t, run.state).stageCleared).toBe(true);
    expect(settled(t, run.state).lost).toBeFalsy();
  });
});
