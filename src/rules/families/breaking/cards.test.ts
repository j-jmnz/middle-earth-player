// Rules: mec109.multiple-staging-areas, mec109.saga-staging-rules, rr.first-player, rr.quest-advancement, rr.step-3-3, rr.travel, rr.active-location, rr.explored,
// rr.step-6-4b, mec109.archery, mec109.peril, rr.removed-from-game, rr.winning-the-game (data/rules/entries.json). The stage 3 and 4 cards, Frodo's Choice, the
// locations and the encounter cards of Breaking of the Fellowship (142063 to 142090), and the families/breaking/cards.ts verbs they use.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../core/test-fixture.ts";
import { archeryTotal } from "../../combat/combat.ts";
import { holds } from "../../interpret/conditions.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { printedOf, definePrinted } from "../../core/printed.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ScenarioState } from "../../engine/reduce.ts";
import { restricted, defenseBlocked, travelBlocked } from "../../interpret/restrictions.ts";
import { flagged, updateCard } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { spawn } from "../../core/zones.ts";
import { revealsAllowed } from "../encounter/reveal.ts";
import type { EngineStep } from "../../core/intents.ts";
import { ARGONATH, PARTH_GALEN, SARN_GEBIR, SEAT_OF_SEEING, codes, fire, loadBreakingWorld, makeBreaking, recordOf, settled, type BreakingLayout, type BreakingTable, type BreakingWorld } from "../../../../scripts/breaking-scene.ts";
import { first } from "../../../../scripts/past-scene.ts";

let world: BreakingWorld;

beforeAll(async () => {
  world = await loadBreakingWorld();
  world.cards.set("ally2", definePrinted({ code: "ally2", name: "ally2", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
  world.cards.set("ally3", definePrinted({ code: "ally3", name: "ally3", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 3 }));
}, 60_000);

const heroes = [["strong"], ["weak"]] as const;
const make = (layout: BreakingLayout = {}) => makeBreaking(world, { seats: 2, stage: "separate", frodo: false, heroes, threats: [30, 30], ...layout });
const ids = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.id);

function send(table: BreakingTable, state: ScenarioState, intent: PlayerIntent): ScenarioState {
  return expectOk(reduce(state, intent, table.ctx)).state;
}

describe("stage 3B: progress that discards cards (142063:B:1 to 142066:B:1, 142068:A:1, 142068:A:2, 142067:A:1)", () => {
  const deck = ["scout", "142068", "grunt", "brute", "scout"];

  it("turns progress into discards while Frodo's Choice is not in play, and reveals Frodo's Choice instead of discarding it: its seat takes the first player token for good and advances to stage 4A", () => {
    const table = make({ stages: ["142063", "142066"], deck, setAside: [PARTH_GALEN] });
    const stage = table.state.seats[0].stage ?? "";
    expect(flagged(table.state, stage, "progressDiscards")).toBe(true);
    const steps: EngineStep[] = [];
    // Two players, 2 progress each: 4 cards. The second is Frodo's Choice.
    let state = runInstruction({ ...table.state, window: null, firstPlayer: 1 }, { verb: "PlaceQuestProgress", perPlayer: 2 }, { seat: 0, sourceId: stage }, table.ctx, steps);
    expect(state.cards[stage]?.progress).toBe(0);
    state = settled(table, state, steps);
    expect(codes(state, state.encounterDiscard).sort()).toEqual(["brute", "grunt", "scout"]);
    expect(codes(state, state.encounterDeck)).toEqual(["scout"]);
    // Revealed by seat 0, it stays in seat 0's staging area; the first player token is seat 0's and cannot be lost.
    const choice = first(state, "142068");
    expect(state.seats[0].staging).toContain(choice);
    expect(state.cards[choice]?.zone).toBe("staging");
    expect(state.firstPlayer).toBe(0);
    expect(flagged(state, "table", "firstPlayerLocked")).toBe(true);
    // Seat 0 advanced from its stage 3B to stage 4A, which added Parth Galen to its area; seat 1 stays on its own.
    expect(state.cards[state.seats[0].stage ?? ""]?.code).toBe("142067");
    expect(state.cards[stage]?.zone).toBe("setAside");
    expect(codes(state, state.seats[0].staging)).toContain(PARTH_GALEN);
    expect(state.cards[state.seats[1].stage ?? ""]?.code).toBe("142066");
    expect(state.seats[1].staging).toEqual([]);
  });

  it("takes the progress on the stage once Frodo's Choice is in play, and does not discard", () => {
    const table = make({ stages: ["142063", "142066"], deck, areas: [[], ["142068"]] });
    const stage = table.state.seats[0].stage ?? "";
    expect(flagged(table.state, stage, "progressDiscards")).toBe(false);
    const state = runInstruction({ ...table.state, window: null }, { verb: "PlaceQuestProgress", perPlayer: 2 }, { seat: 0, sourceId: stage }, table.ctx, []);
    expect(state.cards[stage]?.progress).toBe(4);
    expect(state.encounterDeck).toHaveLength(deck.length);
  });

  it("reveals Frodo's Choice when the staging step turns it up: the seat that revealed it advances, the other seat does not", () => {
    const table = make({ stages: ["142063", "142066"], deck: ["142068", "scout"], setAside: [PARTH_GALEN] });
    let state = table.state;
    for (const seat of [0, 1]) {
      state = send(table, state, { type: "Commit", cardIds: [table.heroes[seat]?.[0] ?? ""] });
      state = send(table, state, { type: "Pass" });
    }
    for (let guard = 0; guard < 30 && state.window != null && state.phase === "Quest"; guard += 1) state = send(table, state, { type: "Pass" });
    expect(state.cards[state.seats[0].stage ?? ""]?.code).toBe("142067");
    expect(state.cards[state.seats[1].stage ?? ""]?.code).toBe("142066");
  });
});

describe("the Responses of the stage 3B cards, after you quest successfully (142063:B:3 to 142066:B:3)", () => {
  const play = (stage: string, record: string, layout: BreakingLayout = {}, answers: readonly string[] = []) => {
    const table = make({ stages: [stage, "142064"], ...layout });
    return { table, state: fire(table, table.state, table.state.seats[0].stage ?? "", record, answers, "forced", 0) };
  };

  it("Searching the Woods discards a non-unique location in any staging area", () => {
    const { state } = play("142063", "142063:response:1", { areas: [["grunt"], ["place"]] });
    expect(state.cards[ids(state, "place")[0] ?? ""]?.zone).toBe("encounterDiscard");
    expect(state.seats[1].staging).toEqual([]);
    expect(codes(state, state.seats[0].staging)).toEqual(["grunt"]);
  });

  it("Guard the Hobbits readies each hero of the player it chooses", () => {
    const table = make({ stages: ["142064", "142063"] });
    const tired = [...table.heroes[0], ...table.heroes[1]].reduce((state, id) => updateCard(state, id, { exhausted: true }), table.state);
    const state = fire(table, tired, tired.seats[0].stage ?? "", "142064:response:1", ["seat:1"], "forced", 0);
    expect(state.cards[table.heroes[1]?.[0] ?? ""]?.exhausted).toBe(false);
    expect(state.cards[table.heroes[0]?.[0] ?? ""]?.exhausted).toBe(true);
  });

  it("The Seat of Amon Hen has the player it chooses draw 2 cards and lower their threat by 2", () => {
    const { state, table } = play("142065", "142065:response:1", {}, ["seat:1"]);
    expect(state.seats[1].hand.length).toBe(table.state.seats[1].hand.length + 2);
    expect(state.seats[1].threat).toBe(28);
    expect(state.seats[0].threat).toBe(30);
  });

  it("Orc Hunting discards an enemy engaged with a player", () => {
    const { state } = play("142066", "142066:response:1", { engaged: [{ code: "grunt", seat: 1 }] });
    expect(state.cards[ids(state, "grunt")[0] ?? ""]?.zone).toBe("encounterDiscard");
    expect(state.seats[1].engaged).toEqual([]);
  });

  it("is offered to the seat that quested successfully, and not to the other", () => {
    const table = make({ stages: ["142066", "142064"], areas: [[], ["142068"]], engaged: [{ code: "grunt", seat: 0 }] });
    let state = table.state;
    state = send(table, state, { type: "Commit", cardIds: [table.heroes[0]?.[0] ?? ""] });
    state = send(table, state, { type: "Pass" });
    state = send(table, state, { type: "Pass" });
    for (let guard = 0; guard < 20 && state.window?.kind === "pass"; guard += 1) state = send(table, state, { type: "Pass" });
    expect(state.window?.kind).toBe("response");
    expect(state.activeSeat).toBe(0);
    expect(legalIntents(state, table.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "142066:response:1")).toBe(true);
  });
});

describe("stage 4 (142067)", () => {
  it("4A adds Parth Galen to the staging area of the seat that reveals it, and ends the quest phase while the staging step runs", () => {
    const table = make({ stages: ["142067", "142063"], setAside: [PARTH_GALEN] });
    const state = fire(table, table.state, table.state.seats[0].stage ?? "", "142067:whenRevealed:1", [], "whenRevealed", 0);
    expect(codes(state, state.seats[0].staging)).toEqual([PARTH_GALEN]);
    expect(state.seats[1].staging).toEqual([]);
    const staging = { ...table.state, mode: "staging" as const, revealCursor: { seats: [0, 1], index: 1 }, window: null };
    const ended = runInstruction(staging, { verb: "EndQuestPhase", when: { kind: "phase", is: "Quest" } }, { seat: 0, sourceId: null }, table.ctx, []);
    expect(ended.mode).toBe("resolution");
    expect(ended.questResolved).toBe(true);
    expect(ended.revealCursor).toBeNull();
  });

  it("4B reveals one more card for each player, and the players cannot win while Parth Galen is in play", () => {
    const table = make({ stages: ["142067", "142063"], areas: [[PARTH_GALEN], []] });
    expect(revealsAllowed(table.state, 2)).toBe(4);
    expect(restricted(table.state, table.ctx, "advance").length).toBeGreaterThan(0);
    const without = make({ stages: ["142067", "142063"] });
    expect(restricted(without.state, without.ctx, "advance")).toEqual([]);
  });

  it("4B: after an enemy is revealed any player may raise their threat by its Threat to engage it, once a round each", () => {
    const table = make({ stages: ["142067", "142063"], deck: ["grunt", "scout", "scout", "scout"], progress: 0 });
    let state = table.state;
    for (const seat of [0, 1]) {
      state = send(table, state, { type: "Commit", cardIds: [table.heroes[seat]?.[0] ?? ""] });
      state = send(table, state, { type: "Pass" });
    }
    expect(state.window?.kind).toBe("response");
    expect(state.activeSeat).toBe(0);
    const trigger = legalIntents(state, table.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "142067:response:1");
    expect(trigger).toBeDefined();
    state = send(table, state, trigger as PlayerIntent);
    const grunt = first(state, "grunt");
    expect(state.cards[grunt]?.zone).toBe("engaged");
    expect(state.cards[grunt]?.controller).toBe(0);
    // Grunt has Threat 2: seat 0's threat rose by 2.
    expect(state.seats[0].threat).toBe(32);
    // The next enemy (a scout) is offered to seat 1 only: seat 0 used its Response this round.
    for (let guard = 0; guard < 6 && state.window?.kind !== "response" && state.phase === "Quest"; guard += 1) state = send(table, state, { type: "Pass" });
    if (state.window?.kind === "response") expect(state.activeSeat).toBe(1);
  });
});

describe("Frodo's Choice (142068:A:2)", () => {
  it("takes the first player token and keeps it through the refresh phase", () => {
    const table = make({ areas: [[], ["142068"]] });
    const choice = first(table.state, "142068");
    const revealed = fire(table, table.state, choice, "142068:whenRevealed:1", [], "whenRevealed", 1);
    expect(revealed.firstPlayer).toBe(1);
    expect(flagged(revealed, "table", "firstPlayerLocked")).toBe(true);
    // The Ring-bearer was removed from the game by stage 2A: the card stays in the staging area.
    expect(revealed.cards[choice]?.zone).toBe("staging");
    const refresh = settle(syncConstants({ ...revealed, window: null, phase: "Refresh", boundaryPhase: "Refresh", mode: "refresh" }, table.ctx), table.ctx, []);
    expect(refresh.firstPlayer).toBe(1);
  });
});

describe("the enemies (142069 to 142072)", () => {
  it("Uruk-hai Captain: allies with fewer printed hit points than it cannot defend against it", () => {
    const table = make({ engaged: [{ code: "142069", seat: 0 }] });
    let state = table.state;
    const small = spawn(state, "ally2", { zone: "play", seat: 0 });
    const big = spawn(small.state, "ally3", { zone: "play", seat: 0 });
    state = syncConstants(big.state, table.ctx);
    const attacking = { ...state, pendingAttack: { enemyId: first(state, "142069"), seat: 0 } };
    expect(defenseBlocked(attacking, table.ctx, small.id)).toBe(true);
    expect(defenseBlocked(attacking, table.ctx, big.id)).toBe(false);
    expect(defenseBlocked(attacking, table.ctx, table.heroes[0]?.[0] ?? "")).toBe(false);
    expect(modifiedStat(state, state.cards[first(state, "142069")]!, "attack", table.ctx.cards)).toBe(5);
  });

  it("Uruk-hai Archer: archery equal to the players at its stage", () => {
    const separate = make({ areas: [["142070"], []] });
    expect(archeryTotal(separate.state, separate.ctx.cards, 0)).toBe(1);
    expect(archeryTotal(separate.state, separate.ctx.cards, 1)).toBe(0);
    const shared = make({ stage: 2, staging: ["142070"] });
    expect(archeryTotal(shared.state, shared.ctx.cards)).toBe(2);
    expect(archeryTotal(make({ seats: 1, stage: 2, staging: ["142070"], heroes: [["strong"]] }).state, world.cards)).toBe(1);
  });

  it("Uruk-hai Archer: its player discards an ally they control when it is revealed", () => {
    const table = make({ areas: [["142070"], []] });
    const ally = spawn(table.state, "ally2", { zone: "play", seat: 0 });
    const state = fire(table, ally.state, first(ally.state, "142070"), "142070:whenRevealed:1", [], "whenRevealed", 0);
    expect(state.cards[ally.id]?.zone).toBe("discard");
  });

  it("Uruk-hai Tracker: +2 Attack against a defender with 2 or fewer printed hit points", () => {
    const table = make({ engaged: [{ code: "142071", seat: 0 }] });
    const small = spawn(table.state, "ally2", { zone: "play", seat: 0 });
    const state = syncConstants(small.state, table.ctx);
    const tracker = state.cards[first(state, "142071")]!;
    expect(modifiedStat(state, tracker, "attack", table.ctx.cards)).toBe(3);
    expect(modifiedStat({ ...state, pendingAttack: { enemyId: tracker.id, seat: 0, defenderId: small.id } }, tracker, "attack", table.ctx.cards)).toBe(5);
    expect(modifiedStat({ ...state, pendingAttack: { enemyId: tracker.id, seat: 0, defenderId: table.heroes[0]?.[0] ?? "" } }, tracker, "attack", table.ctx.cards)).toBe(3);
  });

  it("Uruk-hai Hunter: either the chosen player reveals an encounter card, or it attacks the revealing player", () => {
    const table = make({ areas: [["142072"], []], deck: ["scout"] });
    const hunter = first(table.state, "142072");
    const revealed = fire(table, table.state, hunter, "142072:whenRevealed:1", ["reveal", "seat:1"], "whenRevealed", 0);
    expect(codes(revealed, revealed.seats[1].staging)).toEqual(["scout"]);
    const attacked = fire(table, table.state, hunter, "142072:whenRevealed:1", ["attack"], "whenRevealed", 0);
    expect(attacked.pendingAttack?.enemyId).toBe(hunter);
    expect(attacked.pendingAttack?.seat).toBe(0);
  });
});

describe("the locations (142073 to 142079)", () => {
  it("The Argonath: Threat X for X players, no travel while Sarn Gebir is in play, no combat phase while it is the active location", () => {
    const table = make({ stage: 2, staging: [ARGONATH, SARN_GEBIR] });
    const argonath = first(table.state, ARGONATH);
    expect(modifiedStat(table.state, table.state.cards[argonath]!, "threat", table.ctx.cards)).toBe(2);
    expect(travelBlocked(table.state, table.ctx, argonath)).toBe(true);
    const alone = make({ stage: 2, staging: [ARGONATH] });
    expect(travelBlocked(alone.state, alone.ctx, first(alone.state, ARGONATH))).toBe(false);
    expect(flagged(alone.state, "table", "skipCombat")).toBe(false);
    const active = make({ stage: 2 });
    const placed = spawn(active.state, ARGONATH, { zone: "activeLocation" });
    expect(flagged(syncConstants(placed.state, active.ctx), "table", "skipCombat")).toBe(true);
  });

  it("The Argonath as the active location skips the combat phase", () => {
    const table = make({ stage: 2, phase: "Encounter" });
    const placed = spawn(table.state, ARGONATH, { zone: "activeLocation" });
    const state = settle(syncConstants({ ...placed.state, window: null, mode: "combatStart", phase: "Combat", boundaryPhase: "Combat" }, table.ctx), table.ctx, []);
    expect(state.phase).not.toBe("Combat");
  });

  it("Sarn Gebir: deals 1 damage to each exhausted character when explored", () => {
    const table = make({ areas: [[SARN_GEBIR], []] });
    const tired = updateCard(table.state, table.heroes[0]?.[0] ?? "", { exhausted: true });
    // The record is heard when Sarn Gebir leaves play explored; its instructions are what this runs.
    const record = recordOf("142076:forced:1");
    const state = record.instructions.reduce((current, instruction) => runInstruction(current, instruction, { seat: 0, sourceId: first(tired, SARN_GEBIR) }, table.ctx, []), tired);
    expect(state.cards[table.heroes[0]?.[0] ?? ""]?.damage).toBe(1);
    expect(state.cards[table.heroes[1]?.[0] ?? ""]?.damage).toBe(0);
  });

  it("River Anduin: each player at its stage raises their threat by 1 at the end of the travel phase, then it moves to the staging area to the left", () => {
    const table = make({ areas: [[], ["142077"]] });
    const river = first(table.state, "142077");
    const state = fire(table, { ...table.state, phase: "Travel" }, river, "142077:forced:1", [], "forced", 0);
    expect(state.seats[1].threat).toBe(31);
    expect(state.seats[0].threat).toBe(30);
    expect(state.seats[0].staging).toContain(river);
    expect(state.seats[1].staging).not.toContain(river);
    const solo = make({ seats: 1, areas: [["142077"]], heroes: [["strong"]] });
    const stays = fire(solo, { ...solo.state, phase: "Travel" }, first(solo.state, "142077"), "142077:forced:1", [], "forced", 0);
    expect(stays.seats[0].threat).toBe(31);
    expect(stays.seats[0].staging).toContain(first(solo.state, "142077"));
  });

  it("Wooded Shoreline: archery 2 in the staging area; Travel adds an enemy found in the encounter deck to the traveling player's staging area", () => {
    const table = make({ areas: [["142078"], []], deck: ["scout", "grunt"], phase: "Travel" });
    expect(archeryTotal(table.state, table.ctx.cards, 0)).toBe(2);
    expect(archeryTotal(table.state, table.ctx.cards, 1)).toBe(0);
    const state = { ...table.state, travelDone: [0] };
    const place = legalTargets(state, { type: "Travel" }, table.ctx)[0] ?? "";
    let after = send(table, state, { type: "Travel", locationId: place });
    for (let guard = 0; guard < 6 && after.window?.kind === "choose"; guard += 1) after = send(table, after, { type: "Choose", optionId: after.window.options[0] ?? "" });
    expect(after.seats[0].active).toBe(place);
    expect(codes(after, after.seats[0].staging)).toHaveLength(1);
    expect(archeryTotal(after, table.ctx.cards, 0)).toBe(0);
  });

  it("Parth Galen: Travel adds an enemy to the staging area", () => {
    const table = make({ areas: [[PARTH_GALEN], []], deck: ["scout", "grunt"], phase: "Travel" });
    const state = { ...table.state, travelDone: [0] };
    let after = send(table, state, { type: "Travel", locationId: first(state, PARTH_GALEN) });
    for (let guard = 0; guard < 6 && after.window?.kind === "choose"; guard += 1) after = send(table, after, { type: "Choose", optionId: after.window.options[0] ?? "" });
    expect(after.seats[0].active).toBe(first(state, PARTH_GALEN));
    expect(after.seats[0].staging).toHaveLength(1);
  });

  it("Slopes of Amon Hen: the traveling player must engage an enemy in any staging area; it cannot be traveled to with no enemy", () => {
    const none = make({ areas: [["142079"], []], phase: "Travel" });
    expect(legalTargets({ ...none.state, travelDone: [0] }, { type: "Travel" }, none.ctx)).toEqual([]);
    const table = make({ areas: [["142079"], ["grunt"]], phase: "Travel" });
    const state = { ...table.state, travelDone: [0] };
    const slopes = first(state, "142079");
    let after = send(table, state, { type: "Travel", locationId: slopes });
    for (let guard = 0; guard < 6 && after.window?.kind === "choose"; guard += 1) after = send(table, after, { type: "Choose", optionId: after.window.options[0] ?? "" });
    expect(after.seats[0].active).toBe(slopes);
    expect(after.cards[first(after, "grunt")]?.zone).toBe("engaged");
    expect(after.cards[first(after, "grunt")]?.controller).toBe(0);
    expect(after.seats[1].staging).toEqual([]);
  });
});

describe("the treacheries (142080 to 142083, 142089, 142090) and Seat of Seeing (142074)", () => {
  it("Growing Threat: moves an enemy engaged with you to the first player's staging area, or gains Doomed 2 and Surge", () => {
    const table = make({ engaged: [{ code: "grunt", seat: 1 }], areas: [[], []] });
    const moved = fire(table, { ...table.state, firstPlayer: 0 }, "", "142080:whenRevealed:1", ["move", first(table.state, "grunt")], "whenRevealed", 1);
    expect(codes(moved, moved.seats[0].staging)).toEqual(["grunt"]);
    expect(moved.seats[1].engaged).toEqual([]);
    const doomed = fire(table, table.state, "", "142080:whenRevealed:1", ["doomed"], "whenRevealed", 1);
    expect(doomed.seats.map((seat) => seat.threat)).toEqual([32, 32]);
  });

  it("Orcs of the White Hand: each enemy at the revealing player's stage loses its damage and gets +1 Threat, Attack and Defense for the round", () => {
    const table = make({ areas: [["grunt", "142081"], ["grunt"]], engaged: [{ code: "scout", seat: 0 }] });
    const hurt = updateCard(table.state, first(table.state, "scout"), { damage: 3 });
    const state = fire(table, hurt, first(hurt, "142081"), "142081:whenRevealed:1", [], "whenRevealed", 0);
    const cards = table.ctx.cards;
    const [mine, theirs] = [table.state.seats[0].staging[0] ?? "", table.state.seats[1].staging[0] ?? ""];
    expect(modifiedStat(state, state.cards[mine]!, "threat", cards)).toBe(3);
    expect(modifiedStat(state, state.cards[mine]!, "attack", cards)).toBe(2);
    expect(modifiedStat(state, state.cards[mine]!, "defense", cards)).toBe(2);
    expect(modifiedStat(state, state.cards[theirs]!, "threat", cards)).toBe(2);
    expect(state.cards[first(state, "scout")]?.damage).toBe(0);
    expect(modifiedStat(state, state.cards[first(state, "scout")]!, "attack", cards)).toBe(2);
  });

  it("Black Feathered Arrows: the archery total at the revealing player's stage gains 1 for each ally there until the end of the round", () => {
    const table = make({ areas: [["142082"], []] });
    const one = spawn(table.state, "ally2", { zone: "play", seat: 0 });
    const two = spawn(one.state, "ally2", { zone: "play", seat: 0 });
    const other = spawn(two.state, "ally2", { zone: "play", seat: 1 });
    const state = fire(table, other.state, first(other.state, "142082"), "142082:whenRevealed:1", [], "whenRevealed", 0);
    expect(archeryTotal(state, table.ctx.cards, 0)).toBe(2);
    expect(archeryTotal(state, table.ctx.cards, 1)).toBe(0);
  });

  it("the Shadows of Slopes, Arrows and Orcs read the printed hit points of the defender and the attacker", () => {
    const table = make({ engaged: [{ code: "142069", seat: 0 }] });
    const small = spawn(table.state, "ally2", { zone: "play", seat: 0 });
    const fewer = { kind: "matches", card: "defender", pick: { type: "character", control: "any", fewerHitPointsThan: "attackingEnemy" } } as const;
    const enemy = first(small.state, "142069");
    const against = (defender: string) => holds({ ...small.state, pendingAttack: { enemyId: enemy, seat: 0, defenderId: defender } }, fewer, { actor: 0, sourceId: null, returned: 0 }, table.ctx);
    expect(against(small.id)).toBe(true);
    expect(against(table.heroes[0]?.[0] ?? "")).toBe(false);
    // Slopes of Amon Hen's Shadow: +1 Attack, +2 against a defender with fewer printed hit points.
    const shadowed = (defender: string) => {
      const base = { ...small.state, pendingAttack: { enemyId: enemy, seat: 0, defenderId: defender } };
      const state = fire(table, base, enemy, "142079:shadow:1", [], "forced", 0);
      return modifiedStat(state, state.cards[enemy]!, "attack", table.ctx.cards) - modifiedStat(base, base.cards[enemy]!, "attack", table.ctx.cards);
    };
    expect(shadowed(small.id)).toBe(2);
    expect(shadowed(table.heroes[0]?.[0] ?? "")).toBe(1);
    // Orcs of the White Hand's Shadow makes the attack undefended against the smaller defender only.
    const orcs = (defender: string) => fire(table, { ...small.state, pendingAttack: { enemyId: enemy, seat: 0, defenderId: defender } }, enemy, "142081:shadow:1", [], "forced", 0).pendingAttack?.undefended === true;
    expect(orcs(small.id)).toBe(true);
    expect(orcs(table.heroes[0]?.[0] ?? "")).toBe(false);
  });

  it("Fallen Into Evil: attaches to a non-Fellowship hero, which is an enemy in the first player's staging area with Threat equal to its Willpower and engagement cost to its threat cost; discarded, it returns", () => {
    const table = make({ heroes: [["strong", "weak"], ["strong"]], areas: [["142083"], []] });
    const evil = first(table.state, "142083");
    const hero = table.heroes[0]?.[1] ?? "";
    const state = fire(table, table.state, evil, "142083:whenRevealed:1", [hero], "whenRevealed", 1);
    const fallen = state.cards[hero]!;
    expect(fallen.code).toBe("weak~enemy");
    expect(fallen.zone).toBe("staging");
    expect(state.seats[0].staging).toContain(hero);
    expect(state.seats[0].heroes).not.toContain(hero);
    expect(state.cards[evil]?.host).toBe(hero);
    expect(fallen.owner).toBe(0);
    const printed = printedOf(table.ctx.cards, fallen.code);
    expect(printed.type).toBe("enemy");
    expect(printed.threat).toBe(1);
    expect(printed.engagementCost).toBe(8);
    expect(state.seats[0].eliminated).toBe(false);
    const back = runInstruction(state, { verb: "ReturnFallenHero" }, { seat: 0, sourceId: evil }, table.ctx, []);
    expect(back.cards[hero]?.code).toBe("weak");
    expect(back.seats[0].heroes).toContain(hero);
    expect(back.seats[0].staging).not.toContain(hero);
    expect(back.cards[hero]?.controller).toBe(0);
  });

  it("Fallen Into Evil: a seat whose only hero falls is eliminated", () => {
    const table = make({ areas: [["142083"], []] });
    const state = fire(table, table.state, first(table.state, "142083"), "142083:whenRevealed:1", [table.heroes[1]?.[0] ?? ""], "whenRevealed", 1);
    expect(state.seats[1].eliminated).toBe(true);
  });

  it("Followed by Night: the topmost enemy of the encounter discard pile is put into play engaged with the revealing player", () => {
    const table = make({ discard: ["grunt", "mist"] });
    const state = fire(table, table.state, "", "142089:whenRevealed:1", [], "whenRevealed", 1);
    expect(state.cards[first(state, "grunt")]?.zone).toBe("engaged");
    expect(state.seats[1].engaged).toEqual([first(state, "grunt")]);
  });

  it("Ill Fate: attaches to a hero its player controls, and a character destroyed raises that player's threat by 2", () => {
    const table = make({});
    const fate = spawn(table.state, "142090", { zone: "staging", area: 1 }, "up");
    const attached = fire(table, fate.state, fate.id, "142090:whenRevealed:1", [], "whenRevealed", 1);
    expect(attached.cards[fate.id]?.host).toBe(table.heroes[1]?.[0]);
    const raised = fire(table, attached, fate.id, "142090:forced:1", [], "forced", 0);
    expect(raised.seats[1].threat).toBe(32);
    expect(raised.seats[0].threat).toBe(30);
  });

  it("Seat of Seeing: once explored, a burden card in play, in the deck or in the discard pile is removed from the game and the campaign pool, and the deck is shuffled", () => {
    const table = make({ deck: ["scout", "scout", "scout"], discard: ["142089", "142090"], active: [SEAT_OF_SEEING, null] });
    const seat = table.state.seats[0].active ?? "";
    const burden = first(table.state, "142090");
    let state = updateCard(table.state, seat, { progress: 5 });
    for (const index of [0, 1]) {
      state = send(table, state, { type: "Commit", cardIds: [table.heroes[index]?.[0] ?? ""] });
      state = send(table, state, { type: "Pass" });
    }
    for (let guard = 0; guard < 30 && state.window?.kind !== "response" && state.phase === "Quest"; guard += 1) state = send(table, state, { type: "Pass" });
    expect(state.window?.kind).toBe("response");
    const trigger = legalIntents(state, table.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "142074:response:1");
    expect(trigger).toBeDefined();
    state = send(table, state, trigger as PlayerIntent);
    expect(state.window?.kind).toBe("choose");
    state = send(table, state, { type: "Choose", optionId: burden });
    expect(state.cards[burden]?.zone).toBe("removed");
    expect(state.removedFromPool).toEqual([{ code: "142090", seat: null }]);
    expect(state.cards[first(state, "142089")]?.zone).toBe("encounterDiscard");
  });
});
