// Rules: rr.reveal, rr.forced, rr.response, rr.shadow-effects, rr.explored, rr.doomed-x, rr.the-word-choose, hob.bilbo-baggins-ohauh (data/rules/entries.json); ledger lines 131035:A:1, 131035:A:2, 131039:A:1, 131039:A:2, 131040:A:1, 131040:A:2, 131041:A:1, 131055:A:2, 131055:A:3, 131056:A:1, 131056:A:2, 131057:A:1, 131057:A:2.
import { expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import type { EngineStep } from "../../core/intents.ts";
import { spawn } from "../../core/zones.ts";
import type { PlayerIntent } from "../../engine/reduce.ts";
import { settle } from "../../engine/machine.ts";
import { placeProgress } from "../../interpret/effect-verbs.ts";
import { announce, answer, attack, cardSpecs, count, deckCount, resolve, resourcesOn, rowProblems, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { fightEnemy, finish, idOf, legalIntents, resolveRecords, send, tableFromLayout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";

// Card specs for the Western Lands encounter set (131035, 131039 to 131041, 131055 to 131057), which We Must Away, Ere Break of Day and Over the Misty Mountains Grim both deal: one row for each record. The rows run on the first of those scenarios' tables;
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish).
const ID = "we-must-away-ere-break-of-day";
const BILBO = "131001";

const ROWS: readonly Row[] = [
  // 131035 A Suspicious Crow.
  { line: "131035:A:1", name: "When Revealed: the top card of the encounter discard pile is revealed and joins the staging area", layout: { discard: ["f0", "131039"], deck: ["f0", "f0"] }, act: resolve("131035", "whenRevealed"), expect: [zone("131039", "staging"), zone("f0", "encounterDiscard")] },
  { line: "131035:A:1", name: "the top card is taken whatever its type: a card of another type is revealed and the enemy under it stays", layout: { discard: ["f3", "131045"], deck: ["f0", "f0"] }, act: resolve("131035", "whenRevealed"), expect: [zone("131045", "staging"), zone("f3", "encounterDiscard")] },
  { line: "131035:A:2", name: "Shadow: once the attack dealt damage the shadow card is shuffled into the encounter deck", layout: {}, act: attack("f3", { shadow: "131035", undefended: true }), expect: [zone("131035", "encounterDeck")] },
  // 131039 Dreary Hills.
  { line: "131039:A:1", name: "Forced: each player discards 1 card at random from his hand", layout: { staging: ["131039"], hand: ["f0", "f0"] }, act: announce("progressPlacedOnSelf", "131039"), expect: [count("f0", "hand", 1)] },
  // 131040 Lone-Lands.
  { line: "131040:A:1", name: "Forced: each player removes 1 resource from the pool of one of his heroes", layout: { staging: ["131040"], heroResources: 2 }, act: announce("progressPlacedOnSelf", "131040"), expect: [resourcesOn("dh1", 1)] },
  // 131041 Cave Entrance.
  { line: "131041:A:1", name: "in the staging area, at the end of the round one card for each player goes from the top of the discard pile to the bottom of the encounter deck", layout: { staging: ["131041"], discard: ["f3", "f0"], deck: ["f0"] }, act: announce("endOfRound"), expect: [deckCount(2), zone("f3", "encounterDiscard")] },
  // 131055 No Campfire.
  { line: "131055:A:2", name: "When Revealed: a player who chooses the threat raises his threat by 4", layout: { threat: [30, 30], deck: ["f0", "f0"] }, act: [resolve("131055", "whenRevealed"), answer("threat")], expect: [threat(34), deckCount(2)] },
  { line: "131055:A:2", name: "a player who chooses the reveal reveals an additional encounter card", layout: { threat: [30, 30], deck: ["f0", "f0"] }, act: [resolve("131055", "whenRevealed"), answer("reveal")], expect: [threat(30), deckCount(1)] },
  { line: "131055:A:3", name: "Shadow: the defending player raises his threat by 2", layout: { threat: [30, 30] }, act: attack("f3", { shadow: "131055", undefended: true }), expect: [threat(32)] },
  // 131056 Wind-whipped Rain.
  { line: "131056:A:1", name: "When Revealed: every attachment in play is discarded", layout: { attached: [{ code: "attachment", to: "dh1" }] }, act: resolve("131056", "whenRevealed"), expect: [zone("attachment", "encounterDiscard")] },
  // The second pass: two players, the false case and what the line leaves out.
  { line: "131041:A:1", name: "with two players two cards go from the discard pile to the bottom of the deck", layout: { staging: ["131041"], seats: 2, discard: ["f0", "f3", "f3"], deck: ["f0"] }, act: announce("endOfRound"), expect: [deckCount(3), count("f3", "encounterDiscard", 0), count("f0", "encounterDiscard", 1)] },
  { line: "131055:A:2", name: "with two players each player chooses: the first raises his threat by 4, the second reveals a card", layout: { seats: 2, threat: [30, 30], deck: ["f0", "f0"] }, act: [resolve("131055", "whenRevealed"), answer("threat"), answer("reveal")], expect: [threat(34, 0), threat(30, 1), deckCount(1)] },
  { line: "131056:A:1", name: "an attached objective (the Troll Key) stays while an attachment is discarded", layout: { attached: [{ code: "attachment", to: "dh1" }, { code: "131043", to: "dh1", encounter: true }] }, act: resolve("131056", "whenRevealed"), expect: [zone("attachment", "encounterDiscard"), zone("131043", "attached")] },
  // 131057 More Like a Grocer.
];

cardSpecs(ID, ROWS);

// What these lines leave alone: a table without their records leaves it alone too, so these run on every record only.
const FALSE: readonly Row[] = [
  { line: "131035:A:1", name: "When Revealed: with the discard pile empty nothing joins the staging area", layout: { discard: [], deck: ["f0"] }, act: resolve("131035", "whenRevealed"), expect: [deckCount(1), count("f0", "staging", 0)] },
  { line: "131041:A:1", name: "Cave Entrance as the active location moves no card at the end of the round", layout: { active: "131041", discard: ["f3", "f0"], deck: ["f0"] }, act: announce("endOfRound"), expect: [deckCount(1)] },
];
for (const row of FALSE) it(`${row.line} ${row.name}`, () => expect(rowProblems(ID, row, EFFECTS), row.name).toEqual([]));

// Bilbo Baggins is the saga hero the loadout deals, which a layout does not place: these lines take a table with him in the heroes of the first seat and `resources` Baggins resources in his pool.
function withBilbo(effects: readonly Effect[], layout: Parameters<typeof tableFromLayout>[1], resources: number): LayoutTable {
  const table = tableFromLayout(ID, layout, { effects });
  const spawned = spawn(table.state, BILBO, { zone: "heroes", seat: 0 });
  return { ...table, state: updateCard(spawned.state, spawned.id, { resources }) };
}
const resourcesOfBilbo = (state: ScenarioState): number => state.cards[idOf(state, BILBO)]?.resources ?? 0;

// 131039 Dreary Hills and 131040 Lone-Lands: "Response: After Dreary Hills leaves play as an explored location, Bilbo Baggins (when in play) gains 1 resource." (131040:A:2 is the same line.)
for (const code of ["131039", "131040"]) {
  lineSpec(`${code}:A:2`, `Response (${code}:response:1): Bilbo Baggins gains 1 resource once the location has left play explored`, (effects) => {
    const table = withBilbo(effects, { active: code }, 0);
    const location = idOf(table.state, code);
    const steps: EngineStep[] = [];
    const placed = placeProgress({ ...table.state, activeLocation: location }, location, 5, table.ctx, steps);
    const explored = settle({ ...placed, window: null, mode: "stopped" }, table.ctx, steps);
    const run = { state: explored, steps };
    const trigger = legalIntents(explored, table.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === location);
    expect(trigger, `a Response of ${code} is offered`).toBeDefined();
    const done = finish(send(run, trigger as PlayerIntent, table.ctx), table.ctx);
    expect(resourcesOfBilbo(done.state)).toBe(1);
  });
}

// The Response of 131039 and 131040 is not offered when the location has not left play explored (progress short of its quest points), nor when Bilbo is not in play (it would change nothing, rr.triggered-ability).
for (const code of ["131039", "131040"]) {
  it(`${code}:A:2 Response is not offered while the location stays in play`, () => {
    const table = withBilbo(EFFECTS, { active: code }, 0);
    const location = idOf(table.state, code);
    const steps: EngineStep[] = [];
    const partly = settle({ ...placeProgress({ ...table.state, activeLocation: location }, location, 1, table.ctx, steps), window: null, mode: "stopped" }, table.ctx, steps);
    expect(legalIntents(partly, table.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === location)).toBe(false);
  });
  // FAULT: the card gives Bilbo a resource, and with Bilbo out of play the Response can change nothing, yet the engine offers it as the location leaves play explored. The cause is the gate of `noChangeReason` (src/rules/player/potential.ts): rr.triggered-ability bars a no-op only for a player card (and a player objective), and a location is neither, so the idle check never reads this Response.
  it.fails(`${code}:A:2 Response is not offered without Bilbo Baggins in play`, () => {
    const alone = tableFromLayout(ID, { active: code }, { effects: EFFECTS });
    const there = idOf(alone.state, code);
    const more: EngineStep[] = [];
    const explored = settle({ ...placeProgress({ ...alone.state, activeLocation: there }, there, 5, alone.ctx, more), window: null, mode: "stopped" }, alone.ctx, more);
    expect(legalIntents(explored, alone.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === there)).toBe(false);
  });
}

// 131039 Dreary Hills (2 quest points) and 131040 Lone-Lands (3): "Forced: After placing 1 or more progress tokens on this location, ..." The Forced hears every placement on the card, the one that explores it too (`progressPlacedOnSelf`, the reading of
// 131038:A:1 Hobbit-lands and of Bottomless Chasm 901606:A:1; docs/scenarios/the-hobbit/we-must-away-ere-break-of-day.md, We Must Away, Ere Break of Day).
function placeOnActive(effects: readonly Effect[], code: string, layout: Parameters<typeof tableFromLayout>[1], progress: number): ScenarioState {
  const table = tableFromLayout(ID, { active: code, ...layout }, { effects });
  const location = idOf(table.state, code);
  const steps: EngineStep[] = [];
  const placed = placeProgress({ ...table.state, activeLocation: location }, location, progress, table.ctx, steps);
  const settled = settle({ ...placed, window: null, mode: "stopped" }, table.ctx, steps);
  return finish({ state: settled, steps }, table.ctx).state;
}
const handSizes = (state: ScenarioState, seats = 1): number[] => state.seats.slice(0, seats).map((seat) => seat.hand.length);
const heroPools = (state: ScenarioState, seats = 1): number[] => state.seats.slice(0, seats).map((seat) => seat.heroes.reduce((sum, id) => sum + (state.cards[id]?.resources ?? 0), 0));

lineSpec("131039:A:1", "Forced (131039:forced:1): each player discards 1 card at random from his hand after progress is placed on it", (effects) => {
  expect(handSizes(placeOnActive(effects, "131039", { seats: 2, hand: ["f0", "f0", "f0"] }, 0), 2)).toEqual([3, 3]);
  const state = placeOnActive(effects, "131039", { seats: 2, hand: ["f0", "f0", "f0"] }, 1);
  expect(handSizes(state, 2)).toEqual([2, 2]);
});
lineSpec("131039:A:1", "Forced (131039:forced:1): the placement that explores it (2 quest points) is heard too", (effects) => {
  const state = placeOnActive(effects, "131039", { hand: ["f0", "f0", "f0"] }, 5);
  expect(handSizes(state)).toEqual([2]);
});
lineSpec("131039:A:1", "Forced (131039:forced:1): a player with an empty hand discards nothing and the others still discard", (effects) => {
  const state = placeOnActive(effects, "131039", { seats: 2, hand: [{ code: "f0", seat: 1 }, { code: "f0", seat: 1 }] }, 1);
  expect(handSizes(state, 2)).toEqual([0, 1]);
});

lineSpec("131040:A:1", "Forced (131040:forced:1): each player removes 1 resource from the pool of one of his heroes after progress is placed on it", (effects) => {
  const state = placeOnActive(effects, "131040", { seats: 2, heroResources: 2 }, 1);
  expect(heroPools(state, 2)).toEqual([3, 1]);
});
lineSpec("131040:A:1", "Forced (131040:forced:1): the placement that explores it (3 quest points) is heard too", (effects) => {
  const state = placeOnActive(effects, "131040", { heroResources: 2 }, 6);
  expect(heroPools(state)).toEqual([3]);
});
lineSpec("131040:A:1", "Forced (131040:forced:1): a player whose heroes hold no resources loses none, and no progress placed removes none", (effects) => {
  const none = placeOnActive(effects, "131040", { seats: 2 }, 1);
  expect(heroPools(none, 2)).toEqual([0, 0]);
  expect(heroPools(placeOnActive(effects, "131040", { heroResources: 2 }, 0))).toEqual([4]);
  expect(heroPools(placeOnActive(effects, "131040", { heroResources: 2 }, 1))).toEqual([3]);
});

// 131055 No Campfire. "Shadow: Defending player raises his threat by 2." Two players: only the defender's threat rises.
lineSpec("131055:A:3", "Shadow (131055:shadow:1): only the defending player raises his threat by 2, with two players", (effects) => {
  const fight = fightEnemy((layout) => tableFromLayout(ID, layout, { effects }), "131055", "f3", { seats: 2 as const, threat: [30, 30] as const }, { undefended: true });
  expect(fight.run.state.seats.slice(0, 2).map((seat) => seat.threat)).toEqual([32, 30]);
});

// 131057 More Like a Grocer. "When Revealed: Discard all resources from Bilbo Baggins' pool."
lineSpec("131057:A:1", "When Revealed: all the resources in Bilbo Baggins' pool are discarded", (effects) => {
  const table = withBilbo(effects, {}, 3);
  const done = resolveRecords(table.state, table.ctx, "131057", "whenRevealed");
  expect(resourcesOfBilbo(done.state)).toBe(0);
});
lineSpec("131057:A:2", "Shadow: its When Revealed effect resolves, so Bilbo's pool is emptied", (effects) => {
  const fight = fightEnemy((layout) => withBilbo(effects, layout, 3), "131057", "f3", {}, { undefended: true });
  expect(resourcesOfBilbo(fight.run.state)).toBe(0);
});

// 131056 Wind-whipped Rain. "Shadow: Defending character gets -1 Defense until the end of this attack." William attacks with 5 against Defense 2 (the stand-in hero): 3 damage, 4 with the shadow.
lineSpec("131056:A:2", "Shadow: the defending character gets -1 Defense until the end of the attack", (effects) => {
  const fight = fightEnemy((layout) => tableFromLayout(ID, layout, { effects }), "131056", "131032", {});
  expect(fight.run.state.cards[idOf(fight.run.state, "dh1")]?.damage).toBe(4);
});
