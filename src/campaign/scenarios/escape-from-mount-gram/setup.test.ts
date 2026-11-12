// Rules: mec108.captured-deck, mec108.capture-x, mec108.create-staging-area, mec108.campaign-setup-escape-from-mount-gram, mec108.campaign-log (data/rules/entries.json); ledger lines 10038:A:1, 10038:B:1, 10039:A:1, 10039:A:2, 10174:A:2, 10174:B:3.
// A game of Escape from Mount Gram started from the campaign: the Setup of the quest card and of the campaign card, stage 2A, and what the Resolution records for the campaign.
import { beforeAll, describe, expect, it } from "vitest";

import { emptyLog } from "../../log.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { capturedDeck, capturedUnder } from "../../../rules/families/captured/pile.ts";
import { recordStolenCards } from "../../../rules/families/campaign/damage-tracking.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { idOf, tableFromLayout } from "../../../../test/harness/scene-kit.ts";
import { gramStart, gramWorld } from "../../../../test/scenarios/escape-from-mount-gram/game.ts";

describe("Setup", () => {
  let world: Awaited<ReturnType<typeof gramWorld>>;
  beforeAll(async () => {
    world = await gramWorld("strong");
  }, 120_000);

  // The deck holds three copies of each boon (allies and Items), so each captured deck has more than the Setup captures.
  const BOONS = ["10176", "10177", "10178", "10179", "10180", "10181"];
  const deck = [...BOONS, ...BOONS, ...BOONS, ...Array.from({ length: 12 }, () => "filler")];

  function begin(seats: 1 | 2) {
    const loadout = Array.from({ length: seats }, (_, seat) => ({ heroes: seat === 0 ? ["q1", "q2", "q3"] : ["q4", "q5", "q6"], deck }));
    let state = startScenario(gramStart(seats, 7, "Normal", undefined, emptyLog(seats), undefined, loadout), world.ctx);
    state = expectOk(reduce(state, { type: "Keep" }, world.ctx)).state;
    if (seats === 2) state = expectOk(reduce(state, { type: "Keep" }, world.ctx)).state;
    // Each player chooses the starting hero: the first of the heroes.
    for (let guard = 0; guard < 20 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, world.ctx)).state;
    return state;
  }

  it("10038:A:1 prepares each captured deck from the allies and Items of the deck and the other heroes, sets the threat to the starting hero's cost and draws a new hand", () => {
    const state = begin(1);
    const seat = state.seats[0];
    const names = (ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
    // The starting hero stays, the other two heroes were captured, and no ally or Item of the deck is left in it or in the hand.
    expect(names(seat.heroes)).toEqual(["q1"]);
    expect(Object.values(state.cards).filter((card) => card.zone === "captured" && card.heroSlot != null).map((card) => card.code).sort()).toEqual(["q2", "q3"]);
    expect([...seat.deck, ...seat.hand].every((id) => !BOONS.includes(state.cards[id]?.code ?? ""))).toBe(true);
    expect(Object.values(state.cards).filter((card) => card.zone === "captured" && BOONS.includes(card.code))).toHaveLength(18);
    // The dial is the starting hero's threat cost, and the hand is a new one of 3 (plus the resource phase's draw).
    expect(seat.threat).toBe(printedOf(world.cards, "q1").threat);
    expect(seat.hand).toHaveLength(4);
    expect(state.cards[seat.heroes[0] ?? ""]?.resources).toBeGreaterThanOrEqual(2);
  });

  it("10174:A:2, 10039:A:1 and 10039:A:2 capture the bottom 5 under Loot the Dungeons before stage 2A captures 7, and Prison Cell holds 3 cards", () => {
    const state = begin(1);
    const stage = idOf(state, "10039");
    const loot = idOf(state, "10175");
    const cell = state.seats[0].staging.find((id) => state.cards[id]?.code === "10046") ?? "";
    // The quest deck dealt one 2A for the seat, which is that seat's stage, with its own staging area: Prison Cell is in it.
    expect(state.separate).toBe(true);
    expect(state.seats[0].stage).toBe(stage);
    expect(cell).not.toBe("");
    expect(capturedUnder(state, loot)).toHaveLength(5);
    expect(capturedUnder(state, stage)).toHaveLength(7);
    expect(capturedUnder(state, cell)).toHaveLength(3);
    expect(capturedDeck(state, 0)).toHaveLength(20 - 5 - 7 - 3);
  });

  it("10038:B:1 gives each of two players a different stage 2A and a staging area of their own, each with a Prison Cell", () => {
    const state = begin(2);
    const stages = state.seats.map((seat) => seat.stage);
    expect(new Set(stages).size).toBe(2);
    expect(state.seats.every((seat) => seat.staging.some((id) => state.cards[id]?.code === "10046"))).toBe(true);
    // Loot the Dungeons is in the shared staging area, in no seat's area.
    const loot = idOf(state, "10175");
    expect(state.seats.every((seat) => !seat.staging.includes(loot))).toBe(true);
    expect(capturedUnder(state, loot)).toHaveLength(10);
  });
});

describe("Resolution", () => {
  it("10174:B:3 records the unique cards still in each captured deck, not those underneath a card", () => {
    const t = tableFromLayout("escape-from-mount-gram", { stage: "10039", campaign: true });
    const stage = t.state.questStage ?? "";
    const pile = spawn(t.state, "10176", { zone: "captured", hostId: null, seat: 0 }, "down");
    const under = spawn(pile.state, "dh2", { zone: "captured", hostId: stage, seat: 0 }, "down");
    const loose = spawn(under.state, "ally", { zone: "captured", hostId: null, seat: 0 }, "down").state;
    expect(recordStolenCards(loose, t.ctx).stolen).toEqual([["10176"]]);
  });
});
