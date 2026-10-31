// Rules: dcce.aflame, dcce.stormcaller-elite, rr.step-6-2, rr.step-6-4-2, rr.shadow-effects, rr.step-1-2, rr.first-player (data/rules/entries.json). The Raid on the Grey Havens and Corsair Raiders encounter cards and the
// Stormcaller Elite's enemy sides: the Raiders that grow with resources, the shadow effects, the treacheries, on a table of plain-number heroes and the Campaign Expansion's cards (scripts/raid-scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { modifiedStat } from "../rules/keywords.ts";
import { legalIntents } from "../rules/legal.ts";
import { settle } from "../rules/machine.ts";
import { runInstruction } from "../rules/interpret.ts";
import { shadowCards } from "../rules/zones.ts";
import type { ScenarioState } from "../rules/state.ts";
import { CODES, idOf, idsOf, loadRaidWorld, raidFight, raidTable, resolveRecords, send, start, type RaidLayout, type RaidWorld } from "../../scripts/raid-scene.ts";

let world: RaidWorld;

beforeAll(async () => {
  world = await loadRaidWorld();
});

const cardOf = (state: ScenarioState, code: string, at = 0) => state.cards[idsOf(state, code)[at] ?? ""];
const make = (layout: RaidLayout = {}) => raidTable(world, layout);
const stat = (state: ScenarioState, code: string, which: "attack" | "defense") => modifiedStat(state, cardOf(state, code)!, which, world.cards);

describe("Umbar Raider (11064)", () => {
  it("gets +1 Attack for each resource on it (A:1)", () => {
    const made = make({ engaged: [{ code: CODES.umbar, seat: 0, resources: 3 }] });
    expect(stat(made.state, CODES.umbar, "attack")).toBe(6);
  });

  it("after it attacks you, moves 1 resource from one of your heroes' pools to it (A:2)", () => {
    const { run } = raidFight(world, "f0", CODES.umbar, { hero: 0 } as never, { tweak: (state, made) => ({ ...state, cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, resources: 2 } } }) });
    expect(cardOf(run.state, CODES.umbar)?.resources).toBe(1);
    expect(cardOf(run.state, "dh1")?.resources).toBe(1);
  });
});

describe("Corsair Infiltrator (11065)", () => {
  it("is dealt 1 additional shadow card for each resource on it when it attacks (A:1)", () => {
    const dealt = (resources: number) => {
      const { during } = raidFight(world, "f0", CODES.infiltrator, {}, { tweak: (state) => ({ ...state, cards: { ...state.cards, [idOf(state, CODES.infiltrator)]: { ...state.cards[idOf(state, CODES.infiltrator)]!, resources } } }) });
      const card = cardOf(during, CODES.infiltrator);
      return shadowCards(card).length;
    };
    expect(dealt(0)).toBe(1);
    expect(dealt(2)).toBe(3);
  });

  it("takes 1 resource from one of the engaged player's heroes after they collect resources, in the resource phase (A:2)", () => {
    const made = make({ engaged: [{ code: CODES.infiltrator, seat: 0 }] });
    const resourcePhase = { ...made.state, phase: "Resource" as const, boundaryPhase: "Resource" as const, mode: "resourceGrant" as const, window: null };
    const settled = settle(resourcePhase, made.ctx, []);
    // Each hero collected 1; the engaged player's chosen hero gave 1 of its resources to the Infiltrator.
    expect(settled.window).toMatchObject({ kind: "choose", options: [made.hero, made.hero2] });
    const chosen = send(start(settled), { type: "Choose", optionId: made.hero2 }, made.ctx).state;
    expect(cardOf(chosen, CODES.infiltrator)?.resources).toBe(1);
    expect(chosen.cards[made.hero]?.resources).toBe(1);
    expect(chosen.cards[made.hero2]?.resources).toBe(0);
  });
});

describe("Raid Leader (11066)", () => {
  it("gets +1 Defense for each resource on it (A:1)", () => {
    const made = make({ engaged: [{ code: CODES.raidLeader, seat: 0, resources: 2 }] });
    expect(stat(made.state, CODES.raidLeader, "defense")).toBe(3);
  });

  it("when it engages you, moves 1 resource from each of your heroes' pools to it (A:2)", () => {
    const made = make({ phase: "Encounter", staging: [CODES.raidLeader] });
    const heroes = [made.hero, made.hero2];
    const loaded = { ...made.state, cards: Object.fromEntries(Object.entries(made.state.cards).map(([id, card]) => [id, heroes.includes(id) ? { ...card, resources: 2 } : card])) };
    const run = send(start(loaded), { type: "Engage", enemyId: idOf(loaded, CODES.raidLeader) }, made.ctx);
    expect(cardOf(run.state, CODES.raidLeader)?.resources).toBe(2);
    expect(run.state.cards[made.hero]?.resources).toBe(1);
  });
});

describe("Battle-Hardened (11067)", () => {
  it("places 1 resource on each Raider, and each engaged non-Ship enemy attacks (A:1)", () => {
    const made = make({ engaged: [{ code: "raider", seat: 0 }, { code: "ship", seat: 0 }], staging: ["raider"] });
    const run = resolveRecords(made.state, made.ctx, CODES.hardened, "whenRevealed");
    expect(idsOf(run.state, "raider").map((id) => run.state.cards[id]?.resources)).toEqual([1, 1]);
    expect(run.steps.filter((step) => step.kind === "attack" && step.side === "enemy").length).toBe(1);
  });

  it("gains surge when no engaged non-Ship enemy attacked (A:1)", () => {
    const made = make({ deck: [CODES.hardened, "f0", "f0"], engaged: [{ code: "ship", seat: 0 }] });
    const run = send(start(made.state), { type: "Pass" }, made.ctx);
    expect(run.state.staging.filter((id) => run.state.cards[id]?.code === "f0")).toHaveLength(1);
  });
});

// The shadow card (the first of the deck) resolves when the enemy attacks the first hero, who defends.
const shadowed = (shadow: string, enemy: string, layout: RaidLayout = {}, tweak?: (state: ScenarioState, made: ReturnType<typeof make>) => ScenarioState) => raidFight(world, shadow, enemy, layout, tweak ? { tweak } : {});
const withTokens = (state: ScenarioState, code: string, tokens: { resources?: number; damage?: number }, at = 0): ScenarioState => {
  const id = idsOf(state, code)[at] ?? "";
  return { ...state, cards: { ...state.cards, [id]: { ...state.cards[id]!, ...tokens } } };
};

describe("shadow effects", () => {
  it("Mithlond Harbor gives the attacking enemy +1 Attack for each damage on the active location (11042:A:3)", () => {
    const { during } = shadowed(CODES.harbor, "mild", { active: { code: CODES.pillaged, damage: 2 } });
    expect(modifiedStat(during, cardOf(during, "mild")!, "attack", world.cards)).toBe(5);
  });

  it("Pillaged Ship moves all resources from the defending character to an attacking Raider (11044:A:3)", () => {
    const { run } = shadowed(CODES.pillaged, "raider", {}, (state, made) => withTokens(state, "dh1", { resources: 3 }, 0) && { ...state, cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, resources: 3 } } });
    expect(cardOf(run.state, "raider")?.resources).toBe(3);
    expect(cardOf(run.state, "dh1")?.resources).toBe(0);
  });

  it("Pillaged Ship does nothing to the resources when the attacker is no Raider (11044:A:3)", () => {
    const { run } = shadowed(CODES.pillaged, "mild", {}, (state, made) => ({ ...state, cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, resources: 3 } } }));
    expect(cardOf(run.state, "mild")?.resources).toBe(0);
    expect(cardOf(run.state, "dh1")?.resources).toBe(3);
  });

  it("Elven Wave-runner discards a card at random from the defending player's hand and places 1 resource on an attacking Raider (11046:A:3)", () => {
    const { run } = shadowed(CODES.waveRunner, "raider");
    expect(cardOf(run.state, "raider")?.resources).toBe(1);
    expect(run.state.seats[0]?.hand).toHaveLength(1);
  });

  it("Put to the Torch deals 3 damage to an Aflame active location, or 1 damage to the defending character (11048:A:2)", () => {
    const location = shadowed(CODES.torch, "mild", { active: { code: CODES.pillaged } }, undefined);
    expect(cardOf(location.run.state, CODES.pillaged)?.damage).toBe(3);
    const hero = raidFight(world, CODES.torch, "mild", { active: { code: CODES.pillaged } }, { pick: (state) => (state.window?.kind === "choose" ? (state.window.options.includes("character") ? "character" : (state.window.options[0] ?? "")) : "") });
    expect(cardOf(hero.run.state, "dh1")?.damage).toBeGreaterThanOrEqual(1);
    const plain = shadowed(CODES.torch, "mild", { active: { code: "place" } });
    expect(plain.run.state.cards[idOf(plain.run.state, "place")]?.damage).toBe(0);
  });

  it("The Fires Spread deals 1 damage to each Aflame location when its attack destroys a character (11049:A:3)", () => {
    const destroyed = raidFight(world, CODES.fires, "mild", { active: { code: CODES.pillaged } }, { tweak: (state, made) => ({ ...state, cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, damage: 5 } } }) });
    expect(cardOf(destroyed.run.state, "dh1")?.zone).toBe("discard");
    expect(cardOf(destroyed.run.state, CODES.pillaged)?.damage).toBe(1);
    expect(cardOf(destroyed.run.state, CODES.dreamChaser)?.damage).toBe(1);
    const spared = shadowed(CODES.fires, "mild", { active: { code: CODES.pillaged } });
    expect(cardOf(spared.run.state, CODES.pillaged)?.damage).toBe(0);
  });

  it("Burning Piers is added to the staging area after the attack (11043:A:4)", () => {
    const { run } = shadowed(CODES.piers, "mild");
    expect(cardOf(run.state, CODES.piers)?.zone).toBe("staging");
  });
});

describe("Elven Wave-runner, once explored (11046:A:2)", () => {
  it("offers its Response after it is added to the victory display, and each player draws 1 card when it is used", () => {
    const made = make({ stage: "11036", active: { code: CODES.waveRunner }, seats: 2, deckOf: ["c1", "c2", "c3"] });
    const placed = runInstruction({ ...made.state, window: null }, { verb: "ProgressQuest", amount: 3 }, { seat: 0, sourceId: made.state.questStage }, made.ctx, []);
    const settled = settle({ ...placed, mode: "stopped" }, made.ctx, []);
    expect(cardOf(settled, CODES.waveRunner)?.zone).toBe("victory");
    expect(settled.window?.kind).toBe("response");
    const offered = legalIntents(settled, made.ctx).find((intent) => intent.type === "Trigger");
    expect(offered).toBeDefined();
    if (offered?.type !== "Trigger") return;
    const used = send(start(settled), { type: "Trigger", cardId: offered.cardId, effectId: offered.effectId }, made.ctx);
    expect(used.state.seats[0]?.hand).toHaveLength(1);
    expect(used.state.seats[1]?.hand).toHaveLength(1);
  });
});
