// Rules: mec113.phantom, mec113.multiplayer-aragorn, mec113.fellowship-sphere-heroes, rr.initial-threat-level, rr.threat-threat-dial, rr.step-6-4-3, rr.effects, rr.play-and-put-into-play, rr.lasting-effects, rr.travel, rr.quest-advancement, rr.then (data/rules/entries.json);
// ledger lines 145016:A:2, 145016:A:3, 145017:A:3, 145020:A:2, 145026:A:2, 145026:A:3, 145027:A:2, 145028:A:2, 145063:A:1, 145064:A:1, 145064:B:2, 145064:B:3, 145065:A:1, 145065:B:1, 145065:B:2, 145067:A:1, 145022:A:1.
// What a card-spec row cannot hold on The Passing of the Grey Company's own cards: the Fellowship resource only Aragorn's pool holds, the seat flags (a threat that cannot be reduced or fall below its starting level, cards that cannot be played), choices that are or are not offered, a Phantom attack
// that a defender takes, and the stage 3 refusals. Each test title starts with the line it covers (scripts/checks/spec-coverage.test.ts). The grey-company family's own tests are src/rules/families/grey-company/index.test.ts.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { legalIntents, legalTargets } from "../../../rules/engine/reduce.ts";
import { attack, defend, rowProblems, threat, zone, damageOn, type Row } from "../../../../test/harness/card-spec.ts";
import { idOf, idsOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-passing-of-the-grey-company";
const FEAR = "145016";
const STONE = "145017";
const ARAGORN = "145001";
const at = (layout: Layout = {}) => tableFromLayout(ID, layout);
type Made = ReturnType<typeof at>;

// Aragorn joins a seat as one of its heroes with this many resources in his pool.
function withAragorn(made: Made, resources: number, seat = 0): ScenarioState {
  const spawned = spawn(made.state, ARAGORN, { zone: "heroes", seat });
  return syncConstants(updateCard(spawned.state, spawned.id, { resources }), made.ctx);
}

// The record's choice: the options it offered and the one the test takes (the first when none is named).
function choosing(made: Made, state: ScenarioState, code: string, timing: "forced" | "whenRevealed" | "travel", take?: string, source?: string) {
  const offered: string[][] = [];
  const run = resolveRecords(state, made.ctx, code, timing, source, (open) => {
    const options = open.window?.kind === "choose" ? open.window.options : [];
    offered.push([...options]);
    return take != null && options.includes(take) ? take : (options[0] ?? "");
  });
  return { run, offered };
}
const resourcesOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.resources ?? 0;
const lower = (made: Made, state: ScenarioState, amount: number): ScenarioState => runInstruction(state, { verb: "LowerThreat", amount, who: "actor" }, { seat: 0, sourceId: null }, made.ctx, []);
const held = (row: Row): string[] => rowProblems(ID, row, EFFECTS);

describe("Overcome by Fear on a threat dial (145016)", () => {
  it("145016:A:2 the dial's player cannot reduce their threat, and one without the card can", () => {
    const made = at({ play: [FEAR] });
    expect(lower(made, made.state, 3).seats[0]?.threat).toBe(28);
    const free = at();
    expect(lower(free, free.state, 3).seats[0]?.threat).toBe(25);
  });

  it("145016:A:2 bars only the seat the copy hangs on", () => {
    const made = at({ seats: 2, play: [{ code: FEAR, seat: 1 }] });
    expect(lower(made, made.state, 3).seats[0]?.threat).toBe(25);
  });

  it("145016:A:3 the first player's Fellowship resource detaches the copy and sets it aside, after the raise (rr.then)", () => {
    const made = at({ play: [FEAR] });
    const { run, offered } = choosing(made, withAragorn(made, 1), FEAR, "forced", "detach", idOf(made.state, FEAR));
    expect(offered[0]).toEqual(["detach", "keep"]);
    expect(run.state.seats[0]?.threat).toBe(29);
    expect(run.state.cards[idOf(run.state, FEAR)]?.zone).toBe("setAside");
    expect(resourcesOf(run.state, ARAGORN)).toBe(0);
  });

  it("145016:A:3 keeping the copy spends nothing", () => {
    const made = at({ play: [FEAR] });
    const { run } = choosing(made, withAragorn(made, 1), FEAR, "forced", "keep", idOf(made.state, FEAR));
    expect(run.state.cards[idOf(run.state, FEAR)]?.zone).toBe("play");
    expect(resourcesOf(run.state, ARAGORN)).toBe(1);
    expect(run.state.seats[0]?.threat).toBe(29);
  });

  it("145016:A:3 offers no detach without a Fellowship resource: Aragorn with an empty pool, or no Aragorn", () => {
    const made = at({ play: [FEAR] });
    const id = idOf(made.state, FEAR);
    expect(choosing(made, withAragorn(made, 0), FEAR, "forced", undefined, id).offered).toEqual([]);
    expect(choosing(made, made.state, FEAR, "forced", undefined, id).offered).toEqual([]);
  });

  it("145016:A:3 Aragorn goes to the first player (mec113.multiplayer-aragorn), so the second seat as first player may detach its own copy", () => {
    const made = at({ seats: 2, firstPlayer: 1, play: [{ code: FEAR, seat: 1 }] });
    const run = choosing(made, withAragorn(made, 1, 0), FEAR, "forced", "detach", idOf(made.state, FEAR));
    expect(run.offered[0]).toEqual(["detach", "keep"]);
    expect(run.run.state.cards[idOf(run.run.state, FEAR)]?.zone).toBe("setAside");
    expect(run.run.state.seats[1]?.heroes.map((id) => run.run.state.cards[id]?.code)).toContain(ARAGORN);
  });
});

describe("The Stone of Erech (145017)", () => {
  it("145017:A:3 can be travelled to only with 5 progress on stage 3B", () => {
    const short = at({ phase: "Travel", stage: "145065", progress: 4, staging: [STONE] });
    expect(legalTargets(short.state, { type: "Travel" }, short.ctx)).not.toContain(idOf(short.state, STONE));
    const enough = at({ phase: "Travel", stage: "145065", progress: 5, staging: [STONE] });
    expect(legalTargets(enough.state, { type: "Travel" }, enough.ctx)).toContain(idOf(enough.state, STONE));
  });
});

describe("Deadly Road (145020)", () => {
  it("145020:A:2 Travel: spend 1 Fellowship resource, which only Aragorn's pool holds", () => {
    const made = at({ phase: "Travel", staging: ["145020"] });
    expect(legalTargets(made.state, { type: "Travel" }, made.ctx)).not.toContain(idOf(made.state, "145020"));
    const state = withAragorn(made, 1);
    expect(legalTargets(state, { type: "Travel" }, made.ctx)).toContain(idOf(state, "145020"));
  });
});

describe("Blood Runs Chill (145026)", () => {
  const exhausted = (made: Made): ScenarioState => {
    let state = made.state;
    for (const id of [made.hero, made.hero2, ...(made.seat1Hero ? [made.seat1Hero] : [])]) state = updateCard(state, id, { exhausted: true });
    return state;
  };

  it("145026:A:2 each player at 35 threat or higher deals 1 damage to each exhausted character they control, and a player below it takes none", () => {
    const made = at({ seats: 2, threat: [36, 30] });
    const run = resolveRecords(exhausted(made), made.ctx, "145026", "whenRevealed");
    expect(run.state.cards[made.hero]?.damage).toBe(1);
    expect(run.state.cards[made.hero2]?.damage).toBe(1);
    expect(run.state.cards[made.seat1Hero ?? ""]?.damage).toBe(0);
  });

  it("145026:A:2 spares a character that is ready", () => {
    const made = at({ threat: [40, 28] });
    const state = updateCard(made.state, made.hero, { exhausted: true });
    const run = resolveRecords(state, made.ctx, "145026", "whenRevealed");
    expect([run.state.cards[made.hero]?.damage, run.state.cards[made.hero2]?.damage]).toEqual([1, 0]);
  });

  it("145026:A:3 the defending character may ready below 35 threat", () => {
    const row: Row = { line: "145026:A:3", layout: { threat: [34, 28] }, act: attack("f3", { shadow: "145026" }), expect: [] };
    expect(held(row)).toEqual([]);
    const made = at({ threat: [34, 28] });
    expect(flagged(made.state, made.hero, "cannotReady")).toBe(false);
  });
});

describe("The Way is Shut (145027) and Whispers in the Dark (145028)", () => {
  it("145027:A:2 stops progress on the current quest until the end of the round, with the active location still taking it", () => {
    const made = at({ active: "145019", deck: ["f0"] });
    const { run } = choosing(made, made.state, "145027", "whenRevealed", "noProgress");
    expect(flagged(run.state, "table", "noQuestProgress")).toBe(true);
    expect(run.state.modifiers.some((modifier) => modifier.stat === "noQuestProgress" && modifier.until === "endOfRound")).toBe(true);
  });

  it("145027:A:2 offers the Overcome by Fear only while a copy is set aside and the dial holds none", () => {
    const none = at();
    expect(choosing(none, none.state, "145027", "whenRevealed").offered).toEqual([]);
    const spare = at({ setAside: [FEAR] });
    expect(choosing(spare, spare.state, "145027", "whenRevealed").offered[0]).toEqual(["attach", "noProgress"]);
    const full = at({ setAside: [FEAR], play: [FEAR] });
    expect(choosing(full, full.state, "145027", "whenRevealed").offered).toEqual([]);
  });

  it("145028:A:2 reaches a character that enters play later in the round", () => {
    const made = at({ hand: ["ally"] });
    const { run } = choosing(made, made.state, "145028", "whenRevealed");
    const entered = spawn(run.state, "ally", { zone: "play", seat: 0 });
    const state = syncConstants(entered.state, made.ctx);
    expect(modifiedStat(state, state.cards[entered.id]!, "willpower", made.cards)).toBe(0);
    expect(modifiedStat(state, state.cards[made.hero]!, "willpower", made.cards)).toBe(1);
  });
});

describe("The Forbidden Door (145063)", () => {
  const copies = (state: ScenarioState): string[] => idsOf(state, FEAR).map((id) => state.cards[id]?.zone ?? "");

  it("145063:A:1 attaches one copy to each player's dial and removes every copy left: 2 are removed two-handed", () => {
    const made = at({ seats: 2, setAside: [FEAR, FEAR, FEAR, FEAR] });
    const run = resolveRecords(made.state, made.ctx, "145063", "setup", idOf(made.state, "145063"));
    expect(copies(run.state).sort()).toEqual(["play", "play", "removed", "removed"]);
    expect(Object.values(run.state.cards).filter((card) => card.code === FEAR && card.zone === "play").map((card) => card.controller).sort()).toEqual([0, 1]);
  });

  it("145063:A:1 removes 3 copies in a true solo game", () => {
    const made = at({ setAside: [FEAR, FEAR, FEAR, FEAR] });
    const run = resolveRecords(made.state, made.ctx, "145063", "setup", idOf(made.state, "145063"));
    expect(copies(run.state).sort()).toEqual(["play", "removed", "removed", "removed"]);
  });
});

describe("The Paths of the Dead (145064)", () => {
  it("145064:A:1 searches the encounter deck only, so a location in the discard pile is not found", () => {
    const made = at({ stage: "145064", discard: ["145020"] });
    const run = resolveRecords(made.state, made.ctx, "145064", "whenRevealed", idOf(made.state, "145064"));
    expect(run.state.cards[idOf(run.state, "145020")]?.zone).toBe("encounterDiscard");
  });

  it("145064:A:1 finds nothing, adds nothing, when the deck holds no location", () => {
    const made = at({ stage: "145064", deck: ["f0"] });
    const run = resolveRecords(made.state, made.ctx, "145064", "whenRevealed", idOf(made.state, "145064"));
    expect(run.state.staging).toHaveLength(0);
  });

  it("145064:B:2 stops a reduction of threat at the threat the player started with, and not below it", () => {
    const made = at({ stage: "145064", threat: [31, 28] });
    const state = syncConstants({ ...made.state, startingThreat: [28] }, made.ctx);
    expect(lower(made, state, 5).seats[0]?.threat).toBe(28);
    const below = syncConstants({ ...made.state, startingThreat: [30] }, made.ctx);
    expect(lower(made, below, 5).seats[0]?.threat).toBe(30);
  });

  it("145064:B:3 a player who chose not to play cards cannot play one this phase, and the other can", () => {
    const made = at({ stage: "145064", seats: 2, phase: "Planning", hand: ["filler"] });
    const state = { ...made.state, activeSeat: 0, window: { kind: "pass" } } as ScenarioState;
    const playable = (current: ScenarioState, seat: number): boolean => legalIntents({ ...current, activeSeat: seat }, made.ctx).some((intent) => intent.type === "PlayCard");
    expect(playable(state, 0)).toBe(true);
    const barred = syncConstants(runInstruction(state, { verb: "ModifyStat", stat: "cannotPlayCards", amount: 1, until: "endOfPhase", target: "actorSeat" }, { seat: 1, sourceId: idOf(state, "145064") }, made.ctx, []), made.ctx);
    expect(playable(barred, 1)).toBe(false);
    expect(playable(barred, 0)).toBe(true);
  });
});

describe("The Dead are Following (145065)", () => {
  it("145065:A:1 offers the Overcome by Fear to be detached only from a dial that holds one", () => {
    const made = at({ stage: "145065", setAside: [STONE, "145067"] });
    expect(choosing(made, made.state, "145065", "whenRevealed", undefined, idOf(made.state, "145065")).offered).toEqual([]);
    const dialed = at({ stage: "145065", setAside: [STONE, "145067"], play: [FEAR] });
    expect(choosing(dialed, dialed.state, "145065", "whenRevealed", "keep", idOf(dialed.state, "145065")).offered[0]).toEqual(["detach", "keep"]);
  });

  it("145065:A:1 keeping the copy raises no threat", () => {
    const made = at({ stage: "145065", setAside: [STONE, "145067"], play: [FEAR] });
    const { run } = choosing(made, made.state, "145065", "whenRevealed", "keep", idOf(made.state, "145065"));
    expect(run.state.seats[0]?.threat).toBe(28);
    expect(run.state.cards[idOf(run.state, FEAR)]?.zone).toBe("play");
  });

  it("145065:B:1 an Oathbreaker enemy keeps Phantom and its engagement cost while another location is active", () => {
    const made = at({ stage: "145065", active: "145018", staging: ["145022"] });
    expect(flagged(made.state, idOf(made.state, "145022"), "losesPhantom")).toBe(false);
  });

  it("145065:B:1 reaches an Oathbreaker enemy engaged with a player too", () => {
    const made = at({ stage: "145065", active: STONE, engaged: [{ code: "145025", seat: 0 }] });
    expect(flagged(made.state, idOf(made.state, "145025"), "losesPhantom")).toBe(true);
  });

  it("145065:B:2 no progress ever defeats the stage, and the win comes only from exploring the Stone", () => {
    const stage = at({ stage: "145065", progress: 12 });
    expect(legalIntents(stage.state, stage.ctx).some((intent) => intent.type === "Pass")).toBe(true);
    expect(stage.state.stageCleared).toBe(false);
  });
});

describe("Phantom (145022:A:1, 145067:A:1)", () => {
  it("145022:A:1 a defended attack's damage is canceled and the defending player raises their threat by that much", () => {
    const row: Row = { line: "145022:A:1", layout: { play: ["ally"] }, act: [attack("145025", { shadow: "f0" }), defend("ally")], expect: [damageOn("ally", 0), threat(31), zone("ally", "play")] };
    expect(held(row)).toEqual([]);
  });

  it("145022:A:1 an undefended attack raises the threat by the whole Attack", () => {
    const row: Row = { line: "145022:A:1", layout: {}, act: attack("145025", { shadow: "f0", undefended: true }), expect: [damageOn("dh1", 0), threat(32)] };
    expect(held(row)).toEqual([]);
  });

  it("145067:A:1 Army of the Dead's attack of 6 raises the threat by 6 when undefended", () => {
    const row: Row = { line: "145067:A:1", layout: {}, act: attack("145067", { shadow: "f0", undefended: true }), expect: [damageOn("dh1", 0), threat(34)] };
    expect(held(row)).toEqual([]);
  });
});
