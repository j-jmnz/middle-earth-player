// Rules: mec109.hide-x, mec109.hide-tests, mec109.saga-staging-rules, rr.travel, rr.first-player, rr.forced (data/rules/entries.json); ledger lines 141035:A:3, 141037:A:2, 906105:A:2, 906106:A:2, 141036:A:1, 141037:A:1,
// 141040:A:1, 141022:B:1, 141023:B:3, 141024:B:2, 141038:A:1, 141041:A:2, 141042:A:2, 906108:A:1, 906109:A:2, 141023:B:1, 141024:A:1, 141024:B:1.
// A Shadow of the Past's lines that make or read a Hide test: the card-spec actions cannot commit to one, so each test commits through the intent the Hide window offers (`CommitHide`) and passes the test's action window.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../rules/core/intents.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { startReveal } from "../../../rules/windows/frames.ts";
import { topFrame } from "../../../rules/windows/windows.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { finish, idOf, idsOf, type Layout, type LayoutTable, resolveRecords, revealFromTop, type Run, send, start, tableFromLayout, zoneOf } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "a-shadow-of-the-past";
const RING = "141085";
const FRODO = "141001";
const table = (layout: Layout): LayoutTable => tableFromLayout(SCENARIO, layout, { extra: [RING, FRODO] });

// The card is put on top of the encounter deck and revealed by `seat` (the first player by default), as saga staging has each player reveal in turn (mec109.saga-staging-rules). A choice it opens is left open.
function revealBy(made: LayoutTable, code: string, seat?: number): Run {
  if (seat == null) {
    const steps: EngineStep[] = [];
    return { state: revealFromTop(start(made.state).state, made.ctx, code, steps).state, steps };
  }
  const spawned = spawn({ ...made.state, window: null, mode: "stopped" }, code, { zone: "encounterDeck" }, "down");
  const top = { ...spawned.state, encounterDeck: [spawned.id, ...spawned.state.encounterDeck.filter((id) => id !== spawned.id)] };
  const steps: EngineStep[] = [];
  return { state: settle(startReveal(top, seat, made.ctx, steps), made.ctx, steps), steps };
}

// The seat the open Hide window asks commits these characters (codes), and the test's action window is passed until the test is over.
function hide(run: Run, made: LayoutTable, codes: readonly string[] = []): Run {
  if (run.state.window?.kind !== "hideCommit") throw new Error(`no Hide test waits (window ${run.state.window?.kind ?? "none"})`);
  let sent = send(run, { type: "CommitHide", cardIds: codes.map((code) => idOf(run.state, code)) }, made.ctx);
  for (let guard = 0; guard < 20 && sent.state.window?.kind === "frameAction" && topFrame(sent.state)?.frame === "hide"; guard += 1) sent = send(sent, { type: "Pass" }, made.ctx);
  return finish(sent, made.ctx);
}

const hideSteps = (run: Run) => run.steps.flatMap((step) => (step.kind === "hideTest" ? [step] : []));

// Crawling Towards Him (Hide 2, a treachery) is revealed and the revealing player commits `codes`: the Hide test it starts, measured.
function crawling(layout: Layout, codes: readonly string[] = []): { run: Run; made: LayoutTable } {
  const made = table({ deck: ["f3", "f3", "f3", "f3", "f0", "f0"], ...layout });
  return { run: hide(revealBy(made, "141041"), made, codes), made };
}

describe("Travel: a Hide test", () => {
  // 141035 Bucklebury Ferry: "Travel: The first player must make a Hide 3 test to travel here."
  it("141035:A:3 the first player makes a Hide 3 test, then the players travel there", () => {
    const made = table({ phase: "Travel", staging: ["141035"], deck: ["f3", "f3", "f3", "f0"] });
    let run = send(start(made.state), { type: "Travel", locationId: idOf(made.state, "141035") }, made.ctx);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    run = hide(run, made);
    expect(hideSteps(run).map((step) => step.discardedIds.length)).toEqual([3]);
    expect(zoneOf(run.state, "141035")).toBe("activeLocation");
  });

  it("141035:A:3 with two players the first player, the second seat this round, makes the test", () => {
    const made = table({ seats: 2, firstPlayer: 1, phase: "Travel", staging: ["141035"], deck: ["f3", "f3", "f3", "f0"] });
    const run = send(start(made.state), { type: "Travel", locationId: idOf(made.state, "141035") }, made.ctx);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 1 });
  });

  // 141037 Stock Road: "Travel: The first player must make a Hide 1 test to travel here."
  it("141037:A:2 the first player makes a Hide 1 test, and a failed test does not stop the travel", () => {
    const made = table({ phase: "Travel", staging: ["141037"], deck: ["f3", "f0"] });
    let run = send(start(made.state), { type: "Travel", locationId: idOf(made.state, "141037") }, made.ctx);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    run = hide(run, made);
    expect(hideSteps(run).map((step) => [step.discardedIds.length, step.success])).toEqual([[1, false]]);
    expect(zoneOf(run.state, "141037")).toBe("activeLocation");
  });

  // 906105 Green-Hill Country and 906106 Stock Woods: "Travel: The first player makes a Hide 1 test."
  // Reading (researched, docs/scenarios/nightmare.md): the Travel cost is paid while the location is still in the staging area (Caleb Grace, ALeP 3.243 and 3.123), so its own A:1 adds 1: Hide 2, and 1 more for each other copy in the staging area.
  it("906105:A:2 the first player makes a Hide 2 test to travel there: its own +1 applies while it is in the staging area", () => {
    const made = table({ seats: 2, firstPlayer: 1, phase: "Travel", staging: ["906105"], deck: ["f3", "f3", "f3", "f3", "f0"] });
    let run = send(start(made.state), { type: "Travel", locationId: idOf(made.state, "906105") }, made.ctx);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 1 });
    run = hide(run, made);
    expect(hideSteps(run).map((step) => step.discardedIds.length)).toEqual([2]);
    expect(zoneOf(run.state, "906105")).toBe("activeLocation");
  });

  it("906105:A:2 each other Green-Hill Country in the staging area adds 1 more: Hide 3 with one other copy", () => {
    const made = table({ phase: "Travel", staging: ["906105", "906105"], deck: ["f3", "f3", "f3", "f3", "f0"] });
    let run = send(start(made.state), { type: "Travel", locationId: idsOf(made.state, "906105")[0] ?? "" }, made.ctx);
    run = hide(run, made);
    expect(hideSteps(run).map((step) => step.discardedIds.length)).toEqual([3]);
  });

  it("906106:A:2 the first player makes a Hide 1 test to travel there", () => {
    const made = table({ phase: "Travel", staging: ["906106"], deck: ["f3", "f3", "f0"] });
    let run = send(start(made.state), { type: "Travel", locationId: idOf(made.state, "906106") }, made.ctx);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    run = hide(run, made);
    expect(hideSteps(run).map((step) => step.discardedIds.length)).toEqual([1]);
    expect(zoneOf(run.state, "906106")).toBe("activeLocation");
  });
});

describe("constants that change a Hide test", () => {
  // 141036 Green Hill Country: "While Green Hill Country is the active location, characters get +1 Willpower while committed to Hide tests."
  it("141036:A:1 each committed character counts 1 more Willpower while it is the active location, and none in the staging area", () => {
    expect(crawling({ active: "141036" }, ["dh1", "dh2"]).run.steps.find((step) => step.kind === "hideTest")).toMatchObject({ willpower: 6, threat: 6, success: true });
    expect(hideSteps(crawling({ staging: ["141036"] }, ["dh1", "dh2"]).run)[0]).toMatchObject({ willpower: 4, success: false });
  });

  // 141037 Stock Road: "While Stock Road is in the staging area, add 2 to the total Threat of the discarded cards when a player resolves a Hide test."
  it("141037:A:1 the discarded cards count 2 more Threat while it is in the staging area, and none while it is active", () => {
    expect(hideSteps(crawling({ staging: ["141037"] }).run)[0]?.threat).toBe(8);
    expect(hideSteps(crawling({ active: "141037" }).run)[0]?.threat).toBe(6);
  });

  // 141040 Evil Crow: "While Evil Crow is engaged with a player, that player adds 1 to the Hide value for each Hide test he makes."
  it("141040:A:1 the engaged player's Hide 2 test discards 3 cards, and another player's discards 2", () => {
    expect(hideSteps(crawling({ engaged: ["141040"] }).run)[0]?.discardedIds).toHaveLength(3);
    expect(hideSteps(crawling({ seats: 2, engaged: [{ code: "141040", seat: 1 }] }).run)[0]?.discardedIds).toHaveLength(2);
    expect(hideSteps(crawling({ staging: ["141040"] }).run)[0]?.discardedIds).toHaveLength(2);
  });
});

describe("a failed Hide test", () => {
  // The quest cards' backs: "When a player fails a Hide test, each Nazgûl enemy in the staging area engages that player. (Trigger Forced effects after resolving this effect.)"
  // The second seat is the first player this round, so it reveals Crawling Towards Him and fails the test; the Black Rider's own Forced (141039:A:2) then attacks that player. Evil Crow is a Creature.
  function engagesOnFailure(stage: string) {
    const { run } = crawling({ stage, seats: 2, firstPlayer: 1, staging: ["141039", "141040"] });
    const rider = run.state.cards[idOf(run.state, "141039")];
    return { rider, run };
  }

  it.each([
    ["141022:B:1", "141022"],
    ["141023:B:3", "141023"],
    ["141024:B:2", "141024"],
  ])("%s each Nazgûl enemy in the staging area engages the player who failed, an enemy that is not a Nazgûl staying", (_line, stage) => {
    const { rider, run } = engagesOnFailure(stage);
    expect(hideSteps(run)[0]?.success).toBe(false);
    expect(rider).toMatchObject({ zone: "engaged", controller: 1 });
    expect(zoneOf(run.state, "141040")).toBe("staging");
    // The Forced effects come after: the Black Rider, now engaged with the player who failed, attacks him.
    expect(run.state.window).toMatchObject({ kind: "defense", seat: 1 });
  });

  it("141022:B:1 a passed Hide test engages nothing", () => {
    const { run } = crawling({ stage: "141022", staging: ["141039"], deck: ["f0", "f0", "f0"] });
    expect(hideSteps(run)[0]?.success).toBe(true);
    expect(zoneOf(run.state, "141039")).toBe("staging");
  });

  // 141038 The Marish: "Forced: After a player fails a Hide test, shuffle a Nazgûl enemy from the discard pile into the encounter deck, if able."
  it("141038:A:1 a Nazgûl enemy in the discard pile goes back into the encounter deck, an enemy that is not a Nazgûl staying", () => {
    const { run } = crawling({ staging: ["141038"], discard: ["141039", "141040"] });
    expect(hideSteps(run)[0]?.success).toBe(false);
    expect(zoneOf(run.state, "141039")).toBe("encounterDeck");
    expect(zoneOf(run.state, "141040")).toBe("encounterDiscard");
  });

  it("141038:A:1 a passed Hide test leaves the Nazgûl in the discard pile", () => {
    const { run } = crawling({ staging: ["141038"], discard: ["141039"], deck: ["f0", "f0", "f0"] });
    expect(hideSteps(run)[0]?.success).toBe(true);
    expect(zoneOf(run.state, "141039")).toBe("encounterDiscard");
  });
});

describe("141041 Crawling Towards Him", () => {
  // "When Revealed: If you have failed a Hide test this phase, remove each character you control from the quest." Its own Hide 2 test resolves first (mec109.hide-x).
  it("141041:A:2 after its own Hide test fails, each character the revealing player controls leaves the quest, another player's staying", () => {
    const { run } = crawling({ seats: 2, committed: ["dh1", "dh2", "dh3"] });
    expect(hideSteps(run)[0]?.success).toBe(false);
    expect(run.state.cards[idOf(run.state, "dh1")]?.committed).toBe(false);
    expect(run.state.cards[idOf(run.state, "dh2")]?.committed).toBe(false);
    expect(run.state.cards[idOf(run.state, "dh3")]?.committed).toBe(true);
  });

  it("141041:A:2 after a passed Hide test the characters stay in the quest", () => {
    const { run } = crawling({ committed: ["dh1", "dh2"], deck: ["f0", "f0", "f0"] });
    expect(hideSteps(run)[0]?.success).toBe(true);
    expect(run.state.cards[idOf(run.state, "dh1")]?.committed).toBe(true);
  });

  it("141041:A:2 a Hide test failed in the quest phase of an earlier round is not one failed this phase", () => {
    const made = table({ committed: ["dh1"], deck: ["f0", "f0", "f0"] });
    const earlier: ScenarioState = { ...made.state, round: 2, hideFailures: [{ seat: 0, round: 1, phase: "Quest" }] };
    const run = hide(revealBy({ ...made, state: earlier }, "141041"), made);
    expect(hideSteps(run)[0]?.success).toBe(true);
    expect(run.state.cards[idOf(run.state, "dh1")]?.committed).toBe(true);
  });
});

describe("141042 Hunting For The Ring", () => {
  // "When Revealed: Starting with the last player, each player must either return a Nazgûl enemy engaged with him to the staging area or make a Hide 2 test."
  it("141042:A:2 the last player chooses first and returns his engaged Black Rider; the first player, with no Nazgûl engaged, makes the Hide test", () => {
    const made = table({ seats: 2, engaged: [{ code: "141039", seat: 1 }], deck: ["f0", "f0", "f0"] });
    let run = revealBy(made, "141042");
    expect(run.state.window).toMatchObject({ kind: "choose" });
    expect(run.state.activeSeat).toBe(1);
    run = finish(send(run, { type: "Choose", optionId: "return" }, made.ctx), made.ctx);
    expect(zoneOf(run.state, "141039")).toBe("staging");
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
  });

  it("141042:A:2 the last player with no Nazgûl engaged makes the Hide 2 test himself", () => {
    const made = table({ seats: 2, deck: ["f0", "f0", "f0", "f0", "f0"] });
    const run = revealBy(made, "141042");
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 1 });
  });

  it("141042:A:2 an engaged enemy that is not a Nazgûl gives no return option: the player makes the Hide test", () => {
    const made = table({ engaged: ["141040"], deck: ["f0", "f0", "f0"] });
    const run = revealBy(made, "141042");
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
  });
});

describe("906108 Followed by Shadows", () => {
  // "When Revealed: Starting with the first player, each player makes a Hide 2 test. Each player who fails this Hide test raises his threat by 5."
  it("906108:A:1 each player makes a Hide 2 test in turn, and only the player who fails raises his threat by 5", () => {
    const made = table({ seats: 2, deck: ["f0", "f0", "f3", "f3", "f0"] });
    let run = revealBy(made, "906108");
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
    run = hide(run, made);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 1 });
    run = hide(run, made);
    expect(hideSteps(run).map((step) => step.success)).toEqual([true, false]);
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([28, 33]);
  });
});

describe("906109 Sniffing and Hissing", () => {
  // "When Revealed: The first player must either exhaust The One Ring and reveal an encounter card, or make a Hide 3 test."
  const ringTable = (layout: Layout) => table({ attached: [{ code: RING, to: "dh1" }], ...layout });

  it("906109:A:2 the first player exhausts The One Ring and reveals an encounter card", () => {
    const made = ringTable({ deck: ["f3", "f0"] });
    let run = revealBy(made, "906109");
    expect(run.state.window).toMatchObject({ kind: "choose" });
    run = finish(send(run, { type: "Choose", optionId: "ring" }, made.ctx), made.ctx);
    expect(run.state.cards[idOf(run.state, RING)]?.exhausted).toBe(true);
    expect(zoneOf(run.state, "f3")).toBe("staging");
    expect(hideSteps(run)).toEqual([]);
  });

  it("906109:A:2 with The One Ring exhausted the first player makes the Hide 3 test", () => {
    const made = ringTable({ deck: ["f3", "f3", "f3", "f0"] });
    const tired = { ...made, state: updateCard(made.state, idOf(made.state, RING), { exhausted: true }) };
    const run = hide(revealBy(tired, "906109"), made);
    expect(hideSteps(run).map((step) => step.discardedIds.length)).toEqual([3]);
  });

  it("906109:A:2 revealed by the second player, the choice and the Hide test are the first player's", () => {
    const made = ringTable({ seats: 2, deck: ["f3", "f3", "f3", "f0"] });
    let run = revealBy(made, "906109", 1);
    expect(run.state.window).toMatchObject({ kind: "choose" });
    expect(run.state.activeSeat).toBe(0);
    run = send(run, { type: "Choose", optionId: "hide" }, made.ctx);
    expect(run.state.window).toEqual({ kind: "hideCommit", seat: 0 });
  });
});

describe("stages that search for a Black Rider", () => {
  // 141023 and 141024's backs: "When Revealed: The first player searches the encounter deck and discard pile for a Black Rider, reveals it (cannot be canceled), and adds it to the staging area. Shuffle the encounter deck."
  it.each([
    ["141023:B:1", "141023"],
    ["141024:B:1", "141024"],
  ])("%s the Black Rider in the discard pile is revealed, its Hide test made by the first player, and it is added to the staging area", (_line, stage) => {
    const made = table({ stage, seats: 2, firstPlayer: 1, discard: ["141039"], deck: ["f0", "f0", "f0", "f0"] });
    const resolved = resolveRecords(made.state, made.ctx, stage, "whenRevealed", idOf(made.state, stage));
    expect(resolved.steps.some((step) => step.kind === "reveal" && step.cardId === idOf(made.state, "141039"))).toBe(true);
    expect(resolved.state.window).toEqual({ kind: "hideCommit", seat: 1 });
    const run = hide(resolved, made);
    expect(zoneOf(run.state, "141039")).toBe("staging");
  });

  // Frodo Baggins (141001) may cancel an encounter card just revealed by exhausting The One Ring; the stage's reveal "cannot be canceled", so his Response is not offered for it.
  it("141023:B:1 the Black Rider's reveal cannot be canceled: Frodo's Response is offered for a Rider revealed from the deck, and not for this one", () => {
    const made = table({ stage: "141023", discard: ["141039"], deck: ["f0", "f0", "f0", "f0"] });
    const frodo = spawn(made.state, FRODO, { zone: "heroes", seat: 0 });
    const ring = spawn(updateCard(frodo.state, frodo.id, { resources: 1 }), RING, { zone: "play", seat: 0 });
    const ready = { ...made, state: attachTo(ring.state, ring.id, frodo.id) };
    expect(revealBy(ready, "141039").state.window?.kind).toBe("response");
    const searched = resolveRecords(ready.state, made.ctx, "141023", "whenRevealed", idOf(made.state, "141023"));
    expect(searched.state.window).toEqual({ kind: "hideCommit", seat: 0 });
  });

  it("141023:B:1 the Black Rider deep in the encounter deck is found and added to the staging area", () => {
    const made = table({ stage: "141023", deck: ["f0", "f0", "f0", "f0", "141039"] });
    const run = hide(resolveRecords(made.state, made.ctx, "141023", "whenRevealed", idOf(made.state, "141023")), made);
    expect(zoneOf(run.state, "141039")).toBe("staging");
  });

  // 141024's front: "When Revealed: Add Bucklebury Ferry to the staging area."
  it("141024:A:1 the set-aside Bucklebury Ferry joins the staging area without being revealed", () => {
    const made = table({ stage: "141024", side: "A", setAside: ["141035"], deck: ["f0"] });
    const run = resolveRecords(made.state, made.ctx, "141024", "whenRevealed", idOf(made.state, "141024"));
    expect(zoneOf(run.state, "141035")).toBe("staging");
    expect(run.steps.some((step) => step.kind === "reveal" && step.cardId === idOf(made.state, "141035"))).toBe(false);
  });
});
