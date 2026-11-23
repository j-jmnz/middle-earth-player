// Rules: rr.attachment-cards, rr.restricted, rr.modifiers, rr.response, rr.cost, rr.hit-points, rr.printed, rr.limits, rr.quest-phase, rr.cancel,
// rr.unique-cards, rr.neutral-cards, rr.spheres-of-influence (data/rules/entries.json).
// The Dread Realm attachments, each line tested from the words on the card: Sword of Númenor 10142:A:1, A:2 and A:3, Weather-stained Cloak
// 10148:A:1 and A:2, Sword-thain 10149:A:1. The lines are the text of data/cards/TDR.json (data/printed holds no entry for this pack), so every
// intent goes through sendUnledgered. The Cloak's damage comes from Rockslide (02092), revealed in the staging step.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { EFFECTS } from "../../effects/index.ts";
import { definePrinted } from "../../rules/core/printed.ts";
import { updateCard } from "../../rules/core/state.ts";
import { starterBase } from "../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { loadPrinted } from "../../../test/harness/catalog.ts";
import { lineSpec } from "../../../test/harness/line-spec.ts";
import { begin, idsOf, type Table } from "../../../test/harness/scene.ts";
import { attacking, combat, hosts, passAll, play, playerTableFor, printed, sendUnledgered, stat, triggers } from "../../../test/harness/player-table.ts";

const SWORD = "10142";
const CLOAK = "10148";
const THAIN = "10149";
// Core Aragorn (Dúnedain Ranger hero), Legolas (Silvan), Denethor (Gondor hero), Guard of the Citadel (Gondor ally), Gandalf (neutral unique ally).
const ARAGORN = "01001";
const LEGOLAS = "01005";
// Gimli (Tactics Dwarf, Attack 2) attacks beside the Sword's hero; Beravor (Lore Dúnedain Ranger hero) pays for the Cloak and wears it.
const GIMLI = "01004";
const BERAVOR = "01012";
const DENETHOR = "01010";
const GUARD = "01013";
const GANDALF = "01073";
// Guardian of Arnor (Dúnedain Ranger ally, not unique), Beechbone (unique Tactics ally), Lindir (unique Spirit ally).
const GUARDIAN = "10116";
const BEECHBONE = "10118";
const LINDIR = "10120";
// Rockslide: "When Revealed: Deal 2 damage to each character committed to this quest."
const ROCKSLIDE = "02092";
// Enemies of 5 and 4 printed hit points with 1 damage already, which an attack of 4 destroys; and one that attacks for 4.
const BIG = "big";
const SMALL = "small";
const BRUTE = "brute";

let base: Awaited<ReturnType<typeof starterBase>>;

const table = playerTableFor(() => base);

beforeAll(async () => {
  const starter = await starterBase();
  const cards = new Map([...starter.cards, ...(await loadPrinted([SWORD, CLOAK, THAIN, ARAGORN, LEGOLAS, GIMLI, BERAVOR, DENETHOR, GUARD, GANDALF, GUARDIAN, BEECHBONE, LINDIR, ROCKSLIDE]))]);
  cards.set(BIG, definePrinted({ code: BIG, name: "Big", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 5 }));
  cards.set(SMALL, definePrinted({ code: SMALL, name: "Small", type: "enemy", threat: 1, engagementCost: 40, attack: 1, defense: 0, health: 4 }));
  cards.set(BRUTE, definePrinted({ code: BRUTE, name: "Brute", type: "enemy", threat: 1, engagementCost: 40, attack: 4, defense: 9, health: 9 }));
  base = { ...starter, cards };
});

describe("Sword of Númenor (10142:A:1, A:2, A:3)", () => {
  // "Attach to a Dúnedain or Gondor hero.": Aragorn (Dúnedain) and Denethor (Gondor) are offered; Legolas, the Guardian of Arnor (a Dúnedain
  // ally) and the Guard of the Citadel (a Gondor ally) are not.
  lineSpec("10142:A:1", "Sword of Númenor: Attach to a Dúnedain or Gondor hero", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: DENETHOR, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: GUARDIAN, seat: 0 }, { code: GUARD, seat: 0 }], hand: [{ code: SWORD, seat: 0 }] });
    const sword = idsOf(tab, SWORD);
    expect(hosts(tab, sword)).toEqual([idsOf(tab, ARAGORN), idsOf(tab, DENETHOR)].sort());
    expect(play(begin(tab.state), tab, sword, idsOf(tab, DENETHOR)).state.cards[sword]?.host).toBe(idsOf(tab, DENETHOR));
  });

  // "Attached hero gets +1 Attack.": played on Aragorn, his Attack is his printed 3 + 1.
  lineSpec("10142:A:2", "Sword of Númenor: the attached hero gets +1 Attack", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], hand: [{ code: SWORD, seat: 0 }] });
    const aragorn = idsOf(tab, ARAGORN);
    const run = play(begin(tab.state), tab, idsOf(tab, SWORD), aragorn);
    expect(stat(run.state, tab, aragorn, "attack")).toBe(printed(tab, ARAGORN, "attack") + 1);
  });

  // Aragorn with the Sword (Attack 4) and Gimli, and an enemy engaged with the player that has 1 damage on it.
  function swordScene(effects: readonly Effect[], enemy: string): { tab: Table; aragorn: string; gimli: string; sword: string; foe: string } {
    const placed = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: GIMLI, seat: 0 }], attached: [{ code: SWORD, host: ARAGORN }], engaged: [{ code: enemy, seat: 0 }] }, 0);
    const foe = idsOf(placed, enemy);
    const tab = { ...placed, state: updateCard(placed.state, foe, { damage: 1 }) };
    return { tab, aragorn: idsOf(tab, ARAGORN), gimli: idsOf(tab, GIMLI), sword: idsOf(tab, SWORD), foe };
  }

  // "Response: After attached hero participates in an attack that destroys an enemy with 5 or more printed hit points, exhaust Sword of Númenor
  // to add 1 resource to attached hero's resource pool.": Aragorn and Gimli attack the 5 hit point enemy together and destroy it; the Sword
  // is exhausted and Aragorn gets 1 resource.
  lineSpec("10142:A:3", "Sword of Númenor: after the hero helps destroy a 5 hit point enemy, exhaust it for 1 resource", (effects) => {
    const { tab, aragorn, gimli, sword, foe } = swordScene(effects, BIG);
    let run = sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: foe, attackerIds: [aragorn, gimli] }, tab.ctx);
    run = passAll(run, tab.ctx);
    expect(run.state.cards[foe]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).toContain("10142:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: sword, effectId: "10142:response:1" }, tab.ctx);
    expect(run.state.cards[sword]?.exhausted).toBe(true);
    expect(run.state.cards[aragorn]?.resources).toBe(1);
  });

  // An enemy of 4 printed hit points: no Response.
  it("10142:A:3 Sword of Númenor: no Response for an enemy of 4 printed hit points", () => {
    const { tab, aragorn, foe } = swordScene(EFFECTS, SMALL);
    const run = passAll(sendUnledgered(begin(attacking(tab.state)), { type: "DeclareAttackers", enemyId: foe, attackerIds: [aragorn] }, tab.ctx), tab.ctx);
    expect(run.state.cards[foe]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("10142:response:1");
  });

  // "attached hero participates": Gimli destroys the enemy alone (Attack 2 against 2 hit points left): no Response.
  it("10142:A:3 Sword of Númenor: no Response when the attached hero did not attack", () => {
    const { tab, gimli, foe } = swordScene(EFFECTS, BIG);
    const state = updateCard(tab.state, foe, { damage: 3 });
    const run = passAll(sendUnledgered(begin(attacking(state)), { type: "DeclareAttackers", enemyId: foe, attackerIds: [gimli] }, tab.ctx), tab.ctx);
    expect(run.state.cards[foe]?.zone).not.toBe("engaged");
    expect(triggers(run.state, tab)).not.toContain("10142:response:1");
  });
});

describe("Weather-stained Cloak (10148:A:1, A:2)", () => {
  // "Attach to a Ranger character. Limit 1 per character.": Aragorn and Beravor (Ranger heroes) and the Guardian of Arnor (Ranger ally) are
  // offered, Legolas is not; once one Cloak is on Aragorn, the second goes only on Beravor or the Guardian.
  lineSpec("10148:A:1", "Weather-stained Cloak: Attach to a Ranger character, 1 per character", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }, { code: BERAVOR, seat: 0 }, { code: LEGOLAS, seat: 0 }], allies: [{ code: GUARDIAN, seat: 0 }], hand: [{ code: CLOAK, seat: 0 }, { code: CLOAK, seat: 0 }] });
    const [first = "", second = ""] = tab.ids[CLOAK] ?? [];
    const [aragorn, beravor, guardian] = [idsOf(tab, ARAGORN), idsOf(tab, BERAVOR), idsOf(tab, GUARDIAN)];
    expect(hosts(tab, first)).toEqual([aragorn, beravor, guardian].sort());
    const run = play(begin(tab.state), tab, first, aragorn);
    expect(run.state.cards[first]?.host).toBe(aragorn);
    expect(hosts(tab, second, run.state)).toEqual([beravor, guardian].sort());
  });

  // "While attached character is commited to the quest, Weather-stained Cloak gains: "Response: Exhaust Weather-stained Cloak to cancel 1 point
  // of damage just dealt to attached character."": Beravor quests with the Cloak, Rockslide deals her 2 damage, the Cloak is exhausted and 1 of
  // the 2 is cancelled.
  lineSpec("10148:A:2", "Weather-stained Cloak: while questing, exhaust it to cancel 1 damage just dealt to the character", (effects) => {
    const tab = table(effects, { start: "quest", heroes: [{ code: BERAVOR, seat: 0 }, { code: LEGOLAS, seat: 0 }], attached: [{ code: CLOAK, host: BERAVOR }], deck: [ROCKSLIDE, ROCKSLIDE] });
    const [beravor, cloak] = [idsOf(tab, BERAVOR), idsOf(tab, CLOAK)];
    let run = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [beravor] }, tab.ctx);
    // The commit ends, and the staging step reveals Rockslide.
    run = passAll(sendUnledgered(run, { type: "Pass" }, tab.ctx), tab.ctx);
    expect(triggers(run.state, tab)).toContain("10148:response:1");
    run = sendUnledgered(run, { type: "Trigger", cardId: cloak, effectId: "10148:response:1" }, tab.ctx);
    run = passAll(run, tab.ctx, { responses: true });
    expect(run.state.cards[cloak]?.exhausted).toBe(true);
    expect(run.state.cards[beravor]?.damage).toBe(2 - 1);
  });

  // Not committed: Aragorn defends the Brute's attack (4 against Defense 2) and takes 2 damage, and the Cloak offers no Response.
  it("10148:A:2 Weather-stained Cloak: no Response for damage while the character is not committed", () => {
    const tab = table(EFFECTS, { heroes: [{ code: ARAGORN, seat: 0 }], attached: [{ code: CLOAK, host: ARAGORN }], engaged: [{ code: BRUTE, seat: 0 }] });
    const aragorn = idsOf(tab, ARAGORN);
    let run = passAll(combat(tab.state, tab), tab.ctx);
    expect(run.state.window?.kind).toBe("defense");
    run = passAll(sendUnledgered(run, { type: "DeclareDefender", defenderId: aragorn }, tab.ctx), tab.ctx);
    expect(run.state.cards[aragorn]?.damage).toBe(2);
    expect(triggers(run.state, tab)).not.toContain("10148:response:1");
  });
});

describe("Sword-thain (10149:A:1)", () => {
  // "Attach to a unique ally belonging to any sphere of influence.": Beechbone (Tactics) and Lindir (Spirit) are offered; the Guardian of Arnor
  // (not unique), Gandalf (unique but neutral, no sphere of influence) and the hero Aragorn are not.
  lineSpec("10149:A:1", "Sword-thain: Attach to a unique ally of a sphere of influence", (effects) => {
    const tab = table(effects, { heroes: [{ code: ARAGORN, seat: 0 }], allies: [{ code: BEECHBONE, seat: 0 }, { code: LINDIR, seat: 0 }, { code: GUARDIAN, seat: 0 }, { code: GANDALF, seat: 0 }], hand: [{ code: THAIN, seat: 0 }] });
    const thain = idsOf(tab, THAIN);
    expect(hosts(tab, thain)).toEqual([idsOf(tab, BEECHBONE), idsOf(tab, LINDIR)].sort());
    expect(play(begin(tab.state), tab, thain, idsOf(tab, LINDIR)).state.cards[thain]?.host).toBe(idsOf(tab, LINDIR));
  });
});
