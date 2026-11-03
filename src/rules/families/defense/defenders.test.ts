import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/defense.ts";

import { modifiedStat } from "../../keywords.ts";
import { definePrinted } from "../../printed.ts";
import { legalIntents } from "../../reduce.ts";
import type { ScenarioState } from "../../state.ts";
import { ally, enemy, hero, offered, recordsOf, send, table, treachery, until, type TableSpec } from "./table.ts";

// Rules: rr.multiple-defenders, rr.step-6-4-1, rr.step-6-4-3, rr.step-6-4-4, rr.defending-player, rr.cancel
// (data/rules/entries.json). Several defenders, defenders declared by an effect, and what the end of an attack says about them.

const shade = treachery("shade");
const event = (code: string, sphere: "leadership" | "tactics" | "spirit" | "lore" = "tactics") => definePrinted({ code, name: code, type: "event", sphere, cost: 0 });

// A second player whose attack comes next, so a test reads the table before the round moves on.
function stopped(spec: TableSpec): TableSpec {
  return { ...spec, seatCount: 2, cards: [...spec.cards, hero("stopper"), enemy("brute", { attack: 1 })], heroes: [...spec.heroes, { code: "stopper", seat: 1 }], enemies: [...(spec.enemies ?? []), { code: "brute", seat: 1 }], encounter: [...(spec.encounter ?? []), "shade"] };
}

function toCombat(spec: TableSpec, stop: Parameters<typeof until>[2]) {
  const built = table(spec);
  return { ...built, state: until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, stop) };
}

const defenseWindow = (state: ScenarioState) => state.window?.kind === "defense";

describe("several defenders against one attack", () => {
  it("lets Stand Together's player declare more defenders, pools their Defense and assigns all the damage to one of them", () => {
    const { state, ids, ctx } = toCombat(
      stopped({ cards: [hero("a", { defense: 1 }), hero("b", { defense: 1 }), ally("c", { defense: 0, health: 4 }), enemy("troll", { attack: 5 }), event("01038"), shade], effects: recordsOf(RECORDS, "01038"), heroes: [{ code: "a" }, { code: "b" }], allies: [{ code: "c" }], hand: [{ code: "01038" }], enemies: [{ code: "troll" }], encounter: ["shade"] }),
      (current, legal) => current.phase === "Combat" && legal.some((intent) => intent.type === "PlayCard"),
    );
    const flagged = send(send(state, { type: "PlayCard", cardId: ids["01038"]!, payments: [] }, ctx), { type: "Choose", optionId: "seat:0" }, ctx);
    const defense = until(flagged, ctx, defenseWindow);
    // The first defender through the defense window, the others in the frame that follows.
    const more = send(defense, { type: "DeclareDefender", defenderId: ids.a! }, ctx);
    expect(more.window).toEqual({ kind: "choose", seat: 0, options: ["another", "done"] });
    const pickB = send(send(more, { type: "Choose", optionId: "another" }, ctx), { type: "Choose", optionId: ids.b! }, ctx);
    // The last eligible character is taken without asking.
    const pickC = send(pickB, { type: "Choose", optionId: "another" }, ctx);
    expect(pickC.pendingAttack?.defenderId).toBe(ids.a);
    expect(pickC.pendingAttack?.defense?.extra).toEqual([ids.b, ids.c]);
    expect([ids.a, ids.b, ids.c].every((id) => pickC.cards[id!]?.exhausted)).toBe(true);
    // 5 Attack against 1 + 1 + 0 Defense: 3 damage, all on the defender the player names.
    expect(pickC.window?.kind).toBe("choose");
    const hit = send(pickC, { type: "Choose", optionId: ids.b! }, ctx);
    expect(hit.cards[ids.b!]?.damage).toBe(3);
    expect(hit.cards[ids.a!]?.damage).toBe(0);
    expect(hit.cards[ids.c!]?.damage).toBe(0);
  });

  it("declares an exhausted character as the defender with Anchor Watch, once more for each copy in the discard pile, and skips the defense step", () => {
    const built = table(stopped({ cards: [hero("a", { sphere: "leadership", defense: 2 }), hero("b", { defense: 1 }), enemy("troll", { attack: 4 }), definePrinted({ code: "11007", name: "Anchor Watch", type: "event", sphere: "leadership", cost: 0 }), shade], effects: recordsOf(RECORDS, "11007"), heroes: [{ code: "a" }, { code: "b" }], hand: [{ code: "11007" }], discard: [{ code: "11007", key: "spent" }], enemies: [{ code: "troll" }], encounter: ["shade"] }));
    const { ids, ctx } = built;
    const tired = { ...built.state, cards: { ...built.state.cards, [ids.a!]: { ...built.state.cards[ids.a!]!, exhausted: true }, [ids.b!]: { ...built.state.cards[ids.b!]!, exhausted: true } } };
    const at = until(send(tired, { type: "DeclineEngage" }, ctx), ctx, (_state, legal) => offered(legal, "11007:response:1"));
    const first = send(at, { type: "Trigger", cardId: ids["11007"]!, effectId: "11007:response:1", payments: [] }, ctx);
    const second = send(first, { type: "Choose", optionId: ids.a! }, ctx);
    // 4 Attack against 2 + 1 Defense: 1 damage, assigned by the defending player; no defense window was opened.
    expect(second.pendingAttack?.defenderId).toBe(ids.a);
    expect(second.pendingAttack?.defense?.extra).toEqual([ids.b]);
    const hit = send(second, { type: "Choose", optionId: ids.a! }, ctx);
    expect(hit.cards[ids.a!]?.damage).toBe(1);
    expect(hit.cards[ids.b!]?.damage).toBe(0);
  });

  it("lets Hold the Line declare up to 3 defenders and pay 2 Tactics resources to ready the ones that took no damage", () => {
    const built = table(stopped({ cards: [hero("a", { sphere: "leadership", defense: 3 }), hero("b", { defense: 2 }), enemy("troll", { attack: 4 }), definePrinted({ code: "12140", name: "Hold the Line", type: "event", sphere: "leadership", cost: 0 }), shade], effects: recordsOf(RECORDS, "12140"), heroes: [{ code: "a" }, { code: "b" }], hand: [{ code: "12140" }], enemies: [{ code: "troll" }], encounter: ["shade"] }));
    const { ids, ctx } = built;
    const at = until(send(built.state, { type: "DeclineEngage" }, ctx), ctx, (_state, legal) => offered(legal, "12140:response:1"));
    let next = send(at, { type: "Trigger", cardId: ids["12140"]!, effectId: "12140:response:1", payments: [] }, ctx);
    next = send(send(next, { type: "Choose", optionId: "another" }, ctx), { type: "Choose", optionId: ids.a! }, ctx);
    // With one eligible character left, choosing "another" takes it without asking.
    next = send(next, { type: "Choose", optionId: "another" }, ctx);
    expect(next.pendingAttack?.defense?.extra).toEqual([ids.b]);
    // 4 Attack against 3 + 2 Defense: no damage. The players pay 2 Tactics resources to ready both defenders.
    expect(next.window?.kind).toBe("choose");
    const assigned = send(next, { type: "Choose", optionId: ids.a! }, ctx);
    expect(assigned.window).toEqual({ kind: "choose", seat: 0, options: ["ready", "decline"] });
    // Any player's Tactics hero may pay ("the players as a group"): the second player's hero is offered too.
    let paid = send(assigned, { type: "Choose", optionId: "ready" }, ctx);
    expect(paid.window).toEqual({ kind: "choose", seat: 0, options: [ids.b, ids.stopper] });
    paid = send(send(paid, { type: "Choose", optionId: ids.b! }, ctx), { type: "Choose", optionId: ids.b! }, ctx);
    expect(paid.cards[ids.a!]?.exhausted).toBe(false);
    expect(paid.cards[ids.b!]?.exhausted).toBe(false);
    expect(paid.cards[ids.a!]?.resources).toBe(3);
    expect(paid.cards[ids.b!]?.resources).toBe(1);
  });
});

describe("after a character is declared as a defender", () => {
  it("answers Terrible to Behold before the shadow card, returning the enemy to the staging area and canceling the attack", () => {
    const { state, ids, ctx } = toCombat(
      stopped({ cards: [hero("noble", { traits: ["Noble"], sphere: "leadership", defense: 0 }), enemy("troll", { attack: 6 }), event("12111", "leadership"), shade], effects: recordsOf(RECORDS, "12111"), heroes: [{ code: "noble" }], hand: [{ code: "12111" }], enemies: [{ code: "troll" }], encounter: ["shade"] }),
      defenseWindow,
    );
    const declared = send(state, { type: "DeclareDefender", defenderId: ids.noble! }, ctx);
    expect(offered(legalIntents(declared, ctx), "12111:response:1")).toBe(true);
    const turned = send(declared, { type: "Trigger", cardId: ids["12111"]!, effectId: "12111:response:1", payments: [] }, ctx);
    expect(turned.cards[ids.troll!]?.zone).toBe("staging");
    expect(turned.cards[ids.noble!]?.damage).toBe(0);
  });

  it("gives a sentinel defender +2 Defense with Desperate Defense and readies it when the attack deals no damage", () => {
    const { state, ids, ctx } = toCombat(
      stopped({ cards: [hero("guard", { sphere: "spirit", keywords: { sentinel: true }, defense: 1 }), enemy("orc", { attack: 3 }), event("145009", "spirit"), shade], effects: recordsOf(RECORDS, "145009"), heroes: [{ code: "guard" }], hand: [{ code: "145009" }], enemies: [{ code: "orc" }], encounter: ["shade"] }),
      defenseWindow,
    );
    const declared = send(state, { type: "DeclareDefender", defenderId: ids.guard! }, ctx);
    const done = send(declared, { type: "Trigger", cardId: ids["145009"]!, effectId: "145009:response:1", payments: [] }, ctx);
    expect(done.cards[ids.guard!]?.damage).toBe(0);
    expect(done.cards[ids.guard!]?.exhausted).toBe(false);
  });

  it("resolves the attack against another enemy with Small Target when the shadow card has no shadow effect", () => {
    const { state, ids, ctx } = toCombat(
      stopped({ cards: [hero("pippin", { sphere: "spirit", traits: ["Hobbit"], defense: 0 }), enemy("orc", { attack: 4, engagementCost: 40 }), enemy("goblin", { attack: 1, defense: 1, health: 5, engagementCost: 10 }), event("06062", "spirit"), shade], effects: recordsOf(RECORDS, "06062"), heroes: [{ code: "pippin" }], hand: [{ code: "06062" }], enemies: [{ code: "orc" }, { code: "goblin" }], encounter: ["shade", "shade"] }),
      (current) => current.window?.kind === "chooseEnemy",
    );
    const chosen = until(send(state, { type: "ChooseEnemy", enemyId: ids.orc! }, ctx), ctx, defenseWindow);
    const declared = send(chosen, { type: "DeclareDefender", defenderId: ids.pippin! }, ctx);
    const turned = send(declared, { type: "Trigger", cardId: ids["06062"]!, effectId: "06062:response:1", payments: [] }, ctx);
    // 4 Attack against the goblin's 1 Defense.
    expect(turned.cards[ids.goblin!]?.damage).toBe(3);
    expect(turned.cards[ids.pippin!]?.damage).toBe(0);
  });

  it("gives the enemy -2 Attack and -2 Defense with Beorn's Rage", () => {
    const { state, ids, ctx } = toCombat(
      stopped({ cards: [hero("beorn", { traits: ["Beorning"], defense: 2, health: 9 }), enemy("orc", { attack: 4, defense: 3 }), event("19005"), shade], effects: recordsOf(RECORDS, "19005"), heroes: [{ code: "beorn" }], hand: [{ code: "19005" }], enemies: [{ code: "orc" }], encounter: ["shade"] }),
      defenseWindow,
    );
    const raged = send(send(state, { type: "DeclareDefender", defenderId: ids.beorn! }, ctx), { type: "Trigger", cardId: ids["19005"]!, effectId: "19005:response:2", payments: [] }, ctx);
    expect(modifiedStat(raged, raged.cards[ids.orc!]!, "defense", ctx.cards)).toBe(1);
    expect(raged.cards[ids.beorn!]?.damage).toBe(0);
  });
});

describe("after a character defends, the attacking enemy still named", () => {
  it("lowers the defending player's threat when Beregond takes no damage, and returns the enemy with Fastred", () => {
    const { state, ids, ctx } = toCombat(
      stopped({ cards: [hero("145003", { sphere: "spirit", defense: 3, keywords: { sentinel: true } }), hero("17081", { sphere: "spirit", defense: 1 }), enemy("orc", { attack: 2, engagementCost: 40 }), enemy("goblin", { attack: 1, engagementCost: 10 }), shade], effects: recordsOf(RECORDS, "145003", "17081"), heroes: [{ code: "145003" }, { code: "17081" }], enemies: [{ code: "orc" }, { code: "goblin" }], encounter: ["shade", "shade"] }),
      (current) => current.window?.kind === "chooseEnemy",
    );
    const orcAttack = until(send(state, { type: "ChooseEnemy", enemyId: ids.orc! }, ctx), ctx, defenseWindow);
    const unharmed = send(orcAttack, { type: "DeclareDefender", defenderId: ids["145003"]! }, ctx);
    expect(offered(legalIntents(unharmed, ctx), "145003:response:1")).toBe(true);
    const lowered = send(unharmed, { type: "Trigger", cardId: ids["145003"]!, effectId: "145003:response:1" }, ctx);
    expect(lowered.seats[0].threat).toBe(19);
    const goblinAttack = until(lowered, ctx, defenseWindow);
    const defended = send(goblinAttack, { type: "DeclareDefender", defenderId: ids["17081"]! }, ctx);
    const returned = send(defended, { type: "Trigger", cardId: ids["17081"]!, effectId: "17081:response:1" }, ctx);
    expect(returned.cards[ids.goblin!]?.zone).toBe("staging");
    expect(returned.seats[0].threat).toBe(17);
  });

  it("lets Grimbeorn strike back at the enemy with -2 Defense, and deals Last Stand's damage when a Warrior defender is destroyed", () => {
    const { state, ids, ctx } = toCombat(
      stopped({ cards: [hero("19001", { traits: ["Beorning", "Warrior"], attack: 3, defense: 2, health: 9 }), enemy("orc", { attack: 2, defense: 2, health: 9 }), shade], effects: recordsOf(RECORDS, "19001"), heroes: [{ code: "19001" }], enemies: [{ code: "orc" }], encounter: ["shade"] }),
      defenseWindow,
    );
    const defended = send(state, { type: "DeclareDefender", defenderId: ids["19001"]! }, ctx);
    const struck = send(defended, { type: "Trigger", cardId: ids["19001"]!, effectId: "19001:response:1", payments: [{ heroId: ids["19001"]!, amount: 1 }] }, ctx);
    // 3 Attack against 2 - 2 Defense.
    expect(struck.cards[ids.orc!]?.damage).toBe(3);
    expect(modifiedStat(struck, struck.cards[ids.orc!]!, "defense", ctx.cards)).toBe(2);

    const last = toCombat(
      stopped({ cards: [hero("lead", { sphere: "tactics" }), ally("warrior", { traits: ["Warrior"], attack: 3, defense: 0, health: 1 }), enemy("orc", { attack: 2, health: 9 }), event("12005"), shade], effects: recordsOf(RECORDS, "12005"), heroes: [{ code: "lead" }], allies: [{ code: "warrior" }], hand: [{ code: "12005" }], enemies: [{ code: "orc" }], encounter: ["shade"] }),
      defenseWindow,
    );
    const lost = send(last.state, { type: "DeclareDefender", defenderId: last.ids.warrior! }, last.ctx);
    expect(lost.cards[last.ids.warrior!]?.zone).toBe("discard");
    const avenged = send(lost, { type: "Trigger", cardId: last.ids["12005"]!, effectId: "12005:response:1", payments: [] }, last.ctx);
    expect(avenged.cards[last.ids.orc!]?.damage).toBe(3);
  });

  it("readies the hero with Taste it Again! and gives it +2 Attack only while it attacks that enemy", () => {
    const { state, ids, ctx } = toCombat(
      stopped({ cards: [hero("gandalf", { sphere: "leadership", attack: 2, defense: 3 }), enemy("orc", { attack: 2, engagementCost: 40 }), event("144011", "leadership"), shade], effects: recordsOf(RECORDS, "144011"), heroes: [{ code: "gandalf" }], hand: [{ code: "144011" }], enemies: [{ code: "orc" }], encounter: ["shade"] }),
      defenseWindow,
    );
    const defended = send(state, { type: "DeclareDefender", defenderId: ids.gandalf! }, ctx);
    const tasted = send(defended, { type: "Trigger", cardId: ids["144011"]!, effectId: "144011:response:1", payments: [] }, ctx);
    const gandalf = tasted.cards[ids.gandalf!]!;
    expect(gandalf.exhausted).toBe(false);
    expect(modifiedStat(tasted, gandalf, "attack", ctx.cards, ids.orc)).toBe(4);
    expect(modifiedStat(tasted, gandalf, "attack", ctx.cards)).toBe(2);
  });
});
