import { describe, expect, it } from "vitest";

import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { stagingThreat } from "../../quest/quest.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { codesIn, idOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { spawn } from "../../core/zones.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { areaOf } from "./areas.ts";

// Rules: mec109.multiple-staging-areas, mec108.create-staging-area, dwd.creating-a-staging-area, rr.encounter-deck, rr.discard-pile-and-victory-display, rr.removed-from-game (data/rules/entries.json); ledger lines 04113:B:1, 04114:B:1, 04115:B:1, 04116:B:1, 04117:B:1, 901703:A:2, 901707:A:1, 901707:A:2.
// Washed Away!'s random stage 4 draw and the deck it makes, the separate staging areas it creates, Shivering River's Threat and the Centipede's move, on tables of the scenario's own cards.
const table = (layout: Parameters<typeof tableFromLayout>[1] = {}) => tableFromLayout("foundations-of-stone", layout);
const stageOf = (state: ScenarioState, seat: number) => state.cards[state.seats[seat]?.stage ?? ""]?.code;

describe("Washed Away! (04113:B:1)", () => {
  const washed = (layout: Parameters<typeof tableFromLayout>[1] = {}) => {
    const t = table({ stage: "04113", staging: ["f3", "04127"], engaged: ["f0"], active: "04122", discard: ["04127", "04121", "f3", "03035"], deck: ["03036", "04121"], setAside: ["04125", "04126", "04123", "04124", "04120"], ...layout });
    return { t, run: resolveRecords(t.state, t.ctx, "04113", "whenRevealed", idOf(t.state, "04113")) };
  };

  it("04113:B:1 gives a player alone a random stage 4, revealed for him, with a staging area of his own, and removes the other three", () => {
    const { run } = washed();
    const code = stageOf(run.state, 0) ?? "";
    expect(["04114", "04115", "04116", "04117"]).toContain(code);
    expect(run.state.separate).toBe(true);
    expect(codesIn(run.state, "removed").filter((c) => c.startsWith("0411"))).toHaveLength(3);
    expect(run.state.questDeck.map((id) => run.state.cards[id]?.code)).toEqual(["04118"]);
    // The shared stage is done.
    expect(run.state.cards[idOf(run.state, "04113")]?.zone).toBe("setAside");
  });

  it("04113:B:1 gives each of two players a different stage 4, first player first, and the same draws repeat for the same seed", () => {
    const { run } = washed({ seats: 2 });
    const [one, two] = [stageOf(run.state, 0), stageOf(run.state, 1)];
    expect(one).toBeDefined();
    expect(two).toBeDefined();
    expect(one).not.toBe(two);
    expect(codesIn(run.state, "removed").filter((c) => c.startsWith("0411"))).toHaveLength(2);
    expect(stageOf(washed({ seats: 2 }).run.state, 0)).toBe(one);
  });

  it("04113:B:1 discards every Item, Armor, Weapon and Light card and every encounter card in play, and the Cave Torch leaves the game", () => {
    const { run } = washed({ attached: [{ code: "03041", to: "dh1" }, { code: "04119", to: "dh1" }] });
    const torch = Object.values(run.state.cards).find((card) => card.code === "03041");
    expect(torch === undefined || torch.zone === "removed").toBe(true);
    expect(run.state.activeLocation).toBeNull();
    expect(Object.values(run.state.cards).filter((card) => card.zone === "engaged" || (card.zone === "staging" && card.code === "f3"))).toHaveLength(0);
  });

  it("04113:B:1 makes the enemy and treachery cards of the encounter discard pile, with the set-aside Foundations of Stone set, the new deck, and removes every other encounter card", () => {
    const { run } = washed();
    const deck = run.state.encounterDeck.map((id) => run.state.cards[id]?.code).sort();
    // The enemies and treachery discarded (f3 is a stand-in enemy, 04127 an enemy) and the set: 04125, 04126, 04123, 04124 (04120 is an objective, kept set aside).
    expect(deck).toContain("04125");
    expect(deck).toContain("04123");
    expect(deck).toContain("04127");
    expect(deck).not.toContain("04121");
    expect(deck).not.toContain("03036");
    expect(codesIn(run.state, "removed")).toContain("04121");
    expect(codesIn(run.state, "removed")).toContain("03036");
    expect(run.state.encounterDiscard).toHaveLength(0);
  });
});

describe("The separate areas of stage 4", () => {
  it("04114:B:1 and 04117:B:1 reveal 2 and 4 cards into the player's own staging area", () => {
    const t = table({ stage: "04113", deck: ["f0", "f0", "f0", "f0", "f0", "f0", "f0"] });
    const run = resolveRecords(t.state, t.ctx, "04113", "whenRevealed", idOf(t.state, "04113"));
    const code = stageOf(run.state, 0) ?? "";
    const wanted = code === "04117" ? 4 : code === "04116" || code === "04114" ? 2 : 0;
    expect(run.state.seats[0].staging.filter((id) => run.state.cards[id]?.zone === "staging").length).toBeGreaterThanOrEqual(wanted);
  });

  // Two players, each with an area of their own, after Washed Away!.
  const divided = (layout: Parameters<typeof tableFromLayout>[1] = {}) => {
    const t = table({ seats: 2, stage: "04113", ...layout });
    const state = syncConstants({ ...resolveRecords(t.state, t.ctx, "04113", "whenRevealed", idOf(t.state, "04113")).state, window: null, mode: "stopped" }, t.ctx);
    return { t, state };
  };

  it("901707:A:1 adds Shivering River's Threat to the total in every other staging area, once for each area, and not to its own", () => {
    const { t, state } = divided();
    const made = spawn(state, "901707", { zone: "staging", area: 0 });
    const river = syncConstants(made.state, t.ctx);
    const own = stagingThreat(river, t.ctx.cards, 0);
    const other = stagingThreat(river, t.ctx.cards, 1);
    expect(other - stagingThreat(state, t.ctx.cards, 1)).toBe(3);
    expect(own - stagingThreat(state, t.ctx.cards, 0)).toBe(3);
    // Before its flag is read (no constant synced) the other area is unchanged.
    expect(stagingThreat(made.state, t.ctx.cards, 1)).toBe(stagingThreat(state, t.ctx.cards, 1));
  });

  it("901707:A:2 reads one player at the staging area while the areas are separate and two while they are shared", () => {
    const { t, state } = divided();
    const amount = { playersAtStage: true } as const;
    expect(resolveAmount(state, amount, { actor: 0, sourceId: null }, t.ctx)).toBe(1);
    const shared = { ...state, seats: [{ ...state.seats[0], joined: 1 }, state.seats[1]] as ScenarioState["seats"] };
    expect(resolveAmount(shared, amount, { actor: 0, sourceId: null }, t.ctx)).toBe(2);
    expect(resolveAmount(table({ seats: 2 }).state, amount, { actor: 0, sourceId: null }, t.ctx)).toBe(2);
  });

  it("901703:A:2 moves the engaged Giant Cave Centipede to the other player's staging area, and leaves it engaged with one player or shared areas", () => {
    const { t, state } = divided();
    const made = spawn(state, "901703", { zone: "engaged", seat: 0 });
    const run = runInstruction({ ...made.state, window: null }, { verb: "MoveToOtherPlayerArea" }, { seat: 0, sourceId: made.id }, t.ctx, []);
    expect(run.cards[made.id]?.zone).toBe("staging");
    expect(areaOf(run, made.id)).toBe(1);
    const alone = table({ stage: "04113" });
    const solo = spawn(alone.state, "901703", { zone: "engaged", seat: 0 });
    expect(runInstruction({ ...solo.state, window: null }, { verb: "MoveToOtherPlayerArea" }, { seat: 0, sourceId: solo.id }, alone.ctx, []).cards[solo.id]?.zone).toBe("engaged");
    const shared = { ...made.state, seats: [{ ...made.state.seats[0], joined: 1 }, made.state.seats[1]] as ScenarioState["seats"] };
    expect(runInstruction({ ...shared, window: null }, { verb: "MoveToOtherPlayerArea" }, { seat: 0, sourceId: made.id }, t.ctx, []).cards[made.id]?.zone).toBe("engaged");
  });

  it("04114:B:2 holds the stage at its quest points; at the beginning of the travel phase the first player to complete joins the other, and the second takes everyone to stage 5", () => {
    const { t, state } = divided();
    const stages = [state.seats[0].stage ?? "", state.seats[1].stage ?? ""];
    expect(restricted(state, t.ctx, "advance").length).toBeGreaterThan(0);
    const joined = runInstruction({ ...state, window: null }, { verb: "JoinAnotherPlayer", advanceTo: "04118", holdsStage: true }, { seat: 0, sourceId: stages[0] ?? "" }, t.ctx, []);
    expect(joined.seats[0].joined).toBe(1);
    expect(joined.separate).toBe(true);
    const together = runInstruction({ ...joined, window: null }, { verb: "JoinAnotherPlayer", advanceTo: "04118", holdsStage: true }, { seat: 1, sourceId: stages[1] ?? "" }, t.ctx, []);
    expect(together.separate).toBeUndefined();
    expect(together.cards[together.questStage ?? ""]?.code).toBe("04118");
  });

  it("04114:B:2 takes a player alone to stage 5 at once, and a stage at its quest points waits instead of advancing", () => {
    const t = table({ stage: "04113" });
    const alone = syncConstants({ ...resolveRecords(t.state, t.ctx, "04113", "whenRevealed", idOf(t.state, "04113")).state, window: null, mode: "stopped" }, t.ctx);
    const stage = alone.seats[0].stage ?? "";
    const full = { ...alone, cards: { ...alone.cards, [stage]: { ...alone.cards[stage]!, progress: 20 } } };
    expect(modifiedStat(full, full.cards[stage]!, "questPoints", t.ctx.cards)).toBeGreaterThan(0);
    const done = runInstruction({ ...full, window: null }, { verb: "JoinAnotherPlayer", advanceTo: "04118", holdsStage: true }, { seat: 0, sourceId: stage }, t.ctx, []);
    expect(done.cards[done.questStage ?? ""]?.code).toBe("04118");
    expect(done.separate).toBeUndefined();
  });
});
