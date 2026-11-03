// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages, dcce.sailing-tests, dcce.boarding, dcce.heading, dcce.archery, rr.step-6-4-2, rr.shadow-effects, rr.search, rr.doomed-x (data/rules/entries.json).
// The Flight of the Stormcaller encounter cards on a table of plain-number heroes and the Campaign Expansion's cards (scripts/stormcaller-scene.ts): the ships that grow or engage on a commitment, the
// locations, the treacheries and the shadow effects.
import { beforeAll, describe, expect, it } from "vitest";

import { modifiedStat } from "../rules/keywords.ts";
import { settle } from "../rules/machine.ts";
import { legalIntents } from "../rules/legal.ts";
import { withMode, type ScenarioState } from "../rules/state.ts";
import { areaOf } from "../rules/families/stormcaller/zone.ts";
import { spawn } from "../rules/zones.ts";
import { CODES, codesIn, finish, flightFight, flightTable, idOf, idsOf, loadFlightWorld, resolveRecords, send, start, type FlightLayout, type FlightWorld } from "../../scripts/stormcaller-scene.ts";

let world: FlightWorld;

beforeAll(async () => {
  world = await loadFlightWorld();
});

const cardOf = (state: ScenarioState, code: string, at = 0) => state.cards[idsOf(state, code)[at] ?? ""];
const make = (layout: FlightLayout = {}) => flightTable(world, layout);
const zone = (state: ScenarioState, code: string, at = 0) => cardOf(state, code, at)?.zone;

describe("Sahír's Escort (12020)", () => {
  it("is added to the Stormcaller's area, not the staging area, when it is revealed (A:4)", () => {
    const made = make({});
    const run = resolveRecords(made.state, made.ctx, CODES.escort, "whenRevealed");
    expect(run.state.cards[run.id]?.zone).toBe("stormcallerArea");
    expect(areaOf(run.state)?.members).toContain(run.id);
  });

  it("contributes its Threat to the Stormcaller's progress while it is in the area, and not in the staging area (A:3)", () => {
    const made = make({ area: [CODES.escort] });
    expect(made.state.modifiers.some((modifier) => modifier.stat === "stormcallerThreat" && modifier.instanceId === idOf(made.state, CODES.escort))).toBe(true);
    const caught = make({ staging: [CODES.escort] });
    expect(caught.state.modifiers.some((modifier) => modifier.stat === "stormcallerThreat")).toBe(false);
  });

  it("cannot have attachments (A:2)", () => {
    const made = make({ area: [CODES.escort] });
    expect(made.state.modifiers.some((modifier) => modifier.stat === "cannotHaveAttachments" && modifier.instanceId === idOf(made.state, CODES.escort))).toBe(true);
  });
});

describe("Swift Raider (12021)", () => {
  const commit = (made: ReturnType<typeof make>, ids: readonly string[]) => finish(send(start(made.state), { type: "Commit", cardIds: ids }, made.ctx), made.ctx);

  it("engages a player who commits 4 or more characters to the quest while it is in the staging area (A:3)", () => {
    const made = make({ staging: [CODES.raider], play: ["ally", "ally", "ally", "ally"] });
    const heroes = [made.hero, made.hero2];
    const allies = Object.values(made.state.cards).filter((card) => card.code === "ally").map((card) => card.id);
    const run = commit(made, [...heroes, ...allies.slice(0, 2)]);
    expect(cardOf(run.state, CODES.raider)).toMatchObject({ zone: "engaged", controller: 0 });
  });

  it("stays in the staging area when fewer than 4 characters are committed, and when it is not in the staging area", () => {
    const few = make({ staging: [CODES.raider], play: ["ally"] });
    expect(zone(commit(few, [few.hero, few.hero2]).state, CODES.raider)).toBe("staging");
    const area = make({ area: [CODES.raider], play: ["ally", "ally"] });
    const allies = Object.values(area.state.cards).filter((card) => card.code === "ally").map((card) => card.id);
    expect(zone(commit(area, [area.hero, area.hero2, ...allies]).state, CODES.raider)).toBe("stormcallerArea");
  });
});

describe("Corsair Skiff (12022)", () => {
  // A table with a Corsair deck of one enemy (dcce.corsair-deck), or with a Corsair discard pile of one, or with neither.
  const withCorsairs = (state: ScenarioState, pile: "corsairDeck" | "corsairDiscard" | null): ScenarioState => {
    const base: ScenarioState = { ...state, corsairDeck: [], corsairDiscard: [] };
    return pile ? spawn(base, "corsair", { zone: pile }).state : base;
  };

  it("lets the engaged player raise their threat by 3 or have it gain Boarding 1 when it engages from the staging area (A:3)", () => {
    const made = make({ phase: "Encounter", staging: [CODES.skiff] });
    const engaged = settle({ ...withCorsairs(made.state, "corsairDeck"), window: null, mode: "engagement" }, made.ctx, []);
    expect(engaged.window).toMatchObject({ kind: "choose", options: ["threat", "boarding"] });
    const raised = send(start(engaged), { type: "Choose", optionId: "threat" }, made.ctx).state;
    expect(raised.seats[0]?.threat).toBe(31);
    const boarded = send(start(engaged), { type: "Choose", optionId: "boarding" }, made.ctx).state;
    expect(boarded.seats[0]?.threat).toBe(28);
    expect(modifiedStat(boarded, cardOf(boarded, CODES.skiff)!, "hitPoints", world.cards)).toBeGreaterThan(0);
    expect(boarded.modifiers.some((modifier) => modifier.stat === "boarding" && modifier.amount === 1)).toBe(true);
  });

  it("offers Boarding when only the Corsair discard pile holds a card, and raises the threat without asking when neither pile does (rr.effects: an option that changes nothing is not offered)", () => {
    const made = make({ phase: "Encounter", staging: [CODES.skiff] });
    const discarded = settle({ ...withCorsairs(made.state, "corsairDiscard"), window: null, mode: "engagement" }, made.ctx, []);
    expect(discarded.window).toMatchObject({ kind: "choose", options: ["threat", "boarding"] });
    const empty = settle({ ...withCorsairs(made.state, null), window: null, mode: "engagement" }, made.ctx, []);
    expect(empty.window?.kind).not.toBe("choose");
    expect(empty.seats[0]?.threat).toBe(31);
    expect(empty.modifiers.some((modifier) => modifier.stat === "boarding")).toBe(false);
  });

  it("does not ask when the engagement is not from the staging area", () => {
    const made = make({ phase: "Encounter", engaged: [CODES.skiff] });
    expect(made.state.seats[0]?.engaged).toHaveLength(1);
    const run = resolveRecords(made.state, made.ctx, CODES.skiff, "forced", idOf(made.state, CODES.skiff));
    expect(run.state.window).toBeNull();
  });
});

describe("Corsair Seafarer (12023)", () => {
  it("gets +1 Attack for each resource on it (A:1)", () => {
    const made = make({ engaged: [{ code: CODES.seafarer, seat: 0, resources: 3 }] });
    expect(modifiedStat(made.state, cardOf(made.state, CODES.seafarer)!, "attack", world.cards)).toBe(2 + 3);
  });

  it("takes a resource from a hero the engaged player commits to the quest (A:2)", () => {
    const made = make({ engaged: [CODES.seafarer] });
    const loaded = { ...made.state, cards: { ...made.state.cards, [made.hero]: { ...made.state.cards[made.hero]!, resources: 2 } } };
    const run = finish(send(start(loaded), { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx), made.ctx);
    expect(cardOf(run.state, CODES.seafarer)?.resources).toBe(1);
    expect(run.state.cards[made.hero]?.resources).toBe(1);
    // A hero with no resource gives none.
    expect(run.state.cards[made.hero2]?.resources).toBe(0);
  });

  it("takes a resource from a hero the first player commits to a Sailing test (A:2)", () => {
    const made = make({ engaged: [CODES.seafarer], stage: "12013", deck: ["f0", "f0", "f0", "f0"] });
    const loaded = { ...made.state, cards: { ...made.state.cards, [made.hero]: { ...made.state.cards[made.hero]!, resources: 2 } } };
    const asked = settle({ ...loaded, mode: "questCommit", window: null }, made.ctx, []);
    expect(asked.sea?.sailing).toEqual({ step: "ask" });
    const run = finish(send(start(asked), { type: "Commit", cardIds: [made.hero] }, made.ctx), made.ctx);
    expect(cardOf(run.state, CODES.seafarer)?.resources).toBe(1);
    expect(run.state.cards[made.hero]?.resources).toBe(1);
  });
});

describe("Serpent's Blade (12024)", () => {
  it("makes an immediate attack against the engaged player when the Stormcaller advances (A:1)", () => {
    const made = make({ engaged: [CODES.blade], caller: 2, callerProgress: 11, deck: ["f3"], phase: "Refresh" });
    const settled = settle({ ...made.state, phase: "Beginning of round", boundaryPhase: "End of round", mode: "beginRound", window: null }, made.ctx, []);
    expect(settled.sea?.stormcaller?.number).toBe(3);
    // The attack opens the defense window for the engaged player's heroes.
    expect(settled.pendingAttack ?? settled.window).toBeTruthy();
    expect(settled.pendingAttack?.enemyId).toBe(idOf(settled, CODES.blade));
  });
});

describe("Jagged Reef (12025)", () => {
  const travelPhase = (heading: "Sun" | "Cloud", ships: number) => {
    const made = make({ staging: [CODES.reef], heading, phase: "Encounter" });
    const settled = settle(withMode({ ...made.state, window: null, mode: "engagement" }, "travel"), made.ctx, []);
    return { made, settled, ships };
  };
  it("gets 2 progress at the beginning of the travel phase when the players are on-course (A:2)", () => {
    const { settled } = travelPhase("Sun", 1);
    expect(cardOf(settled, CODES.reef)?.progress).toBe(2);
    expect(settled.cards[idOf(settled, CODES.dreamChaser)]?.damage).toBe(0);
  });

  it("deals 2 damage to each Ship objective instead when they are off-course (A:2)", () => {
    const { settled } = travelPhase("Cloud", 1);
    expect(cardOf(settled, CODES.reef)?.progress).toBe(0);
    expect(settled.cards[idOf(settled, CODES.dreamChaser)]?.damage).toBe(2);
  });
});

describe("Hidden Cove (12026)", () => {
  it("heals 4 damage from each Ship objective after it becomes the active location (A:2)", () => {
    const made = make({ staging: [CODES.cove], phase: "Travel", progress: 2 });
    const chaser = idOf(made.state, CODES.dreamChaser);
    // The Travel cost moves 2 progress from the quest: with less on it the players cannot travel here (rr.travel).
    const bare = make({ staging: [CODES.cove], phase: "Travel" });
    expect(legalIntents(bare.state, bare.ctx).some((intent) => intent.type === "Travel")).toBe(false);
    const hurt = { ...made.state, cards: { ...made.state.cards, [chaser]: { ...made.state.cards[chaser]!, damage: 6 } } };
    expect(legalIntents(hurt, made.ctx).some((intent) => intent.type === "Travel")).toBe(true);
    const traveled = send(start(hurt), { type: "Travel", locationId: idOf(hurt, CODES.cove) }, made.ctx).state;
    expect(traveled.window?.kind).toBe("response");
    const offered = legalIntents(traveled, made.ctx).find((intent) => intent.type === "Trigger");
    if (offered?.type !== "Trigger") throw new Error("no Response offered");
    const run = send(start(traveled), { type: "Trigger", cardId: offered.cardId, effectId: offered.effectId }, made.ctx);
    expect(run.state.cards[chaser]?.damage).toBe(2);
  });
});

describe("Vast Coastland (12027)", () => {
  it("is added to the Stormcaller's area when it is revealed (A:1)", () => {
    const made = make({});
    const run = resolveRecords(made.state, made.ctx, CODES.coastland, "whenRevealed");
    expect(run.state.cards[run.id]?.zone).toBe("stormcallerArea");
  });

  it("gives the attacking enemy +2 Attack only if the players are at the Stormcaller's stage (A:2)", () => {
    const attackOf = (layout: FlightLayout): number => {
      const { during, made } = flightFight(world, CODES.coastland, "mild", layout);
      return modifiedStat(during, cardOf(during, "mild")!, "attack", made.ctx.cards);
    };
    expect(attackOf({ stage: "12013" })).toBe(3 + 2);
    expect(attackOf({ stage: "12012" })).toBe(3);
  });
});

describe("Man Overboard! (12028)", () => {
  it("makes each player contributing at least 8 Willpower to the quest discard a questing character (A:1)", () => {
    const made = make({ seats: 2, hand: [] });
    const heroes = [made.hero, made.hero2, made.seat1Hero ?? ""];
    const strong = { ...made.state, cards: Object.fromEntries(Object.entries(made.state.cards).map(([id, card]) => [id, heroes.includes(id) ? { ...card, committed: true } : card])) };
    const boosted = { ...strong, modifiers: [{ instanceId: made.hero, sourceId: "t", stat: "willpower" as const, amount: 9, until: "endOfRound" as const }, { instanceId: made.hero2, sourceId: "t", stat: "willpower" as const, amount: 9, until: "endOfRound" as const }] };
    const run = resolveRecords(boosted, made.ctx, CODES.overboard, "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    // Seat 0 contributes 2 + 9 + 2 + 9 = 22 Willpower and discards one hero; seat 1's lone hero contributes 2.
    expect(codesIn(run.state, "discard").filter((code) => code.startsWith("dh"))).toEqual(["dh1"]);
    expect(codesIn(run.state, "heroes")).toEqual(["dh2", "dh3"]);
  });

  it("discards nothing from a player contributing less than 8 Willpower", () => {
    const made = make({});
    const run = resolveRecords({ ...made.state, cards: { ...made.state.cards, [made.hero]: { ...made.state.cards[made.hero]!, committed: true } } }, made.ctx, CODES.overboard, "whenRevealed");
    expect(codesIn(run.state, "heroes")).toEqual(["dh1", "dh2"]);
  });

  it("gives the attacking enemy +X Attack, X the Stormcaller's current quest stage (A:2)", () => {
    for (const caller of [2, 3, 4] as const) {
      const { during, made } = flightFight(world, CODES.overboard, "mild", { caller });
      expect(modifiedStat(during, cardOf(during, "mild")!, "attack", made.ctx.cards)).toBe(3 + caller);
    }
  });
});

describe("Raging Squall (12029)", () => {
  it("is attached to the current quest as a Condition attachment (A:2)", () => {
    const made = make({});
    const run = resolveRecords(made.state, made.ctx, CODES.squall, "whenRevealed");
    expect(run.state.cards[run.id]?.host).toBe(run.state.questStage);
    expect(run.state.cards[run.state.questStage ?? ""]?.attachments).toContain(run.id);
  });

  it("deals 1 damage to an ally committed to the quest when the players are off-course, and none on-course", () => {
    const damageTo = (heading: "Sun" | "Cloud"): number => {
      const made = make({ heading, play: ["ally"] });
      const attached = resolveRecords(made.state, made.ctx, CODES.squall, "whenRevealed").state;
      const ally = idOf(attached, "ally");
      const run = finish(send(start({ ...attached, window: { kind: "pass" }, mode: "questCommit" }), { type: "Commit", cardIds: [ally] }, made.ctx), made.ctx);
      return run.state.cards[ally]?.damage ?? 0;
    };
    expect(damageTo("Cloud")).toBe(1);
    expect(damageTo("Sun")).toBe(0);
  });
});
