// Rules: mec109.stage-4, rr.active-location, rr.explored, rr.first-player, rr.ownership-and-control, rr.forced, rr.lasting-effects, rr.attachment-cards (data/rules/entries.json).
// The Ring Goes South lines that read the Ring-bearer: 142024:A:3, 142030:A:2, 142084:A:2. The table is the scenario's scene (Frodo Baggins, the Ring-bearer with The One Ring, and Sam in the first seat; Merry in the second).
import { beforeAll, describe, expect, it } from "vitest";

import type { Instruction } from "../../../catalog/boundary.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { expireModifiers, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { RING } from "../../../../test/harness/scene.ts";
import { first } from "../../../../test/harness/scene-kit.ts";
import { DOORS, LUST, loadSouthWorld, southTable, WATCHER, type SouthLayout, type SouthWorld } from "../../../../test/scenarios/the-ring-goes-south/scene.ts";

let world: SouthWorld;

beforeAll(async () => {
  world = await loadSouthWorld();
});

function make(layout: SouthLayout = {}, firstPlayer = 0) {
  const made = southTable(world, layout);
  return { ...made, state: syncConstants({ ...made.state, firstPlayer }, made.ctx) };
}

type Table = ReturnType<typeof make>;

const settled = (table: Table, state: ScenarioState) => settle(syncConstants(state, table.ctx), table.ctx, []);
const run = (table: Table, state: ScenarioState, instruction: Instruction, sourceId: string | null) => settled(table, runInstruction({ ...state, window: null }, instruction, { seat: 0, sourceId }, table.ctx, []));
// Combat damage on the card (an attack by the players' characters).
const hit = (table: Table, state: ScenarioState, id: string, amount: number) => settled(table, placeDamage(state, id, amount, table.ctx.cards, [], "combat", ruleCause("rr.step-6-8-3")));
// The quest card places the progress: the locations are immune to player card effects, so a hero's effect would place none (rr.immune).
const progress = (table: Table, state: ScenarioState, amount: number) => run(table, state, { verb: "ProgressQuest", amount }, state.questStage);

describe("142024 Watcher in the Water", () => {
  // "Forced: After placing the 6th damage here, the first player takes control of the Ring-bearer, exhausted with 1 damage on it." The second seat holds the first player token; Frodo was the first seat's.
  it("142024:A:3 gives the Ring-bearer to the first player, exhausted with 1 damage, on the 6th damage and not the 5th", () => {
    const table = make({ stage: "142023", seats: 2, captive: true, active: DOORS }, 1);
    const watcher = first(table.state, WATCHER);
    const five = hit(table, table.state, watcher, 5);
    expect(five.cards[table.frodo]?.zone).toBe("captive");
    const six = hit(table, five, watcher, 1);
    const frodo = six.cards[table.frodo];
    expect(frodo?.zone).toBe("heroes");
    expect(frodo?.controller).toBe(1);
    expect(six.seats[1]?.heroes).toContain(table.frodo);
    expect(six.seats[0]?.heroes).not.toContain(table.frodo);
    expect(frodo?.exhausted).toBe(true);
    expect(frodo?.damage).toBe(1);
  });
});

describe("142030 Doors of Durin", () => {
  // "Progress must be placed on each other active location before it can be placed here." The other active location has 4 quest points.
  it("142030:A:2 takes no progress before the other active location is explored, then the rest", () => {
    const table = make({ stage: "142023", active: DOORS, second: "place" });
    const doors = first(table.state, DOORS);
    const place = first(table.state, "place");
    const three = progress(table, table.state, 3);
    expect(three.cards[place]?.progress).toBe(3);
    expect(three.cards[doors]?.progress).toBe(0);
    const six = progress(table, table.state, 6);
    expect(six.cards[place]?.zone).toBe("encounterDiscard");
    expect(six.cards[doors]?.progress).toBe(2);
  });

  // "Progress cannot be placed here unless the first player controls the Ring-bearer."
  it("142030:A:2 takes progress while the first player controls the Ring-bearer", () => {
    const table = make({ stage: "142023", active: DOORS });
    expect(progress(table, table.state, 3).cards[first(table.state, DOORS)]?.progress).toBe(3);
  });

  it("142030:A:2 takes no progress while the Ring-bearer is under the Watcher", () => {
    const table = make({ stage: "142023", active: DOORS, captive: true });
    expect(progress(table, table.state, 3).cards[first(table.state, DOORS)]?.progress).toBe(0);
  });

  it("142030:A:2 takes no progress while a player other than the first player controls the Ring-bearer", () => {
    const table = make({ stage: "142023", seats: 2, active: DOORS }, 1);
    expect(progress(table, table.state, 3).cards[first(table.state, DOORS)]?.progress).toBe(0);
  });
});

describe("142084 Lust for the Ring", () => {
  // "When Revealed: Attach to a non-Fellowship hero in play." Frodo is a Fellowship hero; Sam (Leadership) is the one other hero, so nothing is asked. Surge reveals the f3 after it.
  it("142084:A:2 attaches to the one non-Fellowship hero without a choice, never to the Fellowship hero", () => {
    const table = make({ stage: "142022", deck: [LUST, "f3"] });
    const state = run(table, table.state, { verb: "RevealEncounter" }, table.state.questStage);
    expect(state.window?.kind).not.toBe("choose");
    expect(state.cards[first(state, LUST)]?.host).toBe(table.sam);
  });

  it("142084:A:2 lets the first player choose among the non-Fellowship heroes of every player", () => {
    const table = make({ stage: "142022", seats: 2, deck: [LUST, "f3"] });
    const asked = run(table, table.state, { verb: "RevealEncounter" }, table.state.questStage);
    expect(asked.window?.kind === "choose" ? [...asked.window.options].sort() : []).toEqual([table.sam, table.merry ?? ""].sort());
    const done = settled(table, expectOk(reduce(asked, { type: "Choose", optionId: table.merry ?? "" }, table.ctx)).state);
    expect(done.cards[first(done, LUST)]?.host).toBe(table.merry);
  });

  // "Forced: After The One Ring exhausts, raise each player's threat by 1 and reduce attached hero's Willpower to 0 until the end of the round."
  function lustOnSam(seats: 1 | 2): { table: Table; state: ScenarioState } {
    const table = make({ stage: "142022", seats });
    const spawned = spawn(table.state, LUST, { zone: "attached" });
    return { table, state: syncConstants(attachTo(spawned.state, spawned.id, table.sam), table.ctx) };
  }
  const willpower = (table: Table, state: ScenarioState, id: string) => modifiedStat(state, state.cards[id]!, "willpower", table.ctx.cards);

  it("142084:A:2 raises each player's threat by 1 and sets the attached hero's Willpower to 0 until the end of the round", () => {
    const { table, state } = lustOnSam(2);
    const ring = first(state, RING);
    const exhausted = run(table, state, { verb: "Exhaust", target: { kind: "byCode", code: RING } }, ring);
    expect(exhausted.seats.map((seat) => seat.threat)).toEqual(state.seats.map((seat) => seat.threat + 1));
    expect(willpower(table, exhausted, table.sam)).toBe(0);
    expect(willpower(table, exhausted, table.frodo)).toBe(willpower(table, state, table.frodo));
    // The end of the round ends it.
    const next = syncConstants(expireModifiers(exhausted, ["endOfPhase", "endOfRound"]), table.ctx);
    expect(willpower(table, next, table.sam)).toBe(willpower(table, state, table.sam));
  });

  it("142084:A:2 does nothing when a card other than The One Ring exhausts", () => {
    const { table, state } = lustOnSam(1);
    const exhausted = run(table, state, { verb: "Exhaust", target: { kind: "byCode", code: "141002" } }, table.sam);
    expect(exhausted.cards[table.sam]?.exhausted).toBe(true);
    expect(exhausted.seats[0]?.threat).toBe(state.seats[0]?.threat);
    expect(willpower(table, exhausted, table.sam)).toBe(willpower(table, state, table.sam));
  });
});
