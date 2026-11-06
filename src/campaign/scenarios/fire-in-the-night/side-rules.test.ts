// Rules: emce.side-quests, rr.damage, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 19068:A:1, 19074:A:2, 19080:A:2.
// Dagnir's cap (only his cap spares a quest card's damage), Rally the Woodmen's bar on allies and Powerful in Wrath's surge, each in a real state of the scenario.
import { beforeAll, describe, expect, it } from "vitest";

import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { canAttack } from "../../../rules/combat/combat.ts";
import { CODES, codesIn, finish, idOf, loadNightWorld, nightTable, send, start, type NightWorld } from "../../../../test/scenarios/fire-in-the-night/scene.ts";

let world: NightWorld;
beforeAll(async () => {
  world = await loadNightWorld();
}, 120_000);

const hill = (state: ScenarioState) => state.cards[state.questStage ?? ""]!;
const stat = (state: ScenarioState, code: string, name: "threat"): number => modifiedStat(state, state.cards[idOf(state, code)]!, name, world.cards);
const victory = (n: number): string[] => [CODES.drawHerFire, CODES.fortifyTheDefense, CODES.rallyTheWoodmen, CODES.douseTheFlames, CODES.holdTheDoor, CODES.defendTheTown, CODES.routTheGoblins, CODES.faceTheDragon].slice(0, n);

describe("Dagnir's cap, Rally the Woodmen and Powerful in Wrath", () => {
  it("only Dagnir's cap spares quest damage: another card's per-round cap holds quest damage to it", () => {
    const t = nightTable(world, { staging: [CODES.goblinTroop] });
    const id = idOf(t.state, CODES.goblinTroop);
    const capped = { ...t.state, modifiers: [...t.state.modifiers, { instanceId: id, sourceId: id, stat: "damageCap" as const, amount: 2, until: "whileSourceInPlay" as const }] };
    expect(placeDamage(capped, id, 5, world.cards, [], "quest", UNATTRIBUTED).cards[id]?.damage).toBe(2);
    expect(flagged(capped, id, "damageCapSparesQuest")).toBe(false);
  });

  it("19068:A:1 an objective ally a player controls is an ally too; an ally among the heroes is a hero", () => {
    const t = nightTable(world, { phase: "PlayerAttacks", staging: [CODES.dagnir, CODES.rallyTheWoodmen], victory: victory(3), play: ["ally"] });
    const dagnir = idOf(t.state, CODES.dagnir);
    const ally = idOf(t.state, "ally");
    const cards = new Map(world.cards).set("objally", definePrinted({ code: "objally", name: "Objective Ally", type: "objective", health: 2, attack: 1 }));
    const objective = updateCard(t.state, ally, { code: "objally" });
    expect(canAttack(objective, 0, ally, dagnir, cards)).toBe(false);
    const hero = updateCard(t.state, ally, { zone: "heroes" });
    expect(canAttack(hero, 0, ally, dagnir, world.cards)).toBe(true);
  });

  it("19080:A:2 Burning Watchtower (its Threat is its own constant) is discarded and its Threat dealt: no surge", () => {
    const t = nightTable(world, { staging: [CODES.dagnir], active: CODES.burningWatchtower, deck: [CODES.powerfulInWrath, "f3", "f0"] });
    const threat = stat(t.state, CODES.burningWatchtower, "threat");
    expect(threat).toBeGreaterThan(0);
    let run = send(start(t.state), { type: "Commit", cardIds: [t.hero2] }, t.ctx);
    run = finish(send(run, { type: "Pass" }, t.ctx), t.ctx);
    expect(hill(run.state).damage).toBe(threat);
    expect(run.state.cards[idOf(run.state, CODES.burningWatchtower)]?.zone).toBe("encounterDiscard");
    expect(codesIn(run.state, "staging")).not.toContain("f3");
  });
});
