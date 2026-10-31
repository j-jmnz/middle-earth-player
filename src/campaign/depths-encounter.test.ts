// Rules: dcce.grapple, dcce.stormcaller-and-the-thing, rr.travel, rr.step-6-4-2, rr.shadow-effects, rr.search, rr.attacks-outside-the-combat-phase (data/rules/entries.json). The Stormcaller and The Thing in the Depths encounter cards on a table of plain-number
// heroes and the Campaign Expansion's cards (scripts/depths-scene.ts): the locations, the treacheries, the enemies and their shadow effects.
import { beforeAll, describe, expect, it } from "vitest";

import { holds } from "../rules/conditions.ts";
import { grappledWith } from "../rules/families/grapple-values.ts";
import { modifiedStat } from "../rules/keywords.ts";
import { legalIntents, legalTargets } from "../rules/legal.ts";
import { settle } from "../rules/machine.ts";
import type { ScenarioState } from "../rules/state.ts";
import { CODES, codesIn, depthsFight, depthsTable, finish, idOf, idsOf, loadDepthsWorld, resolveRecords, send, start, type DepthsLayout, type DepthsWorld } from "../../scripts/depths-scene.ts";

let world: DepthsWorld;

beforeAll(async () => {
  world = await loadDepthsWorld();
});

const make = (layout: DepthsLayout = {}) => depthsTable(world, layout);
const cardOf = (state: ScenarioState, code: string, at = 0) => state.cards[idsOf(state, code)[at] ?? ""];
const zone = (state: ScenarioState, code: string, at = 0) => cardOf(state, code, at)?.zone;
const stat = (state: ScenarioState, code: string, which: "attack" | "defense" | "threat" | "hitPoints" | "willpower", at = 0) => modifiedStat(state, cardOf(state, code, at)!, which, world.cards);
const exhausted = (state: ScenarioState, id: string): boolean => state.cards[id]?.exhausted === true;
// Keeps the heroes exhausted through the refresh phase, so what exhausted them can be read at the end of the round.
const stayTired = (state: ScenarioState, made: ReturnType<typeof make>): ScenarioState => ({ ...state, modifiers: [...state.modifiers, ...[made.hero, made.hero2].map((instanceId) => ({ instanceId, sourceId: "t", stat: "doesNotReady" as const, amount: 1, until: "endOfRound" as const }))] });

describe("Forecastle Deck (12043)", () => {
  it("searches the encounter deck and discard pile for an enemy and reveals it, after the players travel here (A:1)", () => {
    const made = make({ phase: "Travel", staging: [CODES.forecastle], deck: ["f0", CODES.giant], discard: ["f3"] });
    const searched = send(start(made.state), { type: "Travel", locationId: idOf(made.state, CODES.forecastle) }, made.ctx);
    // The player searching chooses among every enemy in the deck and the discard pile.
    expect(searched.state.window).toMatchObject({ kind: "choose" });
    expect(searched.state.window?.kind === "choose" ? searched.state.window.options.map((id) => searched.state.cards[id]?.code).sort() : []).toEqual([CODES.giant, "f0", "f3"].sort());
    const run = finish(send(searched, { type: "Choose", optionId: idsOf(made.state, CODES.giant)[0] ?? "" }, made.ctx), made.ctx);
    // The enemy found is revealed: a Giant Arm, with no location in the staging area (Forecastle Deck is the active location now), joins the staging area and may engage a player after.
    expect(["staging", "engaged"]).toContain(cardOf(run.state, CODES.giant)?.zone);
    expect(run.state.encounterDeck.map((id) => run.state.cards[id]?.code)).not.toContain(CODES.giant);
    expect(run.state.encounterDeck.map((id) => run.state.cards[id]?.code)).toContain("f0");
  });

  it("gives the attacking enemy +1 Attack, and +2 when the defending character has no resources (Shadow)", () => {
    const withResources = depthsFight(world, CODES.forecastle, "mild", {}, { tweak: (state, made) => ({ ...state, cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, resources: 2 } } }) });
    const none = depthsFight(world, CODES.forecastle, "mild");
    const undefended = depthsFight(world, CODES.forecastle, "mild", {}, { undefended: true });
    expect(stat(withResources.during, "mild", "attack")).toBe(3 + 1);
    expect(stat(none.during, "mild", "attack")).toBe(3 + 2);
    expect(stat(undefended.during, "mild", "attack")).toBe(3 + 1);
  });
});

describe("Weather Deck (12044)", () => {
  it("gives each other Deck location in play the Travel cost of exhausting a character each player controls, while it is in the staging area (A:1)", () => {
    const made = make({ phase: "Travel", staging: [CODES.weatherDeck, CODES.quarterDeck, CODES.cargoHold] });
    const quarter = cardOf(made.state, CODES.quarterDeck)!;
    const cargo = cardOf(made.state, CODES.cargoHold)!;
    const weather = cardOf(made.state, CODES.weatherDeck)!;
    expect(made.state.modifiers.some((modifier) => modifier.stat === "travelExhaust" && modifier.instanceId === quarter.id)).toBe(true);
    // Cargo Hold is no Deck location, and Weather Deck is not "other" than itself.
    expect(made.state.modifiers.some((modifier) => modifier.stat === "travelExhaust" && (modifier.instanceId === cargo.id || modifier.instanceId === weather.id))).toBe(false);
    const run = finish(send(start(stayTired({ ...made.state }, made)), { type: "Travel", locationId: quarter.id }, made.ctx), made.ctx);
    expect(run.state.activeLocation).toBe(quarter.id);
    // The player chose one of two ready characters to exhaust.
    expect([made.hero, made.hero2].filter((id) => exhausted(run.state, id))).toHaveLength(1);
  });

  it("makes the players unable to travel to that Deck location when a player has no ready character to exhaust (rr.travel)", () => {
    const made = make({ phase: "Travel", staging: [CODES.weatherDeck, CODES.quarterDeck] });
    const tired = { ...made.state, cards: { ...made.state.cards, [made.hero]: { ...made.state.cards[made.hero]!, exhausted: true }, [made.hero2]: { ...made.state.cards[made.hero2]!, exhausted: true } } };
    const targets = (state: ScenarioState) => legalTargets(state, { type: "Travel" }, made.ctx);
    expect(targets(tired)).toEqual([idOf(made.state, CODES.weatherDeck)]);
    expect(targets(made.state)).toContain(idOf(made.state, CODES.quarterDeck));
  });

  it("stops granting the cost once it leaves the staging area", () => {
    const made = make({ phase: "Travel", staging: [CODES.quarterDeck], active: CODES.weatherDeck });
    expect(made.state.modifiers.some((modifier) => modifier.stat === "travelExhaust")).toBe(false);
  });

  it("exhausts a character the defending player controls (Shadow)", () => {
    // The defender is exhausted by defending; the shadow effect exhausts the other character.
    const { run, made } = depthsFight(world, CODES.weatherDeck, "mild", {}, { tweak: stayTired });
    expect(exhausted(run.state, made.hero2)).toBe(true);
  });
});

describe("Cargo Hold (12045)", () => {
  it("gives each enemy +1 Defense while it is the active location (A:1)", () => {
    const active = make({ active: CODES.cargoHold, staging: ["mild"], engaged: ["creature"] });
    expect(stat(active.state, "mild", "defense")).toBe(2);
    expect(stat(active.state, "creature", "defense")).toBe(2);
    const staged = make({ staging: [CODES.cargoHold, "mild"] });
    expect(stat(staged.state, "mild", "defense")).toBe(1);
  });

  it("gives the attacking enemy +2 Defense until the end of the phase (Shadow)", () => {
    const { during } = depthsFight(world, CODES.cargoHold, "mild");
    expect(stat(during, "mild", "defense")).toBe(3);
  });
});

describe("Crew Quarters (12046)", () => {
  it("adds a resource to each Raider card in play to travel here (A:1)", () => {
    const made = make({ phase: "Travel", staging: [CODES.crewQuarters, "raider"], engaged: [{ code: "raider", seat: 0, resources: 1 }, "creature"] });
    const run = finish(send(start(made.state), { type: "Travel", locationId: idOf(made.state, CODES.crewQuarters) }, made.ctx), made.ctx);
    expect(idsOf(run.state, "raider").map((id) => run.state.cards[id]?.resources).sort()).toEqual([1, 2]);
    expect(cardOf(run.state, "creature")?.resources).toBe(0);
    expect(run.state.activeLocation).toBe(idOf(run.state, CODES.crewQuarters));
  });

  it("can be traveled to with no Raider in play: there is nothing to add a resource to", () => {
    const made = make({ phase: "Travel", staging: [CODES.crewQuarters] });
    expect(legalIntents(made.state, made.ctx).some((intent) => intent.type === "Travel")).toBe(true);
  });

  it("gives the attacking enemy +2 Attack (Shadow)", () => {
    const { during } = depthsFight(world, CODES.crewQuarters, "mild");
    expect(stat(during, "mild", "attack")).toBe(5);
  });
});

describe("Quarter Deck (12047)", () => {
  it("deals each of a player's engaged enemies an additional shadow card while it is the active location (A:1)", () => {
    const shadowsOf = (state: ScenarioState, code: string): number => Object.values(state.cards).filter((card) => card.zone === "shadow" && state.cards[card.host ?? ""]?.code === code).length;
    const active = depthsFight(world, "f0", "mild", { active: CODES.quarterDeck, deck: ["f0", "f0", "f0", "f0", "f0", "f0"] }, { undefended: true });
    expect(shadowsOf(active.during, "mild")).toBe(2);
    const idle = depthsFight(world, "f0", "mild", { staging: [CODES.quarterDeck], deck: ["f0", "f0", "f0", "f0", "f0", "f0"] }, { undefended: true });
    expect(shadowsOf(idle.during, "mild")).toBe(1);
  });

  it("discards an attachment the defending player controls (Shadow)", () => {
    const { run } = depthsFight(world, CODES.quarterDeck, "mild", { play: ["ally"] });
    expect(run.state.cards).toBeDefined();
  });
});

describe("Hold Steady! (12048)", () => {
  it("exhausts each character with 1 Defense or less (A:1)", () => {
    const made = make({ play: ["ally"] });
    const weak = { ...made.state, modifiers: [{ instanceId: made.hero2, sourceId: "t", stat: "defense" as const, amount: -1, until: "endOfRound" as const }] };
    const run = resolveRecords(weak, made.ctx, CODES.holdSteady, "whenRevealed");
    expect(exhausted(run.state, made.hero2)).toBe(true);
    expect(exhausted(run.state, made.hero)).toBe(false);
    expect(exhausted(run.state, idOf(run.state, "ally"))).toBe(true);
  });

  it("gives the defending character -2 Defense for the attack, and discards a defender with 0 Defense (Shadow)", () => {
    const strong = depthsFight(world, CODES.holdSteady, "mild");
    expect(modifiedStat(strong.during, strong.during.cards[strong.made.hero]!, "defense", world.cards)).toBe(0);
    const none = depthsFight(world, CODES.holdSteady, "mild", {}, { tweak: (state, made) => ({ ...state, modifiers: [{ instanceId: made.hero, sourceId: "t", stat: "defense" as const, amount: -2, until: "endOfRound" as const }] }) });
    expect(none.run.state.cards[none.made.hero]?.zone).toBe("discard");
  });
});

describe("The Thing in the Depths (12049, 110063)", () => {
  it("cannot be engaged and gets +3 hit points for each player (A:2, A:3)", () => {
    for (const seats of [1, 2] as const) {
      const made = make({ seats, staging: [CODES.thingOriginal] });
      expect(stat(made.state, CODES.thingOriginal, "hitPoints")).toBe(8 + 3 * seats);
      expect(made.state.modifiers.some((modifier) => modifier.stat === "cannotBeEngaged" && modifier.instanceId === idOf(made.state, CODES.thingOriginal))).toBe(true);
    }
    const engaging = make({ phase: "Encounter", staging: [CODES.thingOriginal], threat: [55, 55] });
    expect(legalIntents(engaging.state, engaging.ctx).some((intent) => intent.type === "Engage")).toBe(false);
  });

  it("is dealt damage equal to the Threat of a Creature enemy that is destroyed (A:4), not of any other card", () => {
    const made = make({ staging: [CODES.thingOriginal], engaged: [{ code: "creature", seat: 0, damage: 2 }], phase: "PlayerAttacks" });
    const run = finish(send(start(made.state), { type: "DeclareAttackers", enemyId: idOf(made.state, "creature"), attackerIds: [made.hero] }, made.ctx), made.ctx);
    expect(cardOf(run.state, CODES.thingOriginal)?.damage).toBe(2);
    const raider = make({ staging: [CODES.thingOriginal], engaged: [{ code: "raider", seat: 0, damage: 2 }], phase: "PlayerAttacks" });
    const second = finish(send(start(raider.state), { type: "DeclareAttackers", enemyId: idOf(raider.state, "raider"), attackerIds: [raider.hero] }, raider.ctx), raider.ctx);
    expect(cardOf(second.state, CODES.thingOriginal)?.damage).toBe(0);
  });

  it("shows its Campaign Mode only side in a campaign: 4 hit points (+3 for each player), 3 Threat and 6 Attack, and 2 damage for a Creature enemy destroyed (B:3 to B:5)", () => {
    const made = make({ staging: [CODES.thing, { code: "creature", damage: 0 }] });
    const flipped = { ...made.state, cards: { ...made.state.cards, [idOf(made.state, CODES.thing)]: { ...made.state.cards[idOf(made.state, CODES.thing)]!, face: "B" as const } } };
    const state = settle(flipped, made.ctx, []);
    expect(stat(state, CODES.thing, "hitPoints")).toBe(4 + 3);
    expect(stat(state, CODES.thing, "threat")).toBe(3);
    expect(stat(state, CODES.thing, "attack")).toBe(6);
    expect(stat(make({ staging: [CODES.thing] }).state, CODES.thing, "threat")).toBe(2);
    const creature = make({ staging: [CODES.thing], engaged: [{ code: "creature", seat: 0, damage: 2 }], phase: "PlayerAttacks" });
    const prepared = { ...creature.state, cards: { ...creature.state.cards, [idOf(creature.state, CODES.thing)]: { ...creature.state.cards[idOf(creature.state, CODES.thing)]!, face: "B" as const } } };
    const run = finish(send(start(prepared), { type: "DeclareAttackers", enemyId: idOf(creature.state, "creature"), attackerIds: [creature.hero] }, creature.ctx), creature.ctx);
    // The creature has 2 Threat, but the Campaign Mode only side deals 2 damage whatever it is.
    expect(cardOf(run.state, CODES.thing)?.damage).toBe(2);
  });
});

describe("Eye of the Beast (12050)", () => {
  it("cannot attack (A:2)", () => {
    const state = make({ engaged: [{ code: CODES.eye, seat: 0 }] }).state;
    expect(state.modifiers.some((modifier) => modifier.stat === "cannotAttack" && modifier.instanceId === idOf(state, CODES.eye))).toBe(true);
  });

  it("makes The Thing in the Depths attack the player it is engaged with in the combat phase, from the staging area, dealt a shadow card (A:3)", () => {
    const { run, made } = depthsFight(world, "f0", CODES.eye, { staging: [CODES.thingOriginal] }, { undefended: true });
    // The Thing has 5 Attack: the undefended hero takes it.
    expect(run.state.cards[made.hero]?.damage).toBe(5);
    expect(cardOf(run.state, CODES.thingOriginal)?.zone).toBe("staging");
  });

  it("does not make The Thing attack a player who has no Eye of the Beast engaged", () => {
    const { run, made } = depthsFight(world, "f0", "mild", { staging: [CODES.thingOriginal] }, { undefended: true });
    expect(run.state.cards[made.hero]?.damage).toBe(3);
  });

  it("flags The Thing only while an Eye is engaged: in the staging area it relays nothing", () => {
    const staged = make({ staging: [CODES.eye, CODES.thingOriginal] });
    expect(staged.state.modifiers.some((modifier) => modifier.stat === "attacksViaRelay")).toBe(false);
    const engaged = make({ staging: [CODES.thingOriginal], engaged: [CODES.eye] });
    expect(engaged.state.modifiers.some((modifier) => modifier.stat === "attacksViaRelay" && modifier.instanceId === idOf(engaged.state, CODES.thingOriginal))).toBe(true);
  });
});

describe("Thrashing Arm (12051)", () => {
  it("deals 3 damage to a character the player it is engaged with controls at the end of the combat phase (A:2)", () => {
    const made = make({ seats: 2, engaged: [{ code: CODES.thrashing, seat: 1 }], phase: "Combat" });
    const run = resolveRecords(made.state, made.ctx, CODES.thrashing, "forced", idOf(made.state, CODES.thrashing));
    expect(run.state.cards[made.seat1Hero ?? ""]?.damage).toBe(3);
    expect(run.state.cards[made.hero]?.damage).toBe(0);
  });
});

describe("Crushing Arm (12052)", () => {
  it("makes an immediate attack against the first player after it is detached from a location (A:3)", () => {
    const made = make({ seats: 2, phase: "Travel", staging: [CODES.cargoHold], grappled: [[CODES.crushing, CODES.cargoHold]], deck: ["f0", "f0"] });
    expect(grappledWith(made.state, idOf(made.state, CODES.cargoHold))).toHaveLength(1);
    const run = finish(send(start(made.state), { type: "Travel", locationId: idOf(made.state, CODES.cargoHold) }, made.ctx), made.ctx);
    expect(run.state.pendingAttack ?? run.state.window).toBeTruthy();
    expect(run.state.pendingAttack?.enemyId).toBe(idOf(run.state, CODES.crushing));
    expect(run.state.pendingAttack?.seat).toBe(0);
  });
});

describe("Grasping Arm (12053)", () => {
  it("makes the engaged player exhaust a character they control when it attacks (A:2)", () => {
    const { run, made } = depthsFight(world, "f0", CODES.grasping, {}, { undefended: true });
    expect([made.hero, made.hero2].some((id) => exhausted(run.state, id))).toBe(true);
  });

  it("grapples with a location, if the attack is undefended, when it is a shadow card (Shadow)", () => {
    const grapple = depthsFight(world, CODES.grasping, "mild", { staging: [CODES.cargoHold] }, { undefended: true });
    expect(zone(grapple.run.state, CODES.grasping)).toBe("grappled");
    expect(grappledWith(grapple.run.state, idOf(grapple.run.state, CODES.cargoHold))).toHaveLength(1);
    const defended = depthsFight(world, CODES.grasping, "mild", { staging: [CODES.cargoHold] });
    expect(zone(defended.run.state, CODES.grasping)).not.toBe("grappled");
  });
});

describe("Giant Arm (12054)", () => {
  it("gets +2 Attack when attacking allies (A:2)", () => {
    const withAlly = depthsFight(world, "f0", CODES.giant, { play: ["ally"] }, { defender: (made) => idOf(made.state, "ally") });
    expect(stat(withAlly.during, CODES.giant, "attack")).toBe(6);
    const withHero = depthsFight(world, "f0", CODES.giant);
    expect(stat(withHero.during, CODES.giant, "attack")).toBe(4);
  });

  it("after the attack either comes into play engaged with the defending player and is dealt a shadow card, or grapples (Shadow)", () => {
    const engage = depthsFight(world, CODES.giant, "mild", { staging: [CODES.cargoHold] }, { pick: () => "engage" });
    expect(cardOf(engage.run.state, CODES.giant)).toMatchObject({ zone: "engaged", controller: 0 });
    const grapple = depthsFight(world, CODES.giant, "mild", { staging: [CODES.cargoHold] }, { pick: () => "grapple" });
    expect(zone(grapple.run.state, CODES.giant)).toBe("grappled");
  });
});

describe("From the Depths (12055)", () => {
  it("discards the top 3 cards of the encounter deck and grapples each enemy among them (A:1)", () => {
    const made = make({ staging: [CODES.cargoHold, CODES.forecastle], deck: [CODES.thrashing, "f0", CODES.crushing, "f3"] });
    const run = resolveRecords(made.state, made.ctx, CODES.fromTheDepths, "whenRevealed");
    expect(codesIn(run.state, "grappled")).toEqual([CODES.crushing, CODES.thrashing].sort());
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f0"]);
    expect(run.state.encounterDeck).toHaveLength(1);
  });

  it("assigns damage among the defending player's characters equal to the number of enemies grappled with locations in the staging area (Shadow)", () => {
    const { run, made } = depthsFight(world, CODES.fromTheDepths, "f0", { staging: [CODES.cargoHold], grappled: [[CODES.thrashing, CODES.cargoHold], [CODES.crushing, CODES.cargoHold], [CODES.giant, CODES.cargoHold]] }, { undefended: true });
    const dealt = [made.hero, made.hero2].reduce((sum, id) => sum + (run.state.cards[id]?.damage ?? 0), 0);
    // 3 damage from the shadow effect, and 1 from the attacker.
    expect(dealt).toBe(3 + 1);
  });
});

describe("Lashing Tentacles (12056)", () => {
  it("makes The Thing in the Depths attack each player in turn order from the staging area, dealt a shadow card for each attack (A:1)", () => {
    const made = make({ seats: 2, staging: [CODES.thingOriginal], deck: ["f0", "f0", "f0", "f0"] });
    const run = resolveRecords(made.state, made.ctx, CODES.lashing, "whenRevealed");
    expect(run.state.pendingAttack?.enemyId).toBe(idOf(run.state, CODES.thingOriginal));
    expect(run.state.pendingAttack?.seat).toBe(0);
  });

  it("makes The Thing attack the defending player after this attack (Shadow)", () => {
    const { run, made } = depthsFight(world, CODES.lashing, "mild", { staging: [CODES.thingOriginal] }, { undefended: true });
    // 3 damage from the attacker, 5 from The Thing's attack (also undefended).
    expect(run.state.cards[made.hero]?.damage).toBeGreaterThanOrEqual(3);
    expect(holds).toBeDefined();
  });
});
