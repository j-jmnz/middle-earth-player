// Rules: rr.quest-advancement, rr.setup, rr.forced, rr.victory, rr.engaged, rr.discard-pile-and-victory-display, rr.attacks-outside-the-combat-phase, rr.player-elimination (data/rules/entries.json); ledger lines 19168:A:1 to 19170:B:1.
// The three stages of The Fate of Wilderland on the scenario's scene: each record runs in a real state, and the end of the round is announced the way the engine does. The players win by destroying Urdug (19157:A:3) and lose when The Goblins' Assault holds too much progress (19170:B:1).
import { beforeAll, describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { CODES, STAGES, progressOn, announce, codesIn, idOf, loadWilderlandWorld, resolveRecords, wilderlandTable, type WilderlandWorld } from "../../../../test/scenarios/the-fate-of-wilderland/scene.ts";

let world: WilderlandWorld;
beforeAll(async () => {
  world = await loadWilderlandWorld();
}, 120_000);

type Layout = Parameters<typeof wilderlandTable>[1];
type Table = ReturnType<typeof wilderlandTable>;
const END_OF_ROUND = { trigger: "endOfRound", seat: null, phase: "End of round" } as const;
// The objectives and Urdug in the staging area (the piles place them), The Goblins' Assault holding `progress`, and the cards a test adds.
const fight = (progress: number, staging: NonNullable<Layout>["staging"] = [], extra: Layout = {}): Table =>
  wilderlandTable(world, { ...extra, staging: [{ code: CODES.theGoblinsAssault, progress }, CODES.theHeroesDefense, CODES.urdug, ...(staging ?? [])] });
const stageOf = (state: ScenarioState): string | undefined => state.cards[state.questStage ?? ""]?.code;
const enemiesIn = (state: ScenarioState, zone: string): string[] => codesIn(state, zone).filter((code) => world.cards.get(code)?.type === "enemy");
const ENEMIES = [CODES.goblinTroop, CODES.strayGoblin, CODES.fierceVanguard, CODES.wargRider];

describe("19168 Urdug's Assault (stage 1)", () => {
  it("19168:A:1 Setup: the encounter deck is shuffled and cards are discarded from its top until X enemies, X the number of players, are discarded; they are added to the staging area", () => {
    for (const seats of [1, 2] as const) {
      const t = fight(0, [], { seats, deck: ["place", ENEMIES[0]!, "treachery", ...ENEMIES.slice(1), "place"] });
      const run = resolveRecords(t.state, t.ctx, CODES.stage1, "setup", t.state.questStage ?? undefined);
      // The objectives and Urdug were placed by the piles; the enemies found join them.
      expect(enemiesIn(run.state, "staging").filter((code) => code !== CODES.urdug), `${seats} seats`).toHaveLength(seats);
      expect(codesIn(run.state, "staging")).toEqual(expect.arrayContaining([CODES.theGoblinsAssault, CODES.theHeroesDefense, CODES.urdug]));
      // The cards discarded on the way are not enemies, and only enough were discarded.
      expect(enemiesIn(run.state, "encounterDiscard"), `${seats} seats`).toEqual([]);
      expect(codesIn(run.state, "encounterDeck").length + codesIn(run.state, "encounterDiscard").length + enemiesIn(run.state, "staging").length - 1, `${seats} seats`).toBe(t.state.encounterDeck.length);
    }
  });

  it("19168:A:1 the deck is shuffled with the game's seed before the enemies are found", () => {
    const orders = [1, 2, 3, 4, 5, 6].map((seed) => {
      const t = fight(0, [], { seed, deck: ENEMIES });
      const run = resolveRecords(t.state, t.ctx, CODES.stage1, "setup", t.state.questStage ?? undefined);
      return enemiesIn(run.state, "staging").filter((code) => code !== CODES.urdug).join();
    });
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it("19168:B:1 Forced: at the end of the round The Goblins' Assault gets 1 progress for each enemy in the staging area (Urdug among them), and not for an enemy engaged with a player", () => {
    const t = fight(0, [CODES.goblinTroop, CODES.strayGoblin], { stage: "19168", engaged: [{ code: CODES.fierceVanguard, seat: 0 }] });
    const run = announce(t, t.state, END_OF_ROUND);
    expect(progressOn(run.state, CODES.theGoblinsAssault)).toBe(3);
    expect(stageOf(run.state)).toBe(CODES.stage1);
  });

  it("19168:B:1 then, with 2 progress plus 2 for each player on it, the stage advances to Outflanked", () => {
    for (const [seats, needed] of [[1, 4], [2, 6]] as const) {
      // Urdug alone adds 1 progress: one short of the needed amount stays, the needed amount advances.
      const short = fight(needed - 2, [], { seats, stage: "19168", deck: ENEMIES });
      expect(stageOf(announce(short, short.state, END_OF_ROUND).state), `${seats} seats, short`).toBe(CODES.stage1);
      const enough = fight(needed - 1, [], { seats, stage: "19168", deck: ENEMIES });
      const run = announce(enough, enough.state, END_OF_ROUND);
      expect(stageOf(run.state), `${seats} seats`).toBe(CODES.stage2);
      // Outflanked's When Revealed musters X enemies into the staging area.
      expect(enemiesIn(run.state, "staging").filter((code) => code !== CODES.urdug), `${seats} seats`).toHaveLength(seats);
    }
  });
});

describe("19169 Outflanked (stage 2)", () => {
  it("19169:A:1 When Revealed: the encounter discard pile is shuffled into the encounter deck and cards are discarded from the top until X enemies are discarded; they are added to the staging area", () => {
    for (const seats of [1, 2] as const) {
      const t = fight(0, [], { seats, stage: "19169", deck: ["place", "treachery"], discard: [...ENEMIES, "place"] });
      const run = resolveRecords(t.state, t.ctx, CODES.stage2, "whenRevealed", t.state.questStage ?? undefined);
      expect(enemiesIn(run.state, "staging").filter((code) => code !== CODES.urdug), `${seats} seats`).toHaveLength(seats);
      // The discard pile went back into the deck: what is discarded now was discarded on the way.
      expect(enemiesIn(run.state, "encounterDiscard"), `${seats} seats`).toEqual([]);
      const found = enemiesIn(run.state, "staging").length - 1;
      expect(codesIn(run.state, "encounterDeck").length + codesIn(run.state, "encounterDiscard").length + found, `${seats} seats`).toBe(2 + ENEMIES.length + 1);
    }
  });

  it("19169:B:1 Forced: after an enemy attacks The Goblins' Assault gets 1 progress, whichever enemy attacks and wherever it is", () => {
    const t = fight(0, [CODES.goblinTroop], { stage: "19169", engaged: [{ code: CODES.strayGoblin, seat: 0 }] });
    const attacked = (code: string) => ({ trigger: "attackResolved" as const, seat: 0, cardId: idOf(t.state, code) });
    expect(progressOn(announce(t, t.state, attacked(CODES.strayGoblin)).state, CODES.theGoblinsAssault)).toBe(1);
    expect(progressOn(announce(t, t.state, attacked(CODES.urdug)).state, CODES.theGoblinsAssault)).toBe(1);
    expect(progressOn(announce(t, t.state, attacked(CODES.goblinTroop)).state, CODES.theGoblinsAssault)).toBe(1);
  });

  it("19169:B:2 Forced: at the end of the round the stage advances with 4 progress plus 4 for each player on The Goblins' Assault", () => {
    for (const [seats, needed] of [[1, 8], [2, 12]] as const) {
      const short = fight(needed - 1, [], { seats, stage: "19169" });
      expect(stageOf(announce(short, short.state, END_OF_ROUND).state), `${seats} seats, short`).toBe(CODES.stage2);
      const enough = fight(needed, [], { seats, stage: "19169", deck: ENEMIES });
      const run = announce(enough, enough.state, END_OF_ROUND);
      expect(stageOf(run.state), `${seats} seats`).toBe(CODES.stage3);
      expect(enemiesIn(run.state, "staging").filter((code) => code !== CODES.urdug), `${seats} seats`).toHaveLength(seats);
    }
  });

  it("19169:B:2 the progress is not taken off when the stage advances: the Assault keeps it", () => {
    const t = fight(8, [], { stage: "19169", deck: ENEMIES });
    expect(progressOn(announce(t, t.state, END_OF_ROUND).state, CODES.theGoblinsAssault)).toBe(8);
  });
});

describe("19170 The Final Push (stage 3)", () => {
  it("19170:A:1 When Revealed: the encounter discard pile is shuffled into the encounter deck and X enemies are discarded from the top into the staging area", () => {
    for (const seats of [1, 2] as const) {
      const t = fight(0, [], { seats, stage: "19170", deck: ["place"], discard: ENEMIES });
      const run = resolveRecords(t.state, t.ctx, CODES.stage3, "whenRevealed", t.state.questStage ?? undefined);
      expect(enemiesIn(run.state, "staging").filter((code) => code !== CODES.urdug), `${seats} seats`).toHaveLength(seats);
    }
  });

  it("19170:B:1 Forced: at the end of the round The Goblins' Assault gets 1 progress for each enemy in play, engaged enemies included", () => {
    const t = fight(0, [CODES.goblinTroop], { stage: "19170", engaged: [{ code: CODES.fierceVanguard, seat: 0 }, { code: CODES.wargRider, seat: 0 }] });
    const run = announce(t, t.state, END_OF_ROUND);
    // Urdug and the Troop in the staging area, two engaged.
    expect(progressOn(run.state, CODES.theGoblinsAssault)).toBe(4);
    expect(run.state.lost).toBeFalsy();
  });

  it("19170:B:1 with 8 progress plus 8 for each player on it the players lose the game", () => {
    for (const [seats, needed] of [[1, 16], [2, 24]] as const) {
      // Urdug alone adds 1.
      const nearly = fight(needed - 2, [], { seats, stage: "19170" });
      expect(announce(nearly, nearly.state, END_OF_ROUND).state.lost, `${seats} seats, ${needed - 1}`).toBeFalsy();
      const over = fight(needed - 1, [], { seats, stage: "19170" });
      expect(announce(over, over.state, END_OF_ROUND).state.lost, `${seats} seats, ${needed}`).toBe(true);
    }
  });

  it("19170:B:1 the stage has no quest points: questing never defeats it, and its progress is never an advance", () => {
    const t = fight(0, [], { stage: "19170", progress: 40 });
    const run = announce(t, t.state, END_OF_ROUND);
    expect(run.state.stageCleared).toBeFalsy();
    expect(stageOf(run.state)).toBe(CODES.stage3);
  });
});

describe("the three stages", () => {
  it("are the scenario's quest stages, in order, and Urdug's Assault is the stage the game opens on", () => {
    expect(STAGES).toEqual([CODES.stage1, CODES.stage2, CODES.stage3]);
    expect(fight(0, [], { stage: "19168" }).state.questStage).toBe(idOf(fight(0, [], { stage: "19168" }).state, CODES.stage1));
  });
});
