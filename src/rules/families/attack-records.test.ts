import { describe, expect, it } from "vitest";

import { RECORDS } from "../../effects/authored/families/attack.ts";
import { cardMap, expectOk, fixtureDefinition } from "../fixture.ts";
import { modifiedStat } from "../keywords.ts";
import { definePrinted, type PrintedCard } from "../printed.ts";
import { legalIntents, reduce } from "../reduce.ts";
import type { ScenarioState } from "../state.ts";
import { blankScenario, updateCard, withThreat } from "../state.ts";
import { spawn, type Destination } from "../zones.ts";
import { fighter, foe } from "./attack-fixture.ts";

// Rules: rr.attacks-outside-the-combat-phase, rr.step-6-8-4, rr.lasting-effects, rr.ranged, faq.limitations-on-attacks
// (data/rules/entries.json). The attack family's records on the cards they were written for, with plain numbers.

const event = (code: string, sphere: PrintedCard["sphere"] = "tactics") => definePrinted({ code, name: code, type: "event", sphere, cost: 0 });
const gear = (code: string, traits: string[] = []) => definePrinted({ code, name: code, type: "attachment", sphere: "tactics", cost: 0, traits });
const CARDS = cardMap([
  fighter("hero", { traits: ["Rohan"] }),
  fighter("lore", { sphere: "lore", traits: ["Dúnedain"] }),
  fighter("archer", { keywords: { ranged: true }, traits: ["Noldor"] }),
  fighter("aragorn", { name: "Aragorn", traits: ["Dúnedain"] }),
  definePrinted({ code: "rider", name: "rider", type: "ally", sphere: "tactics", cost: 2, attack: 1, defense: 1, health: 2, traits: ["Rohan"] }),
  definePrinted({ code: "21006", name: "Derufin", type: "ally", sphere: "tactics", cost: 2, attack: 2, defense: 1, health: 2, keywords: { ranged: true } }),
  definePrinted({ code: "11003", name: "Mithlond Sea-watcher", type: "ally", sphere: "spirit", cost: 2, attack: 1, defense: 1, health: 2 }),
  foe("orc", { traits: ["Orc"], threat: 3 }),
  foe("troll", { traits: ["Troll"], health: 4, defense: 0, threat: 2 }),
  foe("goblin", { traits: ["Orc"], health: 2, defense: 0, threat: 2 }),
  event("04131"),
  event("22007"),
  event("12114", "lore"),
  event("01033"),
  event("12086", "spirit"),
  event("19090"),
  gear("146011"),
  gear("145013"),
  gear("04057"),
  gear("weapon", ["Weapon"]),
]);
const ctx = { effects: RECORDS, cards: CARDS };

function table(rows: readonly { code: string; at: Destination; as?: string }[], seatCount: 1 | 2 = 1): { state: ScenarioState; ids: Record<string, string> } {
  let state = blankScenario({ seatCount, seed: 2, definition: fixtureDefinition(["stage"]) });
  const ids: Record<string, string> = {};
  for (const row of rows) {
    const spawned = spawn(state, row.code, row.at);
    state = spawned.state;
    ids[row.as ?? row.code] = spawned.id;
  }
  state = withThreat(state, 0, 20);
  if (seatCount === 2) state = withThreat(state, 1, 20);
  return { state: { ...state, phase: "Combat", boundaryPhase: "Combat", mode: "combatActions", window: { kind: "pass" }, activeSeat: 0, passed: [] }, ids };
}

function attach(state: ScenarioState, id: string, hostId: string): ScenarioState {
  const moved = updateCard(state, id, { zone: "attached", host: hostId });
  return updateCard(moved, hostId, { attachments: [...(moved.cards[hostId]?.attachments ?? []), id] });
}

const attackStep = (state: ScenarioState): ScenarioState => ({ ...state, mode: "playerAttacks", window: { kind: "playerAttack" }, passed: [] });

describe("attack family records", () => {
  it("Hands Upon the Bow: the exhausted ranged character attacks an enemy in the staging area with +1 Attack (04131:A:1)", () => {
    const { state, ids } = table([{ code: "archer", at: { zone: "heroes", seat: 0 } }, { code: "troll", at: { zone: "staging" } }, { code: "04131", at: { zone: "hand", seat: 0 } }]);
    const played = expectOk(reduce(state, { type: "PlayCard", cardId: ids["04131"]!, payments: [] }, ctx)).state;
    expect(played.cards[ids.troll!]?.damage).toBe(3);
    expect(played.cards[ids["04131"]!]?.zone).toBe("discard");
    expect(played.modifiers).toEqual([]);
  });

  it("Charge into Battle: an attack against each non-unique enemy in the staging area (22007:A:2)", () => {
    const { state, ids } = table([{ code: "hero", at: { zone: "heroes", seat: 0 } }, { code: "troll", at: { zone: "staging" } }, { code: "goblin", at: { zone: "staging" } }, { code: "22007", at: { zone: "hand", seat: 0 } }]);
    const quest = { ...state, phase: "Quest" as const, boundaryPhase: "Quest" as const, mode: "resolution" as const };
    const opened = expectOk(reduce(quest, { type: "PlayCard", cardId: ids["22007"]!, payments: [] }, ctx)).state;
    const first = expectOk(reduce(opened, { type: "DeclareAttackers", enemyId: ids.goblin!, attackerIds: [ids.hero!] }, ctx)).state;
    expect(first.cards[ids.goblin!]?.zone).toBe("encounterDiscard");
    // The hero is exhausted: the troll is still offered, but nobody can attack it.
    expect(legalIntents(first, ctx)).toEqual([{ type: "DeclineAttack" }]);
  });

  it("Gúthwinë: +2 Attack for this attack, and a Rohan ally back to the hand when it destroys the enemy (146011:A:2)", () => {
    const { state: start, ids } = table([{ code: "hero", at: { zone: "heroes", seat: 0 } }, { code: "146011", at: { zone: "play", seat: 0 } }, { code: "troll", at: { zone: "engaged", seat: 0 } }, { code: "rider", at: { zone: "discard", seat: 0 } }]);
    const state = attackStep(attach(start, ids["146011"]!, ids.hero!));
    const declared = expectOk(reduce(state, { type: "DeclareAttackers", enemyId: ids.troll!, attackerIds: [ids.hero!] }, ctx)).state;
    const used = expectOk(reduce(declared, { type: "Trigger", cardId: ids["146011"]!, effectId: "146011:response:1" }, ctx)).state;
    expect(used.cards[ids.troll!]?.zone).toBe("encounterDiscard");
    expect(used.cards[ids.rider!]?.zone).toBe("hand");
    expect(modifiedStat(used, used.cards[ids.hero!]!, "attack", CARDS)).toBe(2);
  });

  it("Swift and Strong: a Weapon exhausts, the character readies with +2 Attack for its next attack this phase (19090:A:1)", () => {
    const { state: start, ids } = table([{ code: "hero", at: { zone: "heroes", seat: 0 } }, { code: "weapon", at: { zone: "play", seat: 0 } }, { code: "goblin", at: { zone: "engaged", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }, { code: "19090", at: { zone: "hand", seat: 0 } }]);
    const state = attackStep(attach(start, ids.weapon!, ids.hero!));
    const destroyed = expectOk(reduce(state, { type: "DeclareAttackers", enemyId: ids.goblin!, attackerIds: [ids.hero!] }, ctx)).state;
    const used = expectOk(reduce(destroyed, { type: "Trigger", cardId: ids["19090"]!, effectId: "19090:response:1", payments: [] }, ctx)).state;
    expect(used.cards[ids.weapon!]?.exhausted).toBe(true);
    expect(used.cards[ids.hero!]?.exhausted).toBe(false);
    const again = expectOk(reduce(used, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.hero!] }, ctx)).state;
    // 2 + 2 Attack against 1 Defense.
    expect(again.cards[ids.orc!]?.damage).toBe(3);
  });

  it("Knife-work: -1 Defense to each enemy engaged with the chosen player, and a draw for each enemy they destroy after paying 2 Lore (12114:A:1)", () => {
    const { state: start, ids } = table([{ code: "lore", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }, { code: "goblin", at: { zone: "engaged", seat: 0 } }, { code: "12114", at: { zone: "hand", seat: 0 } }, { code: "rider", at: { zone: "deck", seat: 0 } }]);
    const state = updateCard(start, ids.lore!, { resources: 2 });
    const played = expectOk(reduce(state, { type: "PlayCard", cardId: ids["12114"]!, payments: [] }, ctx)).state;
    expect(modifiedStat(played, played.cards[ids.orc!]!, "defense", CARDS)).toBe(0);
    const paid = expectOk(reduce(played, { type: "Choose", optionId: "draw" }, ctx)).state;
    expect(paid.cards[ids.lore!]?.resources).toBe(0);
    const attacked = expectOk(reduce(attackStep(paid), { type: "DeclareAttackers", enemyId: ids.goblin!, attackerIds: [ids.lore!] }, ctx)).state;
    expect(attacked.cards[ids.rider!]?.zone).toBe("hand");
  });

  it("Rain of Arrows: a ranged character exhausts to deal 1 damage to each enemy engaged with the chosen player (01033:A:1)", () => {
    const { state, ids } = table([{ code: "archer", at: { zone: "heroes", seat: 0 } }, { code: "hero", at: { zone: "heroes", seat: 1 } }, { code: "orc", at: { zone: "engaged", seat: 1 } }, { code: "troll", at: { zone: "engaged", seat: 1 } }, { code: "goblin", at: { zone: "engaged", seat: 0 } }, { code: "01033", at: { zone: "hand", seat: 0 } }], 2);
    const played = expectOk(reduce(state, { type: "PlayCard", cardId: ids["01033"]!, payments: [] }, ctx)).state;
    const chosen = expectOk(reduce(played, { type: "Choose", optionId: "seat:1" }, ctx)).state;
    expect(chosen.cards[ids.archer!]?.exhausted).toBe(true);
    expect([chosen.cards[ids.orc!]?.damage, chosen.cards[ids.troll!]?.damage, chosen.cards[ids.goblin!]?.damage]).toEqual([1, 1, 0]);
  });

  it("Banner of Elendil and Rivendell Bow: +1 Attack to the other attackers while Aragorn attacks, +1 in a ranged attack (145013:A:3, 04057:A:3)", () => {
    const { state: start, ids } = table([{ code: "aragorn", at: { zone: "heroes", seat: 0 } }, { code: "hero", at: { zone: "heroes", seat: 0 } }, { code: "archer", at: { zone: "heroes", seat: 1 } }, { code: "145013", at: { zone: "play", seat: 0 } }, { code: "04057", at: { zone: "play", seat: 1 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }], 2);
    const state = attackStep(attach(attach(start, ids["145013"]!, ids.aragorn!), ids["04057"]!, ids.archer!));
    const attacked = expectOk(reduce(state, { type: "DeclareAttackers", enemyId: ids.orc!, attackerIds: [ids.aragorn!, ids.hero!, ids.archer!] }, ctx)).state;
    // Aragorn 2, the hero 2 + 1 (Banner), the other player's archer 2 + 1 (ranged attack); the archer is seat 1's, so no Banner.
    expect(attacked.cards[ids.orc!]?.damage).toBe(7);
  });

  it("Derufin: discarded, he lowers the engaged player's threat by the destroyed enemy's printed Threat (21006:A:3)", () => {
    const { state, ids } = table([{ code: "hero", at: { zone: "heroes", seat: 0 } }, { code: "aragorn", at: { zone: "heroes", seat: 1 } }, { code: "21006", at: { zone: "play", seat: 1 } }, { code: "goblin", at: { zone: "engaged", seat: 0 } }], 2);
    const attacked = expectOk(reduce(attackStep(state), { type: "DeclareAttackers", enemyId: ids.goblin!, attackerIds: [ids.hero!, ids["21006"]!] }, ctx)).state;
    const used = expectOk(reduce(attacked, { type: "Trigger", cardId: ids["21006"]!, effectId: "21006:response:1" }, ctx)).state;
    expect(used.cards[ids["21006"]!]?.zone).toBe("discard");
    expect(used.seats[0]?.threat).toBe(18);
  });

  it("Battle-fury: the hero attacks, then the group may pay 1 Spirit to commit it to the quest (12086:A:2)", () => {
    const { state: start, ids } = table([{ code: "hero", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }, { code: "12086", at: { zone: "hand", seat: 0 } }]);
    const spirit = fighter("spirit", { sphere: "spirit" });
    const cards = cardMap([...CARDS.values(), spirit]);
    const helper = spawn(start, "spirit", { zone: "heroes", seat: 0 });
    const state = { ...updateCard(helper.state, helper.id, { resources: 1, exhausted: true }), phase: "Quest" as const, boundaryPhase: "Quest" as const, mode: "questCommit" as const };
    const opened = expectOk(reduce(state, { type: "PlayCard", cardId: ids["12086"]!, payments: [] }, { effects: RECORDS, cards })).state;
    // The quest commit window offers committing in the attack's action windows (6.8.1, 6.8.3): each closes with a pass.
    expect(opened.window?.kind).toBe("frameAction");
    let played = opened;
    while (played.window?.kind === "frameAction") played = expectOk(reduce(played, { type: "Pass" }, { effects: RECORDS, cards })).state;
    expect(played.cards[ids.orc!]?.damage).toBe(1);
    const committed = expectOk(reduce(played, { type: "Choose", optionId: "commit" }, { effects: RECORDS, cards })).state;
    expect(committed.cards[ids.hero!]?.committed).toBe(true);
    expect(committed.cards[helper.id]?.resources).toBe(0);
  });

  it("Mithlond Sea-watcher: +2 Attack and ranged while the top card of its player's discard pile is an ally (11003:A:1)", () => {
    const { state, ids } = table([{ code: "11003", at: { zone: "play", seat: 0 } }, { code: "12086", at: { zone: "discard", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }]);
    const quiet = expectOk(reduce(state, { type: "Pass" }, ctx)).state;
    expect(modifiedStat(quiet, quiet.cards[ids["11003"]!]!, "attack", CARDS)).toBe(1);
    const ally = spawn(state, "rider", { zone: "discard", seat: 0 });
    const topped = expectOk(reduce(ally.state, { type: "Pass" }, ctx)).state;
    expect(modifiedStat(topped, topped.cards[ids["11003"]!]!, "attack", CARDS)).toBe(3);
  });
});
