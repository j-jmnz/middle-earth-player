import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS } from "../../../effects/authored/families/defense.ts";

import { legalIntents, legalTargets } from "../../engine/reduce.ts";
import { definePrinted } from "../../core/printed.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { ally, enemy, hero, offered, recordsOf, send, table, treachery, until } from "./table.ts";

// Rules: rr.cancel, rr.damage, rr.response, rr.step-6-4-3, rr.timing-of-ability-resolution (data/rules/entries.json).
// The damage window: damage just dealt to a character is canceled, reduced or moved before it can destroy it, and what
// follows the damage ("After ~ suffers damage") hears what was left of it.

const orc = enemy("orc", { attack: 3 });
const shade = treachery("shade");
const responseOpen = (state: Parameters<typeof legalIntents>[0]) => state.window?.kind === "response";

// A second player whose own attack comes next, so a test can read the table before the round moves on.
function withStopper(spec: Parameters<typeof table>[0]): Parameters<typeof table>[0] {
  return {
    ...spec,
    seatCount: 2,
    cards: [...spec.cards, hero("stopper"), enemy("brute", { attack: 1 })],
    heroes: [...spec.heroes, { code: "stopper", seat: 1 }],
    enemies: [...(spec.enemies ?? []), { code: "brute", seat: 1 }],
    encounter: [...(spec.encounter ?? []), "shade"],
  };
}

// The table goes to the first enemy attack and the defending player declares this character.
function defendWith(spec: Parameters<typeof table>[0], defender: string) {
  const built = table(spec);
  const attacked = until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, (state) => state.window?.kind === "defense");
  return { ...built, state: send(attacked, { type: "DeclareDefender", defenderId: built.ids[defender] ?? defender }, built.ctx) };
}

function undefendedOn(spec: Parameters<typeof table>[0], heroKey: string) {
  const built = table(spec);
  const attacked = until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, (state) => state.window?.kind === "defense");
  return { ...built, state: send(attacked, { type: "Undefended", heroId: built.ids[heroKey] ?? heroKey }, built.ctx) };
}

describe("damage just dealt can be canceled before what follows it hears it", () => {
  it("lets Honour Guard cancel 1 of the attack's damage, and Glóin then gains a resource for each point he took", () => {
    const { state, ids, ctx } = defendWith(
      withStopper({ cards: [hero("01003", { sphere: "leadership", defense: 1 }), ally("10004", { traits: ["Gondor", "Warrior"] }), orc, shade], effects: recordsOf(RECORDS, "01003", "10004"), heroes: [{ code: "01003" }], allies: [{ code: "10004" }], enemies: [{ code: "orc" }], encounter: ["shade"] }),
      "01003",
    );
    // The cancel is offered first; Glóin's Response waits behind it (rr.cancel).
    expect(offered(legalIntents(state, ctx), "10004:response:1")).toBe(true);
    expect(offered(legalIntents(state, ctx), "01003:response:1")).toBe(false);
    expect(state.cards[ids["01003"]!]?.damage).toBe(2);
    const canceled = send(state, { type: "Trigger", cardId: ids["10004"]!, effectId: "10004:response:1" }, ctx);
    expect(canceled.cards[ids["01003"]!]?.damage).toBe(1);
    expect(offered(legalIntents(canceled, ctx), "01003:response:1")).toBe(true);
    const gained = send(canceled, { type: "Trigger", cardId: ids["01003"]!, effectId: "01003:response:1" }, ctx);
    expect(gained.cards[ids["01003"]!]?.resources).toBe(4);
  });

  it("drops what follows the damage once all of it is canceled: Frodo raises his threat instead", () => {
    const pin = definePrinted({ code: "pin", name: "Pin", type: "attachment", sphere: "neutral", cost: 0 });
    const heard: Effect = { id: "pin:response:1", cardCode: "pin", lines: ["pin:A:1"], timing: "response", trigger: "damaged", subject: "host", instructions: [{ verb: "AddResources", amount: 1, to: "host" }] };
    const { state, ids, ctx } = defendWith(
      withStopper({ cards: [hero("02025", { sphere: "spirit", traits: ["Hobbit"], defense: 1 }), pin, orc, shade], effects: [...recordsOf(RECORDS, "02025"), heard], heroes: [{ code: "02025" }], attachments: [{ code: "pin", host: "02025" }], enemies: [{ code: "orc" }], encounter: ["shade"] }),
      "02025",
    );
    const frodo = ids["02025"]!;
    const saved = send(state, { type: "Trigger", cardId: frodo, effectId: "02025:response:1" }, ctx);
    expect(saved.cards[frodo]?.damage).toBe(0);
    expect(saved.seats[0].threat).toBe(22);
    expect(offered(legalIntents(saved, ctx), "pin:response:1")).toBe(false);
  });

  it("gives a character its lethal damage's follow-up when a cancel keeps it alive (Loyal Hound)", () => {
    const { state, ids, ctx } = undefendedOn(
      withStopper({ cards: [hero("01003", { sphere: "lore", health: 3 }), ally("19148", { sphere: "lore" }), enemy("troll", { attack: 4 }), shade], effects: recordsOf(RECORDS, "01003", "19148"), heroes: [{ code: "01003" }], allies: [{ code: "19148" }], enemies: [{ code: "troll" }], encounter: ["shade"] }),
      "01003",
    );
    const gloin = ids["01003"]!;
    // 4 damage on 3 hit points waits for the Responses that could cancel it.
    expect(state.cards[gloin]?.zone).toBe("heroes");
    const saved = send(state, { type: "Trigger", cardId: ids["19148"]!, effectId: "19148:response:1" }, ctx);
    expect(saved.cards[ids["19148"]!]?.zone).toBe("discard");
    expect(saved.cards[gloin]?.damage).toBe(2);
    expect(offered(legalIntents(saved, ctx), "01003:response:1")).toBe(true);
    expect(send(saved, { type: "Trigger", cardId: gloin, effectId: "01003:response:1" }, ctx).cards[gloin]?.resources).toBe(5);
    // The second player's attack is next: the round has not moved on.
  });

  it("asks for Close Call's X between 1 and the damage dealt, and raises each player's threat by it (rr.doomed-x)", () => {
    const { state, ids, ctx } = undefendedOn(
      { cards: [hero("aragorn", { health: 10 }), definePrinted({ code: "08005", name: "Close Call", type: "event", sphere: "tactics", cost: 0 }), orc, shade], effects: recordsOf(RECORDS, "08005"), heroes: [{ code: "aragorn" }], hand: [{ code: "08005" }], enemies: [{ code: "orc" }], encounter: ["shade"] },
      "aragorn",
    );
    const asked = send(state, { type: "Trigger", cardId: ids["08005"]!, effectId: "08005:response:1", payments: [] }, ctx);
    expect(asked.window).toEqual({ kind: "choose", seat: 0, options: ["1", "2", "3"] });
    const done = send(asked, { type: "Choose", optionId: "2" }, ctx);
    expect(done.cards[ids.aragorn!]?.damage).toBe(1);
    expect(done.seats[0].threat).toBe(22);
    expect(done.cards[ids["08005"]!]?.zone).toBe("discard");
  });

  it("lets Livery of the Tower cancel no more damage than its hero's resources pay for", () => {
    const { state, ids, ctx } = undefendedOn(
      { cards: [hero("boromir", { sphere: "spirit", traits: ["Gondor"], health: 10 }), definePrinted({ code: "145011", name: "Livery of the Tower", type: "attachment", sphere: "spirit", cost: 0 }), orc, shade], effects: recordsOf(RECORDS, "145011"), heroes: [{ code: "boromir" }], attachments: [{ code: "145011", host: "boromir" }], enemies: [{ code: "orc" }], encounter: ["shade"], resources: 1 },
      "boromir",
    );
    const paid = send(state, { type: "Trigger", cardId: ids["145011"]!, effectId: "145011:response:1" }, ctx);
    expect(paid.cards[ids.boromir!]?.resources).toBe(0);
    expect(paid.cards[ids.boromir!]?.damage).toBe(2);
  });
});

describe("damage moved to another character", () => {
  it("places the damage on Dori instead of the hero", () => {
    const { state, ids, ctx } = undefendedOn(
      { cards: [hero("thorin", { health: 10 }), ally("131009", { sphere: "lore", health: 4 }), orc, shade], effects: recordsOf(RECORDS, "131009"), heroes: [{ code: "thorin" }], allies: [{ code: "131009" }], enemies: [{ code: "orc" }], encounter: ["shade"] },
      "thorin",
    );
    const moved = send(state, { type: "Trigger", cardId: ids["131009"]!, effectId: "131009:response:1" }, ctx);
    expect(moved.cards[ids.thorin!]?.damage).toBe(0);
    expect(moved.cards[ids["131009"]!]?.damage).toBe(3);
  });

  it("places 1 of another character's damage on Vigilant Guard's host", () => {
    const { state, ids, ctx } = undefendedOn(
      { cards: [hero("thorin", { health: 10 }), ally("warrior", { traits: ["Warrior"], health: 4 }), definePrinted({ code: "12113", name: "Vigilant Guard", type: "attachment", sphere: "tactics", cost: 3 }), orc, shade], effects: recordsOf(RECORDS, "12113"), heroes: [{ code: "thorin" }], allies: [{ code: "warrior" }], attachments: [{ code: "12113", host: "warrior" }], enemies: [{ code: "orc" }], encounter: ["shade"] },
      "thorin",
    );
    const moved = send(state, { type: "Trigger", cardId: ids["12113"]!, effectId: "12113:response:1" }, ctx);
    expect(moved.cards[ids.thorin!]?.damage).toBe(2);
    expect(moved.cards[ids.warrior!]?.damage).toBe(1);
  });

  it("gives Song of Mocking's host all the damage assigned to the chosen hero until the end of the phase", () => {
    const built = table({ cards: [hero("host", { health: 10 }), hero("chosen", { health: 10 }), definePrinted({ code: "02099", name: "Song of Mocking", type: "attachment", sphere: "tactics", cost: 1 }), orc, shade], effects: recordsOf(RECORDS, "02099"), heroes: [{ code: "host" }, { code: "chosen" }], attachments: [{ code: "02099", host: "host" }], enemies: [{ code: "orc" }], encounter: ["shade"] });
    const { ids, ctx } = built;
    // The combat action window after the shadow cards are dealt (6.2) offers the Song's Action.
    const window = until(send(built.state, { type: "DeclineEngage" }, ctx), ctx, (state, legal) => state.phase === "Combat" && offered(legal, "02099:action:1"));
    // "Choose another hero": the host is not one, so the other hero is chosen without a question.
    const sung = send(window, { type: "Trigger", cardId: ids["02099"]!, effectId: "02099:action:1" }, ctx);
    const attacked = until(sung, ctx, (state) => state.window?.kind === "defense");
    const hit = send(attacked, { type: "Undefended", heroId: ids.chosen! }, ctx);
    expect(hit.cards[ids.chosen!]?.damage).toBe(0);
    expect(hit.cards[ids.host!]?.damage).toBe(3);
  });
});

describe("undefended damage on an ally", () => {
  it("lets White Tower Watchman take it while every hero shares a sphere, and Barliman while every hero is a Hobbit", () => {
    const built = table({ cards: [hero("a", { sphere: "lore", traits: ["Hobbit"] }), hero("b", { sphere: "lore", traits: ["Hobbit"] }), ally("06041", { sphere: "neutral" }), ally("141007", { sphere: "lore" }), orc], effects: recordsOf(RECORDS, "06041", "141007"), heroes: [{ code: "a" }, { code: "b" }], allies: [{ code: "06041" }, { code: "141007" }], enemies: [{ code: "orc" }] });
    const attacked = syncConstants({ ...built.state, phase: "Combat", mode: "enemyAttacks", window: { kind: "defense", enemyId: built.ids.orc!, seat: 0 }, pendingAttack: { enemyId: built.ids.orc!, seat: 0 } }, built.ctx);
    expect(legalTargets(attacked, { type: "Undefended" }, built.ctx)).toEqual([built.ids.a, built.ids.b, built.ids["06041"], built.ids["141007"]]);
  });

  it("lets the ally Defender of the West is attached to take an undefended attack against the Title's controller, whoever controls the ally", () => {
    const built = table({ seatCount: 2, cards: [hero("a"), hero("b"), ally("sam", { isUnique: true }), definePrinted({ code: "08093", name: "Defender of the West", type: "attachment", sphere: "neutral", cost: 1 }), orc], effects: recordsOf(RECORDS, "08093"), heroes: [{ code: "a" }, { code: "b", seat: 1 }], allies: [{ code: "sam", seat: 1 }], attachments: [{ code: "08093", host: "sam", seat: 0 }], enemies: [{ code: "orc" }] });
    const attacked = syncConstants({ ...built.state, phase: "Combat", mode: "enemyAttacks", window: { kind: "defense", enemyId: built.ids.orc!, seat: 0 }, pendingAttack: { enemyId: built.ids.orc!, seat: 0 } }, built.ctx);
    expect(legalTargets(attacked, { type: "Undefended" }, built.ctx)).toEqual([built.ids.a, built.ids.sam]);
    const other = { ...attacked, window: { kind: "defense" as const, enemyId: built.ids.orc!, seat: 1 }, pendingAttack: { enemyId: built.ids.orc!, seat: 1 } };
    expect(legalTargets(other, { type: "Undefended" }, built.ctx)).toEqual([built.ids.b]);
  });
});

describe("after a character takes damage from an enemy attack", () => {
  it("offers Dwarven Shield once the attack's damage is placed on its hero", () => {
    const shield = definePrinted({ code: "16010", name: "Dwarven Shield", type: "attachment", sphere: "leadership", cost: 2 });
    const { state, ids, ctx } = defendWith(
      withStopper({ cards: [hero("dain", { traits: ["Dwarf"], defense: 1 }), shield, orc, shade], effects: recordsOf(RECORDS, "16010"), heroes: [{ code: "dain" }], attachments: [{ code: "16010", host: "dain" }], enemies: [{ code: "orc" }], encounter: ["shade"] }),
      "dain",
    );
    const at = until(state, ctx, (current) => responseOpen(current));
    expect(offered(legalIntents(at, ctx), "16010:response:1")).toBe(true);
    expect(send(at, { type: "Trigger", cardId: ids["16010"]!, effectId: "16010:response:1" }, ctx).cards[ids.dain!]?.resources).toBe(4);
  });

  // Reading (recommended, docs/brief.md, Player card readings): damage that destroys the hero destroys it at once and the Shield is discarded with it (rr.damage, rr.attachment-cards).
  // The case holds with and without the line's records: nothing is offered either way.
  it("16010:A:3 offers no Dwarven Shield Response when the attack's damage destroys its hero", () => {
    const shield = definePrinted({ code: "16010", name: "Dwarven Shield", type: "attachment", sphere: "leadership", cost: 2 });
    const { state, ids, ctx } = defendWith(
      withStopper({ cards: [hero("dain", { traits: ["Dwarf"], defense: 1, health: 1 }), shield, orc, shade], effects: recordsOf(RECORDS, "16010"), heroes: [{ code: "dain" }], attachments: [{ code: "16010", host: "dain" }], enemies: [{ code: "orc" }], encounter: ["shade"] }),
      "dain",
    );
    const after = until(state, ctx, (current) => current.cards[ids.dain!]?.zone === "discard" || responseOpen(current));
    expect(after.cards[ids.dain!]?.zone).toBe("discard");
    expect(after.cards[ids["16010"]!]?.zone).toBe("discard");
    expect(offered(legalIntents(after, ctx), "16010:response:1")).toBe(false);
  });
});
