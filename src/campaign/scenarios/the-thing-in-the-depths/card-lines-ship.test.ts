// Rules: dcce.grapple, dcce.stormcaller-and-the-thing, dcce.setup-the-thing-in-the-depths, rr.travel, rr.search, rr.shadow-effects, rr.lasting-effects, rr.step-6-2, rr.quest-advancement, rr.forced (data/rules/entries.json).
// The quest stages, Helm of the Stormcaller, the Ship locations and Hold Steady! of The Thing in the Depths: the lines card-lines.test.ts holds no row for (a choice, two players, a grappled enemy, a false case, a moment
// a row cannot reach), on the scenario's scene of plain-number heroes (test/scenarios/the-thing-in-the-depths/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { grappledWith } from "../../../rules/families/grapple/values.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { quest, type Row } from "../../../../test/harness/card-spec.ts";
import { CODES, depthsDrive, depthsFight, depthsTable, finish, idOf, idsOf, legalIntents, legalTargets, loadDepthsWorld, resolveRecords, send, start, type DepthsLayout, type DepthsWorld } from "../../../../test/scenarios/the-thing-in-the-depths/scene.ts";

let world: DepthsWorld;

beforeAll(async () => {
  world = await loadDepthsWorld();
});

const make = (layout: DepthsLayout = {}) => depthsTable(world, layout);
const cardOf = (state: ScenarioState, code: string, at = 0) => state.cards[idsOf(state, code)[at] ?? ""];
const defense = (state: ScenarioState, id: string) => modifiedStat(state, state.cards[id]!, "defense", world.cards);
const codesOfDeck = (state: ScenarioState) => state.encounterDeck.map((id) => state.cards[id]?.code ?? "");
// Every hero stays exhausted through the refresh phase, so what exhausted it can be read after the round goes on.
const stayTired = (state: ScenarioState): ScenarioState => ({ ...state, modifiers: [...state.modifiers, ...state.seats.flatMap((seat) => seat.heroes).map((instanceId) => ({ instanceId, sourceId: "t", stat: "doesNotReady" as const, amount: 1, until: "endOfRound" as const }))] });

describe("12039 Take the Ship!", () => {
  it("12039:A:1 shuffles the encounter deck in its Setup", () => {
    const deck = ["f0", "f3", CODES.forecastle, CODES.weatherDeck, CODES.cargoHold, CODES.crewQuarters, CODES.quarterDeck, CODES.holdSteady];
    const made = make({ deck });
    const run = resolveRecords(made.state, made.ctx, "12039", "setup", idOf(made.state, "12039"));
    expect([...codesOfDeck(run.state)].sort()).toEqual([...deck].sort());
    expect(codesOfDeck(run.state)).not.toEqual(deck);
  });

  it("12039:B:3 places progress on the stage once Helm of the Stormcaller is in the victory display", () => {
    const done = play("the-thing-in-the-depths", { line: "", layout: { stage: "12039", victory: [CODES.helm] }, act: quest("success"), expect: [] } satisfies Row, EFFECTS, false);
    const stage = idOf(done.run.state, "12039");
    expect(done.run.steps.some((step) => step.kind === "progress" && step.targetId === stage && step.amount > 0)).toBe(true);
  });
});

describe("12041 Defend the Ship!", () => {
  it("12041:A:1 with 2 players discards until 3 Tentacle enemies are discarded, a Creature that is no Tentacle not counted, and grapples each with the location its keyword names", () => {
    const made = make({ seats: 2, stage: "12041", staging: [CODES.cargoHold, CODES.forecastle], deck: [CODES.eye, CODES.thrashing, CODES.crushing, "f0", CODES.giant, CODES.grasping] });
    const run = resolveRecords(made.state, made.ctx, "12041", "whenRevealed", idOf(made.state, "12041"));
    const cargo = grappledWith(run.state, idOf(run.state, CODES.cargoHold)).map((id) => run.state.cards[id]?.code).sort();
    const forecastle = grappledWith(run.state, idOf(run.state, CODES.forecastle)).map((id) => run.state.cards[id]?.code);
    // Thrashing Arm: lowest printed Threat (Cargo Hold 2, Forecastle Deck 3); Giant Arm: lowest quest points (2 and 5); Crushing Arm: highest quest points.
    expect(cargo).toEqual([CODES.thrashing, CODES.giant].sort());
    expect(forecastle).toEqual([CODES.crushing]);
    expect(cardOf(run.state, CODES.eye)?.zone).toBe("encounterDiscard");
    expect(cardOf(run.state, "f0")?.zone).toBe("encounterDiscard");
    expect(codesOfDeck(run.state)).toEqual([CODES.grasping]);
  });

  it("12041:B:1 is not a rule of stage 1: there the players cannot travel while a location is active", () => {
    const first = make({ phase: "Travel", staging: [CODES.cargoHold], active: CODES.weatherDeck });
    expect(legalIntents(first.state, first.ctx).some((intent) => intent.type === "Travel")).toBe(false);
  });

  // The round from its encounter phase to the next round: the end of the round's Forced effects resolve between.
  const roundEnds = (layout: DepthsLayout): ScenarioState => {
    const made = make({ stage: "12041", phase: "Encounter", ...layout });
    return depthsDrive(start(made.state), made.ctx, (state) => state.round > made.state.round).run.state;
  };
  const arms = (count: number, location: string) => Array.from({ length: count }, () => [CODES.thrashing, location] as const);

  it("12041:B:2 loses at the end of the round when one Ship location's total Threat is 9 (Forecastle Deck's 3 and 3 grappled enemies), and not at 8", () => {
    expect(roundEnds({ staging: [CODES.forecastle], grappled: arms(3, CODES.forecastle) }).lost).toBe(true);
    const eight = roundEnds({ staging: [CODES.quarterDeck], grappled: arms(2, CODES.quarterDeck) });
    expect(eight.lost).toBe(false);
    expect(eight.round).toBe(1);
  });

  it("12041:B:2 does not count a location that is no Ship location, at Threat 10", () => {
    const ten = roundEnds({ staging: ["place"], grappled: arms(4, "place") });
    expect(ten.lost).toBe(false);
    expect(ten.round).toBe(1);
  });
});

describe("12042 Helm of the Stormcaller", () => {
  it("12042:A:2 counts the resources on Raider enemies in play only: not on Captain Sahír set aside or on his objective side, not on a Creature", () => {
    const made = make({ allies: true, staging: [CODES.helm, { code: "raider", resources: 2 }], engaged: [{ code: CODES.umbar, seat: 0, resources: 1 }, { code: "creature", seat: 0, resources: 5 }], setAside: [CODES.sahir] });
    const loaded = updateCard(updateCard(made.state, idOf(made.state, CODES.sahir), { resources: 3 }), idOf(made.state, CODES.sahirAlly), { resources: 4 });
    // Helm prints 1 quest point; the Raider enemies hold 2 and 1.
    expect(modifiedStat(loaded, cardOf(loaded, CODES.helm)!, "questPoints", world.cards)).toBe(1 + 3);
  });
});

describe("12043 Forecastle Deck", () => {
  it("12043:A:1 with no enemy in the encounter deck or discard pile reveals nothing, and still shuffles the encounter deck", () => {
    const deck = [CODES.weatherDeck, CODES.cargoHold, CODES.crewQuarters, CODES.quarterDeck, CODES.holdSteady, CODES.fromTheDepths];
    const made = make({ phase: "Travel", staging: [CODES.forecastle], deck, discard: [CODES.lashing] });
    const run = send(start(made.state), { type: "Travel", locationId: idOf(made.state, CODES.forecastle) }, made.ctx);
    expect(run.state.window?.kind).not.toBe("choose");
    expect(run.state.activeLocation).toBe(idOf(made.state, CODES.forecastle));
    expect(run.steps.some((step) => step.kind === "reveal")).toBe(false);
    expect(codesOfDeck(run.state)).not.toEqual(deck);
  });
});

describe("12044 Weather Deck", () => {
  it("12044:A:1 makes each of 2 players exhaust a character he controls to travel to another Deck location", () => {
    const made = make({ seats: 2, phase: "Travel", staging: [CODES.weatherDeck, CODES.quarterDeck] });
    const run = finish(send(start(stayTired(made.state)), { type: "Travel", locationId: idOf(made.state, CODES.quarterDeck) }, made.ctx), made.ctx);
    expect(run.state.activeLocation).toBe(idOf(made.state, CODES.quarterDeck));
    expect([made.hero, made.hero2].filter((id) => run.state.cards[id]?.exhausted)).toHaveLength(1);
    expect(run.state.cards[made.seat1Hero ?? ""]?.exhausted).toBe(true);
  });

  it("12044:A:1 gives no cost to travel to a location that is not a Deck location (Cargo Hold)", () => {
    const made = make({ phase: "Travel", staging: [CODES.weatherDeck, CODES.cargoHold] });
    const run = finish(send(start(stayTired(made.state)), { type: "Travel", locationId: idOf(made.state, CODES.cargoHold) }, made.ctx), made.ctx);
    expect(run.state.activeLocation).toBe(idOf(made.state, CODES.cargoHold));
    expect([made.hero, made.hero2].some((id) => run.state.cards[id]?.exhausted)).toBe(false);
  });

  it("12044:A:1 lets nobody travel to the Deck location when the second player has no ready character to exhaust", () => {
    const made = make({ seats: 2, phase: "Travel", staging: [CODES.weatherDeck, CODES.quarterDeck] });
    const tired = updateCard(made.state, made.seat1Hero ?? "", { exhausted: true });
    const offered = legalTargets(tired, { type: "Travel" }, made.ctx);
    expect(offered).not.toContain(idOf(tired, CODES.quarterDeck));
    expect(offered).toContain(idOf(tired, CODES.weatherDeck));
  });
});

describe("12045 Cargo Hold", () => {
  it("12045:A:1 gives no enemy +1 Defense while it is in the staging area", () => {
    const made = make({ staging: [CODES.cargoHold, "mild"] });
    expect(defense(made.state, idOf(made.state, "mild"))).toBe(1);
  });

  it("12045:A:2 gives the attacking enemy +2 Defense until the end of the phase: after the attack, and not in the next phase", () => {
    const { run, made } = depthsFight(world, CODES.cargoHold, "mild", { engaged: [{ code: "mild", seat: 0 }] });
    const mild = idOf(run.state, "mild");
    expect(run.state.phase).toBe("Combat");
    expect(run.state.pendingAttack).toBeNull();
    expect(defense(run.state, mild)).toBe(3);
    const next = depthsDrive(run, made.ctx, (state) => state.phase !== "Combat").run.state;
    expect(defense(next, mild)).toBe(1);
  });
});

describe("12046 Crew Quarters", () => {
  it("12046:A:1 adds no resource to Captain Sahír while he is set aside: he is not in play", () => {
    const made = make({ phase: "Travel", staging: [CODES.crewQuarters], engaged: [CODES.umbar], setAside: [CODES.sahir] });
    const run = finish(send(start(made.state), { type: "Travel", locationId: idOf(made.state, CODES.crewQuarters) }, made.ctx), made.ctx);
    expect(cardOf(run.state, CODES.umbar)?.resources).toBe(1);
    expect(cardOf(run.state, CODES.sahir)?.resources).toBe(0);
  });
});

describe("12047 Quarter Deck", () => {
  it("12047:A:1 deals each enemy of each of 2 players an additional shadow card at the beginning of the combat phase", () => {
    const made = make({ seats: 2, phase: "Encounter", active: CODES.quarterDeck, engaged: [{ code: "mild", seat: 0 }, { code: "mild", seat: 1 }], deck: Array.from({ length: 8 }, () => "f0") });
    const run = depthsDrive(start(made.state), made.ctx, (state) => state.window?.kind === "defense").run.state;
    const shadowsOn = (id: string) => Object.values(run.cards).filter((card) => card.zone === "shadow" && card.host === id).length;
    expect(idsOf(run, "mild").map(shadowsOn)).toEqual([2, 2]);
  });
});

describe("12048 Hold Steady!", () => {
  const lowered = (amount: number) => (state: ScenarioState, made: { hero: string }) => ({ ...state, modifiers: [...state.modifiers, { instanceId: made.hero, sourceId: "t", stat: "defense" as const, amount, until: "endOfRound" as const }] });

  it("12048:A:2 discards a defending character with 0 Defense", () => {
    const { run, made } = depthsFight(world, CODES.holdSteady, "mild", {}, { tweak: lowered(-2) });
    expect(run.state.cards[made.hero]?.zone).toBe("discard");
  });

  it("12048:A:2 gives -2 Defense for this attack only: the defender's Defense is back after it", () => {
    const { run, during, made } = depthsFight(world, CODES.holdSteady, "mild");
    expect(defense(during, made.hero)).toBe(0);
    expect(run.state.cards[made.hero]?.zone).toBe("heroes");
    expect(run.state.cards[made.hero]?.damage).toBe(3);
    expect(defense(run.state, made.hero)).toBe(2);
  });

  it("12048:A:2 discards nobody when the attack is undefended", () => {
    const { run, made } = depthsFight(world, CODES.holdSteady, "mild", {}, { undefended: true, tweak: lowered(-2) });
    expect([made.hero, made.hero2].map((id) => run.state.cards[id]?.zone)).toEqual(["heroes", "heroes"]);
  });
});

describe("12051 Thrashing Arm", () => {
  const combat = (layout: DepthsLayout) => {
    const made = make({ phase: "Encounter", deck: ["f0", "f0", "f0"], ...layout });
    const pick = (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.includes(made.hero2) ? made.hero2 : (state.window.options[0] ?? "")) : "");
    return { made, state: depthsDrive(start(made.state), made.ctx, (state) => state.phase === "Planning" || state.round > made.state.round, pick).run.state };
  };

  it("12051:A:2 deals 3 damage at the end of the combat phase, after its own attack, to the character its engaged player chooses", () => {
    const { made, state } = combat({ engaged: [CODES.thrashing] });
    expect(state.cards[made.hero]?.damage).toBe(5);
    expect(state.cards[made.hero2]?.damage).toBe(3);
  });

  it("12051:A:2 deals nothing while it is in the staging area", () => {
    const { made, state } = combat({ staging: [CODES.thrashing], threat: [20, 0] });
    expect(state.round).toBe(1);
    expect([made.hero, made.hero2].map((id) => state.cards[id]?.damage)).toEqual([0, 0]);
  });
});
