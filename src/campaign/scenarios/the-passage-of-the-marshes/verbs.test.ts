// Rules: rr.defending-player, rr.travel, rr.search, mec112.saga-staging-rules (data/rules/entries.json); ledger lines 144017:A:2, 144020:A:3, 144026:A:2, 144066:A:1. The shared verbs The Passage of the Marshes widened, on its own table: the defending player a RaiseThreat names,
// a Travel cost of Fellowship resources, the topmost Undead enemy of the discard pile an effect picks, the Undead enemies engaged with the actor that attack, and the victory display shuffled into the deck. Each test title starts with the line it covers
// (scripts/checks/spec-coverage.test.ts). The mire and gollum families' own tests are src/rules/families/mire/index.test.ts and src/rules/families/gollum/index.test.ts.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { travelCostUnpayable } from "../../../rules/interpret/restrictions.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { probeTable } from "../../../../scripts/card-smoke/encounter.ts";
import { encounterWorld, type EncounterWorld } from "../../../../scripts/card-smoke/encounter-world.ts";
import { idOf, resolveRecords } from "../../../../test/harness/scene-kit.ts";

let world: EncounterWorld;
let table: ScenarioState;
const ctxOf = () => world.contexts.strong;

beforeAll(async () => {
  world = await encounterWorld("the-passage-of-the-marshes");
  table = probeTable(world);
});

const two = (): ScenarioState => ({ ...table, seatCount: 2, seats: [table.seats[0]!, { ...table.seats[1]!, eliminated: false }] });

describe("the defending player", () => {
  it("144017:A:2 raises the threat of the player the source enemy is engaged with by 3, whoever controlled the destroyed character", () => {
    const base = two();
    const enemy = spawn(base, "144017", { zone: "engaged", seat: 1 });
    const before = base.seats.map((seat) => seat.threat);
    const run = runInstruction(enemy.state, { verb: "RaiseThreat", amount: 3, who: "defendingPlayer" }, { seat: 0, sourceId: enemy.id }, ctxOf(), []);
    expect(run.seats[1]?.threat).toBe((before[1] ?? 0) + 3);
    expect(run.seats[0]?.threat).toBe(before[0]);
  });
});

describe("a Travel cost of Fellowship resources", () => {
  it("144020:A:3 cannot be paid while no hero of the players holds a resource, and can once one does", () => {
    const quagmire = spawn(table, "144020", { zone: "staging" });
    const none = syncConstants(quagmire.state, ctxOf());
    const hero = none.seats[0]?.heroes[0] ?? "";
    const empty = { ...none, cards: { ...none.cards, [hero]: { ...none.cards[hero]!, resources: 0 } } };
    expect(travelCostUnpayable(empty, ctxOf(), quagmire.id)).toBe(true);
    const paid = { ...none, cards: { ...none.cards, [hero]: { ...none.cards[hero]!, resources: 1 } } };
    expect(travelCostUnpayable(paid, ctxOf(), quagmire.id)).toBe(false);
  });

  it("144020:A:3 spends 1 resource from a Fellowship hero when the players travel", () => {
    const hero = table.seats[0]?.heroes[0] ?? "";
    const funded = { ...table, cards: { ...table.cards, [hero]: { ...table.cards[hero]!, resources: 2 } } };
    const quagmire = spawn(funded, "144020", { zone: "staging" });
    const run = resolveRecords(quagmire.state, ctxOf(), "144020", "travel", quagmire.id);
    expect(run.state.cards[hero]?.resources).toBe(1);
  });
});

describe("the topmost Undead enemy of the encounter discard pile", () => {
  const withDiscard = (): { state: ScenarioState; undead: string; wraith: string } => {
    const undead = spawn(table, "144016", { zone: "encounterDiscard" });
    const wraith = spawn(undead.state, "144053", { zone: "encounterDiscard" });
    return { state: wraith.state, undead: undead.id, wraith: wraith.id };
  };

  it("144026:A:2 is put into play engaged with the revealing player, skipping a non-Undead enemy above it, and attacks", () => {
    const { state, undead, wraith } = withDiscard();
    const run = resolveRecords(state, ctxOf(), "144026", "whenRevealed", undefined, undefined, false);
    expect(run.state.cards[undead]?.zone).toBe("engaged");
    expect(run.state.cards[undead]?.controller).toBe(0);
    expect(run.state.cards[wraith]?.zone).toBe("encounterDiscard");
    expect(run.state.pendingAttack?.enemyId).toBe(undead);
  });

  it("144026:A:2 makes each Undead enemy already engaged with the player attack even when no card was put into play", () => {
    const engaged = spawn(table, "144016", { zone: "engaged", seat: 0 });
    const run = resolveRecords(engaged.state, ctxOf(), "144026", "whenRevealed", undefined, undefined, false);
    expect(run.state.pendingAttack?.enemyId).toBe(engaged.id);
  });

  it("144026:A:3 returns it to the staging area when the Shadow resolves", () => {
    const { state, undead } = withDiscard();
    const run = resolveRecords(state, ctxOf(), "144026", "shadow", undefined, undefined, false);
    expect(run.state.cards[undead]?.zone).toBe("staging");
  });
});

describe("the victory display shuffled into the encounter deck", () => {
  it("144066:A:1 moves every location of the display into the deck and leaves the display empty", () => {
    const first = spawn(table, "144021", { zone: "victory" });
    const second = spawn(first.state, "144023", { zone: "victory" });
    const run = runInstruction(second.state, { verb: "ShuffleVictoryIntoEncounterDeck" }, { seat: 0, sourceId: null }, ctxOf(), []);
    expect(run.victory).toEqual([]);
    expect(run.encounterDeck).toContain(first.id);
    expect(run.encounterDeck).toContain(second.id);
    expect(idOf(run, "144075")).toBe(idOf(table, "144075"));
  });
});
