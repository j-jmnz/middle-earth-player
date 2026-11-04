// Rules: dcce.encounter-cards, dcce.scalable-upgradable, dcce.immune, dcce.stormcaller-elite, rr.cancel (data/rules/entries.json). Black Key (burden) and Calaerion, the cards the campaign card of Flight of the
// Stormcaller puts out, on both sides: what Black Key does to the enemy it is attached to, and Calaerion's Actions and Response.
import { beforeAll, describe, expect, it } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import { legalIntents } from "../../../rules/engine/legal.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { withMode, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import { CODES, flightTable, idOf, loadFlightWorld, send, start, type FlightLayout, type FlightWorld } from "../../../../test/scenarios/flight-of-the-stormcaller/scene.ts";

let world: FlightWorld;

beforeAll(async () => {
  world = await loadFlightWorld();
});

const make = (layout: FlightLayout = {}) => flightTable(world, layout);

// Black Key on the Stormcaller, on the side given.
function withKey(layout: FlightLayout = {}, face: "up" | "B" = "up") {
  const made = make(layout);
  const key = spawn(made.state, CODES.blackKey, { zone: "play", seat: 0 }, face);
  return { ...made, state: attachTo(key.state, key.id, made.caller), key: key.id };
}

describe("Black Key (11192)", () => {
  it("gives the attached enemy +1 Threat, +1 Attack, +1 Defense and immunity to player card effects, on both sides (A:2, B:2)", () => {
    for (const face of ["up", "B"] as const) {
      const made = withKey({ campaignSide: true }, face);
      const synced = syncConstants(made.state, made.ctx);
      const caller = synced.cards[made.caller]!;
      expect([modifiedStat(synced, caller, "threat", world.cards), modifiedStat(synced, caller, "attack", world.cards), modifiedStat(synced, caller, "defense", world.cards)]).toEqual([3, 8, 7]);
      expect(synced.modifiers.some((modifier) => modifier.stat === "immuneToPlayerCards" && modifier.instanceId === made.caller)).toBe(true);
    }
  });

  it("places a resource on Captain Sahír for each player at the end of the quest phase (A:3), and not on its Upgraded side (B)", () => {
    const run = (face: "up" | "B", seats: 1 | 2): number => {
      const made = withKey({ seats, staging: ["11076"], phase: "Quest" }, face);
      const to = settle(withMode({ ...made.state, window: null, mode: "resolution" }, "optionalEngage"), made.ctx, []);
      return to.cards[idOf(to, "11076")]?.resources ?? 0;
    };
    expect(run("up", 1)).toBe(1);
    expect(run("up", 2)).toBe(2);
    expect(run("B", 2)).toBe(0);
  });

  it("also finds Captain Sahír in the Stormcaller's area, where he is in play (A:3)", () => {
    const made = withKey({ area: ["11076"], phase: "Quest" });
    expect(made.state.cards[idOf(made.state, "11076")]?.zone).toBe("stormcallerArea");
    const to = settle(withMode({ ...made.state, window: null, mode: "resolution" }, "optionalEngage"), made.ctx, []);
    expect(to.cards[idOf(to, "11076")]?.resources).toBe(1);
  });

  it("is removed from the game when it leaves play (A:1, B:1)", () => {
    const made = withKey({});
    const left = moveCard(made.state, made.key, { zone: "discard", seat: 0 });
    const settled = settle(left, made.ctx, []);
    expect(settled.cards[made.key]?.zone).toBe("removed");
  });
});

describe("Calaerion (11193)", () => {
  const withCalaerion = (face: "up" | "B", layout: FlightLayout = {}) => {
    const made = make({ play: ["ally"], phase: "Planning", ...layout });
    const spawned = spawn(made.state, CODES.calaerion, { zone: "play", seat: 0 }, face);
    const loaded = { ...spawned.state, cards: { ...spawned.state.cards, [made.hero]: { ...spawned.state.cards[made.hero]!, resources: 4 } } };
    return { ...made, state: settle({ ...loaded, window: { kind: "pass" } }, made.ctx, []), calaerion: spawned.id };
  };
  const use = (made: ReturnType<typeof withCalaerion>, effectId: string): ScenarioState => {
    const offered = legalIntents(made.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === made.calaerion && intent.effectId === effectId);
    if (offered?.type !== "Trigger") throw new Error(`${effectId} is not offered`);
    let run = send(start(made.state), { type: "Trigger", cardId: offered.cardId, effectId: offered.effectId, payments: [{ heroId: made.hero, amount: effectId.endsWith("1") ? 3 : 2 }] }, made.ctx);
    for (let guard = 0; guard < 8 && run.state.window?.kind === "choose"; guard += 1) run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, made.ctx);
    return run.state;
  };

  it("A:2 spends 3 resources and exhausts him to ready the Dream-chaser and give it +1 Willpower, +1 Attack and +1 Defense until the end of the phase", () => {
    const made = withCalaerion("up");
    const chaser = idOf(made.state, CODES.dreamChaser);
    const tired = { ...made.state, cards: { ...made.state.cards, [chaser]: { ...made.state.cards[chaser]!, exhausted: true } } };
    const state = use({ ...made, state: settle(tired, made.ctx, []) }, "11193:action:1");
    expect(state.cards[made.calaerion]?.exhausted).toBe(true);
    expect(state.cards[made.hero]?.resources).toBe(1);
    expect(state.cards[chaser]?.exhausted).toBe(false);
    expect(state.modifiers.filter((modifier) => modifier.instanceId === chaser && modifier.until === "endOfPhase").map((modifier) => [modifier.stat, modifier.amount]).sort()).toEqual([["attack", 1], ["defense", 1], ["willpower", 1]]);
  });

  it("B:3 spends 2 resources and exhausts him to ready another ally and give it +1 Willpower, +1 Attack and +1 Defense until the end of the round", () => {
    const made = withCalaerion("B");
    const ally = idOf(made.state, "ally");
    const tired = { ...made.state, cards: { ...made.state.cards, [ally]: { ...made.state.cards[ally]!, exhausted: true } } };
    const state = use({ ...made, state: settle(tired, made.ctx, []) }, "11193:action:2");
    expect(state.cards[ally]?.exhausted).toBe(false);
    expect(state.modifiers.filter((modifier) => modifier.instanceId === ally && modifier.until === "endOfRound").map((modifier) => modifier.stat).sort()).toEqual(["attack", "defense", "willpower"]);
  });

  it("B:2 offers to shuffle a card discarded from the encounter deck back into it, once a round", () => {
    const made = withCalaerion("B", { deck: ["f3", "f0"] });
    const discarded = moveCard(made.state, made.state.encounterDeck[0] ?? "", { zone: "encounterDiscard" });
    const settled = settle({ ...discarded, window: null, mode: "stopped" }, made.ctx, []);
    expect(settled.window?.kind).toBe("response");
    const offered = legalIntents(settled, made.ctx).find((intent) => intent.type === "Trigger");
    if (offered?.type !== "Trigger") throw new Error("no Response offered");
    const run = send(start(settled), { type: "Trigger", cardId: offered.cardId, effectId: offered.effectId }, made.ctx);
    expect(run.state.encounterDeck).toHaveLength(2);
    expect(run.state.encounterDiscard).toHaveLength(0);
  });
});
