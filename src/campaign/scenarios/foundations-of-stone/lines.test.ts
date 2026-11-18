// Rules: dwd.creating-a-staging-area, dwd.joining-another-player, mec109.multiple-staging-areas, ltp.commit-characters, rr.winning-the-game, rr.hit-points, rr.attachment-cards, rr.forced, rr.discard-pile-and-victory-display, rr.removed-from-game (data/rules/entries.json); ledger lines 04113:B:1, 04114:B:2, 04115:B:2, 04116:B:2,
// 04117:B:2, 04118:B:2, 04118:B:3, 04119:A:2, 04120:A:2, 04123:A:3, 04125:A:2, 04127:A:2, 901701:A:2, 901703:A:2, 901707:A:1.
// Foundations of Stone's records that need more than one row: Washed Away! and the stage 4 areas and their join, the ally commit limit, the stage 5 win, the Dwarf clauses, what an attachment on a non-hero gives, Nameless enemies with an attachment a player put on them, the Centipede with one player,
// the Nightmare setup card and Shivering River's Threat in another area.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { announceStageRevealed } from "../../../rules/families/nightmare/setup.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { attack, quest, type Row } from "../../../../test/harness/card-spec.ts";
import { codesIn, finish, idOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "foundations-of-stone";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
type Made = ReturnType<typeof table>;
const played = (layout: Layout, act: Row["act"]) => play(SCENARIO, { line: "", layout, act, expect: [] } satisfies Row, EFFECTS as readonly Effect[], false);
const settled = (state: ScenarioState, made: Made) => syncConstants({ ...state, window: null, mode: "stopped" }, made.ctx);
const stageOf = (state: ScenarioState, seat: number) => state.cards[state.seats[seat]?.stage ?? ""]?.code;
const withPrinted = (made: Made, card: Parameters<typeof definePrinted>[0]) => made.cards.set(card.code, definePrinted(card));

// The table after Washed Away! is revealed, the players' stage 4 cards drawn: `seats` players.
function afterWashedAway(seats: 1 | 2, layout: Layout = {}): { made: Made; state: ScenarioState } {
  const made = table({ seats, stage: "04113", staging: ["f3", "04127"], engaged: ["f0"], active: "04122", discard: ["04127", "04121", "f3", "03035"], deck: ["03036", "04121"], setAside: ["04125", "04126", "04123", "04124", "04120"], ...layout });
  const run = resolveRecords(made.state, made.ctx, "04113", "whenRevealed", idOf(made.state, "04113"));
  return { made, state: settled(run.state, made) };
}

describe("04113 Washed Away!", () => {
  it("04113:B:1 discards the Items and Armor in play (the Cave Torch leaves the game) and every encounter card in play, then makes the enemy and treachery discards and the set-aside set the deck", () => {
    const { made, state } = afterWashedAway(1, { attached: [{ code: "03041", to: "dh1" }, { code: "04119", to: "dh1" }] });
    const torch = Object.values(state.cards).filter((card) => card.code === "03041");
    expect(torch.every((card) => card.zone === "removed")).toBe(true);
    expect(state.activeLocation).toBeNull();
    expect(Object.values(state.cards).filter((card) => card.zone === "engaged")).toHaveLength(0);
    const deck = state.encounterDeck.map((id) => state.cards[id]?.code);
    expect(deck).toEqual(expect.arrayContaining(["04125", "04126", "04123", "04124", "04127"]));
    expect(deck).not.toContain("04121");
    expect(codesIn(state, "removed")).toContain("03036");
    expect(made.state.seats).toHaveLength(2);
  });

  it("04113:B:1 gives a player alone one of the four stage 4 cards in a staging area of his own and removes the other three", () => {
    const { state } = afterWashedAway(1);
    expect(["04114", "04115", "04116", "04117"]).toContain(stageOf(state, 0));
    expect(state.separate).toBe(true);
    expect(codesIn(state, "removed").filter((code) => code.startsWith("0411"))).toHaveLength(3);
  });

  it("04113:B:1 gives each of two players a different stage 4 card, and removes the other two", () => {
    const { state } = afterWashedAway(2);
    expect(stageOf(state, 0)).not.toBe(stageOf(state, 1));
    expect(codesIn(state, "removed").filter((code) => code.startsWith("0411"))).toHaveLength(2);
  });
});

// A stage 4 that has its quest points in progress waits for the beginning of the travel phase, then the player joins another player, or every player goes on to stage 5 together.
function atTravel(seats: 1 | 2, stage: string, points: number, progressOf: readonly number[]): { made: Made; state: ScenarioState } {
  const { made, state } = afterWashedAway(seats);
  let next: ScenarioState = state;
  progressOf.forEach((progress, seat) => {
    const id = state.seats[seat]?.stage ?? "";
    next = updateCard(next, id, { progress, ...(seat === 0 ? { code: stage } : {}) });
  });
  expect(points).toBeGreaterThan(0);
  const steps: EngineStep[] = [];
  const event = { trigger: "beginningOfPhase" as const, seat: null, phase: "Travel" as const };
  const fired = finish({ state: settle(fireForced({ ...next, phase: "Travel", window: null, mode: "stopped" }, event, made.ctx, steps), made.ctx, steps), steps }, made.ctx);
  return { made, state: fired.state };
}

describe("The stage 4 cards' join", () => {
  const joinsOther = (stage: string, points: number) => {
    const { state } = atTravel(2, stage, points, [points, 0]);
    expect(state.seats[0].joined).toBe(1);
    expect(state.separate).toBe(true);
  };
  const alone = (stage: string, points: number) => {
    const { made, state } = atTravel(1, stage, points, [points]);
    expect(state.cards[state.questStage ?? ""]?.code).toBe("04118");
    expect(state.separate).toBeUndefined();
    expect(made.ctx.effects.some((effect) => effect.id === `${stage}:forced:1`)).toBe(true);
  };
  it("04114:B:2 at the beginning of the travel phase a player at 11 progress joins the other player, and a player alone goes on to stage 5", () => {
    joinsOther("04114", 11);
    alone("04114", 11);
  });
  it("04115:B:2 at the beginning of the travel phase a player at 17 progress joins the other player, and a player alone goes on to stage 5", () => {
    joinsOther("04115", 17);
    alone("04115", 17);
  });
  it("04116:B:2 at the beginning of the travel phase a player at 7 progress joins the other player, and a player alone goes on to stage 5", () => {
    joinsOther("04116", 7);
    alone("04116", 7);
  });
  it("04117:B:2 at the beginning of the travel phase a player at 5 progress joins the other player, and a player alone goes on to stage 5", () => {
    joinsOther("04117", 5);
    alone("04117", 5);
  });
  it("04114:B:2 a stage short of its quest points waits", () => {
    const { state } = atTravel(1, "04114", 11, [10]);
    expect(stageOf(state, 0)).toBe("04114");
  });
});

describe("04118 Out of the Depths", () => {
  it("04118:B:2 refuses a commitment of more allies than the heroes committed with them, and accepts one of as many", () => {
    const made = table({ stage: "04118", play: ["ally", "ally"], phase: "Quest" });
    const state = syncConstants(made.state, made.ctx);
    const [hero] = state.seats[0].heroes;
    const [ally, other] = state.seats[0].play;
    const sent = (ids: (string | undefined)[]) => reduce(state, { type: "Commit", cardIds: ids.map((id) => id ?? "") }, made.ctx);
    expect(sent([hero, ally]).ok).toBe(true);
    expect(sent([hero, ally, other]).ok).toBe(false);
    expect(sent([ally]).ok).toBe(false);
  });

  it("04118:B:3 wins the game when the stage is defeated", () => {
    const done = played({ stage: "04118", progress: 8 }, [quest("success")]);
    expect(done.run.state.lost).not.toBe(true);
    expect(done.run.state.stageCleared).toBe(true);
  });
});

describe("Durin's Axe and Helm, Moria Bats, the Nameless Things", () => {
  const settledWith = (layout: Layout, tweak: (made: Made) => void = () => {}) => {
    const made = table(layout);
    tweak(made);
    return { made, state: syncConstants({ ...made.state, window: null, mode: "stopped" }, made.ctx) };
  };
  const dwarf = { code: "dh1", name: "dh1", type: "hero", sphere: "tactics", threat: 8, willpower: 2, attack: 2, defense: 2, health: 6, traits: ["Dwarf"] } as const;

  it("04119:A:2 gives a Dwarf hero +1 Willpower as well as +3 Attack, and a character that is not a hero nothing", () => {
    const { made, state } = settledWith({ attached: [{ code: "04119", to: "dh1" }] }, (made) => withPrinted(made, dwarf));
    expect(modifiedStat(state, state.cards[idOf(state, "dh1")]!, "attack", made.ctx.cards)).toBe(5);
    expect(modifiedStat(state, state.cards[idOf(state, "dh1")]!, "willpower", made.ctx.cards)).toBe(3);
    const ally = settledWith({ play: ["ally"], attached: [{ code: "04119", to: "ally" }] });
    expect(modifiedStat(ally.state, ally.state.cards[idOf(ally.state, "ally")]!, "attack", ally.made.ctx.cards)).toBe(1);
  });

  it("04120:A:2 gives a Dwarf hero +2 hit points as well as +1 Defense, and a character that is not a hero nothing", () => {
    const { made, state } = settledWith({ attached: [{ code: "04120", to: "dh1" }] }, (made) => withPrinted(made, dwarf));
    expect(modifiedStat(state, state.cards[idOf(state, "dh1")]!, "defense", made.ctx.cards)).toBe(3);
    expect(modifiedStat(state, state.cards[idOf(state, "dh1")]!, "hitPoints", made.ctx.cards)).toBe(8);
    const ally = settledWith({ play: ["ally"], attached: [{ code: "04120", to: "ally" }] });
    expect(modifiedStat(ally.state, ally.state.cards[idOf(ally.state, "ally")]!, "defense", ally.made.ctx.cards)).toBe(1);
    expect(modifiedStat(ally.state, ally.state.cards[idOf(ally.state, "ally")]!, "hitPoints", ally.made.ctx.cards)).toBe(2);
  });

  it("04123:A:3 Shadow: a defending player keeps his hand when the attacker is not Nameless", () => {
    const done = played({ hand: ["filler", "filler"] }, attack("f3", { shadow: "04123", undefended: true }));
    expect(done.run.state.seats[0].hand).toHaveLength(2);
  });

  it("04127:A:2 gets no Attack for the enemies engaged with a player while it is in the staging area", () => {
    const { made, state } = settledWith({ staging: ["04127"], engaged: ["f0", "f3"] });
    expect(modifiedStat(state, state.cards[idOf(state, "04127")]!, "attack", made.ctx.cards)).toBe(1);
  });

  it("04125:A:2 counts the printed cost of every attached card, a player's attachment (Forest Snare, cost 3) included, and with any card attached X is not the printed 3", () => {
    const made = table({ engaged: ["04125"], deckOf: ["c2", "c1"] });
    withPrinted(made, { code: "01069", name: "Forest Snare", type: "attachment", sphere: "neutral", cost: 3 });
    const thing = idOf(made.state, "04125");
    const spawned = spawn(made.state, "01069", { zone: "play", seat: 0 });
    const state = syncConstants({ ...attachTo(spawned.state, spawned.id, thing), window: null, mode: "stopped" }, made.ctx);
    expect(modifiedStat(state, state.cards[thing]!, "attack", made.ctx.cards)).toBe(3);
    const zero = table({ engaged: ["04125"], attached: [{ code: "attachment", to: "04125" }] });
    const gone = settle({ ...zero.state, window: null, mode: "stopped" }, zero.ctx, []);
    expect(gone.cards[idOf(zero.state, "04125")]?.zone).toBe("encounterDiscard");
  });
});

describe("Giant Cave Centipede, the Nightmare setup card, Shivering River", () => {
  it("901703:A:2 stays engaged with a player alone, and a staging area shared by both players takes it as a staging card", () => {
    const alone = played({ phase: "Combat", engaged: [{ code: "901703", seat: 0 }] }, { act: "announce", trigger: "endOfPhase" });
    expect(alone.run.state.cards[idOf(alone.run.state, "901703")]?.zone).toBe("engaged");
    const pair = played({ seats: 2, phase: "Combat", engaged: [{ code: "901703", seat: 0 }] }, { act: "announce", trigger: "endOfPhase" });
    expect(pair.run.state.cards[idOf(pair.run.state, "901703")]?.zone).toBe("staging");
  });

  it("901701:A:2 when Washed Away! is revealed the Mount and Artifact attachments in play are discarded and each player discards allies until his allies cost 6 or less", () => {
    const made = table({ nightmare: "901701", stage: "04113" });
    withPrinted(made, { code: "a4", name: "a4", type: "ally", cost: 4, willpower: 1, attack: 1, defense: 1, health: 2 });
    withPrinted(made, { code: "a3", name: "a3", type: "ally", cost: 3, willpower: 1, attack: 1, defense: 1, health: 2 });
    withPrinted(made, { code: "mt", name: "mt", type: "attachment", traits: ["Mount"], cost: 1 });
    let state = spawn(spawn(made.state, "a4", { zone: "play", seat: 0 }).state, "a3", { zone: "play", seat: 0 }).state;
    state = spawn(spawn(state, "a4", { zone: "play", seat: 0 }).state, "mt", { zone: "play", seat: 0 }).state;
    const run = finish({ state: settle({ ...announceStageRevealed(state, idOf(state, "04113"), made.ctx, []), window: null, mode: "stopped" }, made.ctx, []), steps: [] }, made.ctx);
    const allies = Object.values(run.state.cards).filter((card) => card.zone === "play" && ["a3", "a4"].includes(card.code));
    expect(allies.reduce((sum, card) => sum + (card.code === "a4" ? 4 : 3), 0)).toBeLessThanOrEqual(6);
    expect(Object.values(run.state.cards).filter((card) => card.code === "mt" && card.zone === "play")).toHaveLength(0);
  });

  it("901707:A:1 adds Shivering River's Threat to the total in every other staging area, and not twice to its own", () => {
    const { made, state } = afterWashedAway(2, { staging: [], engaged: [], active: undefined, discard: [], deck: ["f0", "f0"] });
    const river = settled(spawn(state, "901707", { zone: "staging", area: 0 }).state, made);
    expect(stagingThreat(river, made.ctx.cards, 1) - stagingThreat(state, made.ctx.cards, 1)).toBe(3);
    expect(stagingThreat(river, made.ctx.cards, 0) - stagingThreat(state, made.ctx.cards, 0)).toBe(3);
  });
});
