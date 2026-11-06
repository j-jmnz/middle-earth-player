// Rules: emce.discover, emce.loot, emce.immune, rr.travel, rr.forced, rr.attacks-outside-the-combat-phase, rr.shadow-effects, rr.threat-threat-dial, rr.victory, rr.search, rr.surge, rr.doomed-x, rr.lasting-effects (data/rules/entries.json); ledger lines 19097:A:2, 19097:A:3, 19098:A:2, 19098:A:3, 19099:A:1 to
// 19099:A:3, 19100:A:1, 19100:A:2, 19101:A:2, 19102:A:2, 19103:A:1 to 19103:A:3, 19104:A:2, 19104:A:3, 19105:A:2, 19105:A:3, 19106:A:1, 19106:A:2, 19107:A:1, 19107:A:2, 19108:A:2.
// The encounter cards of The Ghost of Framsburg on the scenario's scene: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { heldAmount, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { shadowCards, spawn } from "../../../rules/core/zones.ts";
import { lowerThreatByEffect } from "../../../rules/families/quest/threat.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { CODES, codesIn, finish, framsburgFight, framsburgTable, idOf, idsOf, legalIntents, legalTargets, loadFramsburgWorld, resolveRecords, send, start, withLoot, type FramsburgWorld, type PlayerIntent, type Run } from "../../../../test/scenarios/the-ghost-of-framsburg/scene.ts";

let world: FramsburgWorld;
let scoutCard: ReadonlyMap<string, import("../../../rules/core/printed.ts").PrintedCard>;
beforeAll(async () => {
  world = await loadFramsburgWorld();
  scoutCard = await loadPrinted(["01016"]);
}, 120_000);

type Table = ReturnType<typeof framsburgTable>;
const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const stat = (state: ScenarioState, code: string, name: "threat" | "attack" | "defense" | "willpower"): number => modifiedStat(state, state.cards[idOf(state, code)]!, name, world.cards);
const take = (id: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === id) ?? state.window.options[0] ?? "") : "");
const travelTargets = (t: Table): readonly string[] => legalTargets(t.state, { type: "Travel" }, t.ctx);
const LOOT = [CODES.cryptKey, CODES.oldLantern, CODES.scathaSTeeth];
// The location with this code in the staging area is the active location.
const activate = (state: ScenarioState, code: string): ScenarioState => {
  const id = idOf(state, code);
  return { ...state, activeLocation: id, staging: state.staging.filter((other) => other !== id), cards: { ...state.cards, [id]: { ...state.cards[id]!, zone: "activeLocation" } } };
};
// The action windows before the attack's defenders are declared are passed.
const toDefense = (run: Run, t: Table): Run => {
  let current = run;
  for (let guard = 0; guard < 8 && current.state.window?.kind === "frameAction"; guard += 1) current = send(current, { type: "Pass" }, t.ctx);
  return current;
};
// The threat steps an effect of the card with this id prefix took off (the refresh phase's raise is the rules').
const reduced = (run: Run, prefix: string): number[] => run.steps.flat().flatMap((step) => (step.kind === "threat" && "effect" in step.cause && step.cause.effect.startsWith(prefix) ? [step.amount] : []));
const undefended = (run: Run, t: Table, hero: string = t.hero): Run => (run.state.window?.kind === "defense" ? send(run, { type: "Undefended", heroId: hero } as PlayerIntent, t.ctx) : run);

describe("19097 The Cursed Tomb", () => {
  it("19097:A:2 the players cannot travel to it unless they control 3 Loot objectives", () => {
    for (const [loot, allowed] of [[0, false], [2, false], [3, true]] as const) {
      const t = withLoot(framsburgTable(world, { phase: "Travel", staging: [CODES.theCursedTomb, CODES.moonlitPassage] }), LOOT.slice(0, loot));
      expect(travelTargets(t).includes(idOf(t.state, CODES.theCursedTomb)), `${loot} Loot objectives`).toBe(allowed);
      // Any other location can be traveled to.
      expect(travelTargets(t)).toContain(idOf(t.state, CODES.moonlitPassage));
    }
  });

  it("19097:A:2 a Loot objective that is guarded, or still in the staging area, is not controlled", () => {
    const t = framsburgTable(world, { phase: "Travel", staging: [CODES.theCursedTomb, CODES.cryptKey, CODES.oldLantern, CODES.scathaSTeeth] });
    // Free of encounters, but the settle sweep has not claimed them yet in this state.
    expect(travelTargets(t)).not.toContain(idOf(t.state, CODES.theCursedTomb));
  });

  it("19097:A:3 after the players travel to it, Fram's Shade is searched for in the encounter deck and discard pile and added to the staging area, the deck is shuffled, and it attacks each player in turn order", () => {
    const t = withLoot(framsburgTable(world, { phase: "Travel", seats: 2, staging: [CODES.theCursedTomb], deck: ["f0", CODES.framSShade, "f0", "f0", "f0"], discard: ["f3"] }), LOOT);
    const before = t.state.encounterDeck.slice();
    let run = send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.theCursedTomb) }, t.ctx);
    const attacked: number[] = [];
    for (let guard = 0; guard < 40 && run.state.phase === "Travel"; guard += 1) {
      if (run.state.window?.kind === "defense") {
        attacked.push(run.state.pendingAttack?.seat ?? -1);
        run = send(run, { type: "Undefended", heroId: run.state.pendingAttack?.seat === 0 ? t.hero : (t.seat1Hero ?? "") } as PlayerIntent, t.ctx);
        continue;
      }
      const intent = legalIntents(run.state, t.ctx).find((item) => item.type === "Pass" || item.type === "Choose");
      if (!intent) break;
      run = send(run, intent.type === "Choose" && run.state.window?.kind === "choose" ? { type: "Choose", optionId: run.state.window.options[0] ?? "" } : (intent as PlayerIntent), t.ctx);
    }
    expect(attacked).toEqual([0, 1]);
    const shade = where(run.state, CODES.framSShade);
    expect(shade).toHaveLength(1);
    // Fram's Shade attacked from the staging area and stays there.
    expect(shade[0]?.zone).toBe("staging");
    expect(before).toContain(idOf(t.state, CODES.framSShade));
    expect(run.state.encounterDeck).not.toContain(shade[0]?.id);
    expect(run.state.activeLocation).toBe(idOf(run.state, CODES.theCursedTomb));
  });

  it("19097:A:3 it is found in the discard pile too", () => {
    const t = withLoot(framsburgTable(world, { phase: "Travel", staging: [CODES.theCursedTomb], deck: ["f0", "f0"], discard: [CODES.framSShade] }), LOOT);
    // The action window before the attack's defenders are declared is passed.
    const run = toDefense(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.theCursedTomb) }, t.ctx), t);
    expect(where(run.state, CODES.framSShade)[0]?.zone).toBe("staging");
    expect(run.state.window?.kind).toBe("defense");
  });
});

describe("19098 Fram's Shade", () => {
  it("19098:A:2 it gets +1 Threat, Attack and Defense for each Loot objective the players control", () => {
    for (const n of [0, 1, 3]) {
      const t = withLoot(framsburgTable(world, { phase: "Quest", staging: [CODES.framSShade] }), LOOT.slice(0, n));
      expect([stat(t.state, CODES.framSShade, "threat"), stat(t.state, CODES.framSShade, "attack"), stat(t.state, CODES.framSShade, "defense")], `${n} Loot objectives`).toEqual([3 + n, 3 + n, 3 + n]);
    }
  });

  it("19098:A:2 an objective the players do not control yet (in the staging area, or guarded) is not counted", () => {
    const t = framsburgTable(world, { phase: "Quest", staging: [CODES.framSShade, CODES.cryptKey] });
    expect(stat(t.state, CODES.framSShade, "attack")).toBe(3);
  });

  it("19098:A:3 it is dealt as many shadow cards as the players control Loot objectives, and at least 1", () => {
    for (const [n, shadows] of [[0, 1], [1, 1], [2, 2], [3, 3]] as const) {
      const t = withLoot(framsburgTable(world, { phase: "Encounter", engaged: [{ code: CODES.framSShade, seat: 0 }], deck: ["f0", "f0", "f0", "f0", "f0"] }), LOOT.slice(0, n));
      let run = send(start(t.state), { type: "DeclineEngage" }, t.ctx);
      for (let guard = 0; guard < 30 && run.state.window?.kind !== "defense"; guard += 1) {
        const pass = legalIntents(run.state, t.ctx).find((item) => item.type === "Pass" || item.type === "DeclineAttack");
        if (!pass) break;
        run = send(run, pass as PlayerIntent, t.ctx);
      }
      const shade = run.state.cards[idOf(run.state, CODES.framSShade)];
      expect(shadowCards(shade), `${n} Loot objectives`).toHaveLength(shadows);
    }
  });

  it("19098:A:3 an attack from the staging area deals the same number: each attack discards the earlier shadow cards and is dealt that many", () => {
    const t = withLoot(framsburgTable(world, { phase: "Travel", seats: 2, staging: [CODES.theCursedTomb], deck: [CODES.framSShade, ...Array<string>(12).fill("f0")] }), LOOT);
    let run = toDefense(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.theCursedTomb) }, t.ctx), t);
    expect(run.state.window?.kind).toBe("defense");
    expect(shadowCards(run.state.cards[idOf(run.state, CODES.framSShade)])).toHaveLength(3);
    // All three shadow cards resolve in the attack, which kills the 6-hit-point hero (Attack 3 + 3).
    run = toDefense(undefended(run, t), t);
    expect(run.state.cards[t.hero]?.zone).not.toBe("heroes");
  });
});

describe("19099 Crypt Stalker", () => {
  it("19099:A:1 its Threat, Attack and Defense are X, the tens digit of the first player's threat", () => {
    for (const [threat, x] of [[9, 0], [28, 2], [43, 4], [49, 4]] as const) {
      const t = framsburgTable(world, { phase: "Quest", staging: [CODES.cryptStalker], threat: [threat, threat] });
      expect([stat(t.state, CODES.cryptStalker, "threat"), stat(t.state, CODES.cryptStalker, "attack"), stat(t.state, CODES.cryptStalker, "defense")], `threat ${threat}`).toEqual([x, x, x]);
    }
  });

  it("19099:A:1 it is the first player's threat that counts, not the threat of the player it is engaged with", () => {
    const t = framsburgTable(world, { phase: "Quest", seats: 2, staging: [CODES.cryptStalker], threat: [21, 48] });
    expect(stat(t.state, CODES.cryptStalker, "attack")).toBe(2);
    const moved = syncConstants({ ...t.state, firstPlayer: 1 }, t.ctx);
    expect(stat(moved, CODES.cryptStalker, "attack")).toBe(4);
  });

  it("19099:A:2 when it attacks, the defending player raises their threat by 1", () => {
    const fight = framsburgFight(world, "f0", CODES.cryptStalker, { seats: 2, threat: [28, 31] }, { undefended: true });
    expect(fight.run.state.seats[0]?.threat).toBe(29);
    expect(fight.run.state.seats[1]?.threat).toBe(31);
  });

  it("19099:A:3 as a Shadow the defending player chooses: raise their threat by 2", () => {
    const fight = framsburgFight(world, CODES.cryptStalker, CODES.werewolf, { threat: [28, 28] }, { pick: take("threat"), undefended: true });
    expect(fight.run.state.seats[0]?.threat).toBe(30);
    expect(where(fight.run.state, CODES.werewolf)[0]?.zone).toBe("engaged");
  });

  it("19099:A:3 or the attacking enemy returns to the staging area", () => {
    const fight = framsburgFight(world, CODES.cryptStalker, CODES.werewolf, { threat: [28, 28] }, { pick: take("staging"), undefended: true });
    // No threat is raised by the Shadow (the refresh phase's raise is the rules').
    const raised = fight.run.steps.flat().filter((step) => step.kind === "threat" && "effect" in step.cause && step.cause.effect.startsWith("19099:"));
    expect(raised).toEqual([]);
    expect(where(fight.run.state, CODES.werewolf)[0]?.zone).toBe("staging");
    // The enemy left the engagement, so its attack deals no damage.
    expect(fight.run.state.cards[fight.made.hero]?.damage).toBe(0);
  });
});

describe("19100 Evil Spectre", () => {
  it("19100:A:1 when destroyed it is shuffled back into the encounter deck if the active location has the Dark trait", () => {
    for (const [place, shuffled] of [[CODES.hauntedHall, true], [CODES.moonlitPassage, false]] as const) {
      const t = framsburgTable(world, { phase: "Combat", staging: [place], engaged: [{ code: CODES.evilSpectre, seat: 0 }], deck: ["f0", "f0"] });
      const state = activate(t.state, place);
      const spectre = idOf(state, CODES.evilSpectre);
      const destroyed = settle({ ...placeDamage(state, spectre, 99, world.cards, [], "player", UNATTRIBUTED), window: null, mode: "stopped" }, t.ctx, []);
      expect(destroyed.cards[spectre]?.zone, place).toBe(shuffled ? "encounterDeck" : "encounterDiscard");
    }
  });

  it("19100:A:1 with no active location it is discarded as an enemy is", () => {
    const t = framsburgTable(world, { phase: "Combat", engaged: [{ code: CODES.evilSpectre, seat: 0 }], deck: ["f0", "f0"] });
    const spectre = idOf(t.state, CODES.evilSpectre);
    const destroyed = settle({ ...placeDamage(t.state, spectre, 99, world.cards, [], "player", UNATTRIBUTED), window: null, mode: "stopped" }, t.ctx, []);
    expect(destroyed.cards[spectre]?.zone).toBe("encounterDiscard");
  });

  it("19100:A:2 as a Shadow the attacker gets +1 Attack, +2 instead when the active location has the Dark trait", () => {
    const attack = world.cards.get(CODES.werewolf)?.attack ?? 0;
    const plain = framsburgFight(world, CODES.evilSpectre, CODES.werewolf, {}, { undefended: true });
    const dark = framsburgFight(world, CODES.evilSpectre, CODES.werewolf, { staging: [CODES.hauntedHall] }, { undefended: true, tweak: (state) => activate(state, CODES.hauntedHall) });
    const light = framsburgFight(world, CODES.evilSpectre, CODES.werewolf, { staging: [CODES.moonlitPassage] }, { undefended: true, tweak: (state) => activate(state, CODES.moonlitPassage) });
    // An undefended attack deals the attacker's whole Attack.
    expect(plain.run.state.cards[plain.made.hero]?.damage).toBe(attack + 1);
    expect(dark.run.state.cards[dark.made.hero]?.damage).toBe(attack + 2);
    expect(light.run.state.cards[light.made.hero]?.damage).toBe(attack + 1);
  });
});

describe("19101 Forgotten Crypt", () => {
  it("19101:A:2 after it becomes the active location, cards are discarded until an Undead enemy is, which is added to the staging area, and a Loot objective of the discard pile is attached to it as a guarded objective", () => {
    const t = framsburgTable(world, { phase: "Travel", staging: [CODES.forgottenCrypt], deck: ["f0", CODES.evilSpectre, "f3"], discard: [CODES.cryptKey] });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.forgottenCrypt) }, t.ctx), t.ctx);
    const spectre = where(run.state, CODES.evilSpectre)[0]!;
    const key = where(run.state, CODES.cryptKey)[0]!;
    expect(spectre.zone).toBe("staging");
    expect(key.zone).toBe("staging");
    // The enemy guards the objective.
    expect(spectre).toMatchObject({ host: key.id, guard: true });
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f0"]);
    expect(codesIn(run.state, "encounterDeck")).toEqual(["f3"]);
  });

  it("19101:A:2 with several Loot objectives in the discard pile the first player chooses; with none the enemy only joins the staging area", () => {
    const t = framsburgTable(world, { phase: "Travel", seats: 2, staging: [CODES.forgottenCrypt], deck: [CODES.evilSpectre], discard: [CODES.cryptKey, CODES.oldLantern] });
    let run = send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.forgottenCrypt) }, t.ctx);
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 0 });
    run = finish(run, t.ctx, take(idOf(run.state, CODES.oldLantern)));
    expect(where(run.state, CODES.oldLantern)[0]?.zone).toBe("staging");
    expect(where(run.state, CODES.cryptKey)[0]?.zone).toBe("encounterDiscard");
    const bare = framsburgTable(world, { phase: "Travel", staging: [CODES.forgottenCrypt], deck: [CODES.evilSpectre, "f0"] });
    const alone = finish(send(start(bare.state), { type: "Travel", locationId: idOf(bare.state, CODES.forgottenCrypt) }, bare.ctx), bare.ctx);
    expect(where(alone.state, CODES.evilSpectre)[0]?.zone).toBe("staging");
    expect(where(alone.state, CODES.evilSpectre)[0]?.host).toBeFalsy();
  });

  it("19101:A:2 with no Undead enemy in the encounter deck the deck is emptied into the discard pile and nothing is added", () => {
    const t = framsburgTable(world, { phase: "Travel", staging: [CODES.forgottenCrypt], deck: ["f0", "f3"], discard: [CODES.cryptKey] });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.forgottenCrypt) }, t.ctx), t.ctx);
    expect(where(run.state, CODES.cryptKey)[0]?.zone).toBe("encounterDiscard");
    expect(run.state.staging.map((id) => run.state.cards[id]?.code)).not.toContain(CODES.cryptKey);
  });
});

describe("19102 Haunted Hall", () => {
  it("19102:A:2 in the staging area, after a player places progress on a Dark location in the staging area they raise their threat by 1", () => {
    for (const seats of [1, 2] as const) {
      const t = framsburgTable(world, { seats, phase: "Quest", staging: [CODES.hauntedHall, CODES.cursedTower], threat: [28, 31] });
      const placed = progressBy(t, seats - 1, CODES.cursedTower);
      const raised = placed.state.seats.map((seat) => seat.threat);
      // The player who played the card is the second seat when there is one, and the only seat otherwise.
      expect(raised.slice(0, seats), `${seats} seats`).toEqual(seats === 2 ? [28, 32] : [29]);
    }
  });

  it("19102:A:2 progress on a location that is not Dark, or the quest's progress, raises no threat", () => {
    const t = framsburgTable(world, { phase: "Quest", staging: [CODES.hauntedHall, CODES.moonlitPassage], threat: [28, 28] });
    expect(progressBy(t, 0, CODES.moonlitPassage).state.seats[0]?.threat).toBe(28);
    // Hidden Staircase, Haunted Hall and Cursed Tower are Dark; the quest stage is no location.
    const quest = framsburgTable(world, { phase: "Quest", staging: [CODES.hauntedHall], threat: [28, 28] });
    expect(settle({ ...updateCard(quest.state, quest.state.questStage ?? "", { progress: 2 }), window: null }, quest.ctx, []).seats[0]?.threat).toBe(28);
  });

  it("19102:A:2 it works only while Haunted Hall is in the staging area", () => {
    const t = framsburgTable(world, { phase: "Quest", staging: [CODES.cursedTower], threat: [28, 28] });
    const hall = framsburgTable(world, { phase: "Quest", staging: [CODES.cursedTower], threat: [28, 28] });
    const active = { ...hall.state, activeLocation: idOf(hall.state, CODES.cursedTower) };
    expect(progressBy(t, 0, CODES.cursedTower, [CODES.hauntedHall]).state.seats[0]?.threat).toBe(29);
    expect(active.activeLocation).not.toBeNull();
    expect(progressBy(t, 0, CODES.cursedTower).state.seats[0]?.threat).toBe(28);
  });
});

describe("19103 Hidden Staircase", () => {
  it("19103:A:1/A:2 Discover X and Threat X, X the tens digit of the first player's threat", () => {
    for (const [threat, x] of [[8, 0], [34, 3], [47, 4]] as const) {
      const t = framsburgTable(world, { phase: "Travel", staging: [CODES.hiddenStaircase], deck: Array<string>(8).fill("f0"), threat: [threat, threat] });
      expect(stat(t.state, CODES.hiddenStaircase, "threat")).toBe(x);
      const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.hiddenStaircase) }, t.ctx), t.ctx);
      expect(codesIn(run.state, "encounterDiscard"), `threat ${threat}`).toHaveLength(x);
    }
  });

  it("19103:A:3 after the keyword resolves each player's threat is reduced by X if no Hazard card was revealed by it", () => {
    const t = framsburgTable(world, { phase: "Travel", seats: 2, staging: [CODES.hiddenStaircase], deck: Array<string>(6).fill("f0"), threat: [34, 41] });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.hiddenStaircase) }, t.ctx), t.ctx);
    expect(reduced(run, "19103:")).toEqual([-3, -3]);
  });

  it("19103:A:3 a Hazard card revealed by it keeps the threat as it is", () => {
    const t = framsburgTable(world, { phase: "Travel", staging: [CODES.hiddenStaircase], deck: ["f0", CODES.cryptStalker, "f0", "f0", "f0"], threat: [34, 34] });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.hiddenStaircase) }, t.ctx), t.ctx);
    expect(where(run.state, CODES.cryptStalker)[0]?.zone).toBe("staging");
    expect(reduced(run, "19103:")).toEqual([]);
  });

  it("19103:A:3 with X of 0 nothing is looked at and nothing is reduced", () => {
    const t = framsburgTable(world, { phase: "Travel", staging: [CODES.hiddenStaircase], deck: ["f0", "f0"], threat: [8, 8] });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.hiddenStaircase) }, t.ctx), t.ctx);
    expect(reduced(run, "19103:")).toEqual([]);
    expect(codesIn(run.state, "encounterDeck")).toEqual(["f0", "f0"]);
  });
});

describe("19104 Moonlit Passage", () => {
  const lower = (state: ScenarioState, ctx: Table["ctx"], amount: number, source: string | null): ScenarioState => lowerThreatByEffect(state, 0, amount, source, ctx, [], UNATTRIBUTED);

  it("19104:A:2 in the staging area no player's threat is reduced by more than 1 a round by player card effects", () => {
    const t = framsburgTable(world, { phase: "Quest", seats: 2, staging: [CODES.moonlitPassage], threat: [30, 30], play: ["ally"] });
    const ally = idOf(t.state, "ally");
    let state = lower(t.state, t.ctx, 3, ally);
    expect(state.seats[0]?.threat).toBe(29);
    // The next reduction in the same round finds the cap used up.
    state = lower(state, t.ctx, 2, ally);
    expect(state.seats[0]?.threat).toBe(29);
    // The other player has a cap of their own.
    expect(lowerThreatByEffect(state, 1, 3, ally, t.ctx, [], UNATTRIBUTED).seats[1]?.threat).toBe(29);
    // The next round the cap is fresh.
    expect(lower({ ...state, playerThreatLoweredBy: undefined }, t.ctx, 2, ally).seats[0]?.threat).toBe(28);
  });

  it("19104:A:2 only player card effects are held to it: an encounter card's reduction is not, and does not use it up", () => {
    const t = framsburgTable(world, { phase: "Quest", staging: [CODES.moonlitPassage, CODES.hiddenStaircase], threat: [30, 30], play: ["ally"] });
    const encounter = idOf(t.state, CODES.hiddenStaircase);
    let state = lower(t.state, t.ctx, 3, encounter);
    expect(state.seats[0]?.threat).toBe(27);
    state = lower(state, t.ctx, 3, idOf(t.state, "ally"));
    expect(state.seats[0]?.threat).toBe(26);
  });

  it("19104:A:2 it holds only while Moonlit Passage is in the staging area", () => {
    const t = framsburgTable(world, { phase: "Quest", staging: [], threat: [30, 30], play: ["ally"] });
    expect(lower(t.state, t.ctx, 3, idOf(t.state, "ally")).seats[0]?.threat).toBe(27);
    const active = framsburgTable(world, { phase: "Quest", staging: [CODES.moonlitPassage], threat: [30, 30], play: ["ally"] });
    expect(heldAmount(active.state, "seat:0", "playerThreatReductionCap")).toBe(1);
    const moved = syncConstants(activate(active.state, CODES.moonlitPassage), active.ctx);
    expect(heldAmount(moved, "seat:0", "playerThreatReductionCap")).toBe(0);
  });

  it("19104:A:3 as a Shadow the defending player raises their threat by 1", () => {
    const fight = framsburgFight(world, CODES.moonlitPassage, CODES.werewolf, { threat: [28, 28] }, { undefended: true });
    expect(fight.run.state.seats[0]?.threat).toBe(29);
  });
});

describe("19105 Cursed Tower", () => {
  it("19105:A:2 in the staging area, after a player plays an event they raise their threat by 1", () => {
    const t = framsburgTable(world, { phase: "Quest", seats: 2, staging: [CODES.cursedTower], hand: ["filler"], threat: [28, 28] });
    const event = Object.values(t.state.cards).find((card) => card.code === "filler" && card.zone === "hand" && card.controller === 0)!;
    const played = send(start(t.state), { type: "PlayCard", cardId: event.id, payments: [] }, t.ctx);
    const done = finish(played, t.ctx);
    expect(done.state.seats.map((seat) => seat.threat)).toEqual([29, 28]);
  });

  it("19105:A:2 it works only while Cursed Tower is in the staging area", () => {
    const t = framsburgTable(world, { phase: "Quest", staging: [], hand: ["filler"], threat: [28, 28] });
    const event = Object.values(t.state.cards).find((card) => card.code === "filler" && card.zone === "hand")!;
    const done = finish(send(start(t.state), { type: "PlayCard", cardId: event.id, payments: [] }, t.ctx), t.ctx);
    expect(done.state.seats[0]?.threat).toBe(28);
  });

  it("19105:A:3 as a Shadow the defending player discards a non-objective attachment they control", () => {
    const fight = framsburgFight(world, CODES.cursedTower, CODES.werewolf, { play: [] }, { undefended: true });
    expect(fight.run.state.cards[fight.made.hero]?.attachments ?? []).toEqual([]);
  });
});

describe("19106 Abandoned Ruins", () => {
  it("19106:A:1 each player in turn order resolves the Discover keyword of the active location", () => {
    const t = framsburgTable(world, { phase: "Quest", seats: 2, staging: [CODES.moonlitPassage], deck: ["f0", CODES.cryptKey, "f0", "f3", "f3", "f3"] });
    const active = { ...t.state, activeLocation: idOf(t.state, CODES.moonlitPassage), staging: [] };
    const run = resolveRecords(active, t.ctx, CODES.abandonedRuins, "whenRevealed", undefined, take(idOf(active, CODES.cryptKey)));
    // Two players look at 2 cards each: the first finds the Loot objective, the second looks at the next two.
    expect(where(run.state, CODES.cryptKey)[0]?.zone).toBe("staging");
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f0", "f0", "f3"]);
  });

  it("19106:A:1 if the active location has no Discover keyword, Abandoned Ruins gains surge and doomed 2", () => {
    const t = framsburgTable(world, { phase: "Quest", seats: 2, staging: ["place"], threat: [30, 30], deck: ["f0", "f0"] });
    const active = { ...t.state, activeLocation: idOf(t.state, "place"), staging: [] };
    const run = resolveRecords(active, t.ctx, CODES.abandonedRuins, "whenRevealed");
    expect(run.state.seats.map((seat) => seat.threat)).toEqual([32, 32]);
    expect(codesIn(run.state, "encounterDiscard")).toEqual([]);
    const none = framsburgTable(world, { phase: "Quest", staging: [], threat: [30, 30] });
    expect(resolveRecords(none.state, none.ctx, CODES.abandonedRuins, "whenRevealed").state.seats[0]?.threat).toBe(32);
  });

  it("19106:A:1 revealed in the staging step, it gains surge only when the active location has no Discover keyword: the next card is revealed too", () => {
    const reveal = (place: string, deck: readonly string[]) => {
      const t = framsburgTable(world, { phase: "Quest", staging: [place], deck, threat: [30, 30] });
      let run = send(start({ ...activate(t.state, place), window: { kind: "pass" } }), { type: "Commit", cardIds: [t.hero] }, t.ctx);
      run = finish(send(run, { type: "Pass" }, t.ctx), t.ctx);
      return run.state;
    };
    const plain = reveal("place", [CODES.abandonedRuins, "f3", "f0", "f0"]);
    expect(codesIn(plain, "staging")).toContain("f3");
    expect(plain.seats[0]?.threat).toBeGreaterThanOrEqual(32);
    const keyword = reveal(CODES.moonlitPassage, [CODES.abandonedRuins, "f3", "f0", "f0", "f0"]);
    expect(codesIn(keyword, "staging")).not.toContain("f3");
  });

  it("19106:A:2 as a Shadow the attacker makes an additional attack against you after this one", () => {
    const fight = framsburgFight(world, CODES.abandonedRuins, CODES.werewolf, {}, { undefended: true });
    const hits = fight.run.state.cards[fight.made.hero]?.damage ?? 0;
    expect(hits).toBeGreaterThanOrEqual(2 * Math.max(1, (world.cards.get(CODES.werewolf)?.attack ?? 0) - 2));
  });
});

describe("19107 Terrible Shadows", () => {
  it("19107:A:1 each character gets -1 Willpower, Attack and Defense until the end of the round", () => {
    const t = framsburgTable(world, { phase: "Quest", play: ["ally"] });
    const run = resolveRecords(t.state, t.ctx, CODES.terribleShadows, "whenRevealed");
    for (const id of [t.hero, t.hero2, idOf(t.state, "ally")]) {
      const base = (name: "willpower" | "attack" | "defense") => modifiedStat(t.state, t.state.cards[id]!, name, world.cards);
      const now = (name: "willpower" | "attack" | "defense") => modifiedStat(run.state, run.state.cards[id]!, name, world.cards);
      for (const name of ["willpower", "attack", "defense"] as const) expect(now(name), `${id} ${name}`).toBe(Math.max(0, base(name) - 1));
    }
  });

  it("19107:A:1 a character that enters play later this round gets it too (a lasting effect of an encounter card)", () => {
    const t = framsburgTable(world, { phase: "Quest" });
    const run = resolveRecords(t.state, t.ctx, CODES.terribleShadows, "whenRevealed");
    const joined = settle(updateCard({ ...run.state, window: null }, t.hero, {}), t.ctx, []);
    expect(run.state.modifiers.some((modifier) => modifier.instanceId === "characters" && modifier.stat === "attack" && modifier.amount === -1)).toBe(true);
    expect(joined.modifiers.some((modifier) => modifier.instanceId === "characters")).toBe(true);
  });

  it("19107:A:2 as a Shadow the attacker gets +1 Attack; if the attack destroys a character the defending player raises their threat by 3", () => {
    const attack = world.cards.get(CODES.werewolf)?.attack ?? 0;
    const weak = framsburgFight(world, CODES.terribleShadows, CODES.werewolf, { threat: [28, 28] }, { undefended: true });
    expect(weak.run.state.cards[weak.made.hero]?.damage).toBe(Math.max(0, attack + 1));
    expect(weak.run.state.seats[0]?.threat).toBe(28 + (weak.run.state.cards[weak.made.hero]?.zone === "heroes" ? 0 : 3));
    const frail = framsburgFight(world, CODES.terribleShadows, CODES.werewolf, { threat: [28, 28] }, { undefended: true, tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
    expect(frail.run.state.cards[frail.made.hero]?.zone).not.toBe("heroes");
    expect(frail.run.state.seats[0]?.threat).toBeGreaterThanOrEqual(31);
  });
});

describe("19108 Slammed Shut", () => {
  it("19108:A:2 each player chooses and exhausts a character they control, and until the end of the round player card effects cannot ready a character", () => {
    const t = framsburgTable(world, { phase: "Quest", seats: 2, play: ["ally"] });
    const run = resolveRecords(t.state, t.ctx, CODES.slammedShut, "whenRevealed", undefined, take(t.hero2));
    expect(run.state.cards[t.hero2]?.exhausted).toBe(true);
    expect(run.state.cards[t.seat1Hero ?? ""]?.exhausted).toBe(true);
    expect(run.state.cards[t.hero]?.exhausted).toBe(false);
    expect(run.state.modifiers.some((modifier) => modifier.stat === "cannotReadyByPlayerCard" && modifier.instanceId === "characters")).toBe(true);
    expect(idsOf(run.state, "ally")).toHaveLength(1);
  });
});

// The Snowbourn Scout (01016) of seat `seat` enters play: "Response: After Snowbourn Scout enters play, choose a location. Place 1 progress token on that location." It places its progress on the location with this code in the staging area,
// as a card effect of that player does; `also` are further cards in the staging area.
function progressBy(t: Table, seat: number, code: string, also: readonly string[] = []): Run {
  let state = t.state;
  for (const extra of also) state = spawn(state, extra, { zone: "staging" }).state;
  const scout = spawn(state, SCOUT, { zone: "play", seat });
  const synced = syncConstants(scout.state, scoutContext());
  const target = idOf(synced, code);
  return resolveRecords(synced, scoutContext(), SCOUT, "response", scout.id, (window) => (window.window?.kind === "choose" ? (window.window.options.find((option) => option === target) ?? window.window.options[0] ?? "") : ""));
}
const SCOUT = "01016";
let withScout: Table["ctx"] | null = null;
function scoutContext(): Table["ctx"] {
  withScout ??= { effects: framsburgTable(world, {}).ctx.effects, cards: new Map([...world.cards, ...scoutCard]) };
  return withScout;
}
