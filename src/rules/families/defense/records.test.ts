import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS } from "../../../effects/authored/families/defense.ts";

import { attackBarred } from "../../constants.ts";
import { definePrinted } from "../../printed.ts";
import { legalIntents } from "../../reduce.ts";
import { flagged, type ScenarioState } from "../../state.ts";
import { ally, enemy, hero, offered, recordsOf, send, table, treachery, until, type TableSpec } from "./table.ts";

// Rules: rr.defending-player, rr.step-6-4-4, rr.ownership-and-control, rr.forced, rr.combat-phase, rr.lasting-effects
// (data/rules/entries.json). The records of the defense family that the other tests do not reach: enemies kept from
// attacking one player, Forced effects after a character defends, a counterattack by an attachment's hero, a change of
// control, a lasting effect on a picked player's heroes, and events held to their combat step.

const shade = treachery("shade");
const event = (code: string, sphere: "leadership" | "tactics" | "spirit" | "lore" = "tactics") => definePrinted({ code, name: code, type: "event", sphere, cost: 0 });

function stopped(spec: TableSpec): TableSpec {
  return { ...spec, seatCount: 2, cards: [...spec.cards, hero("stopper"), enemy("brute", { attack: 1 })], heroes: [...spec.heroes, { code: "stopper", seat: 1 }], enemies: [...(spec.enemies ?? []), { code: "brute", seat: 1 }], encounter: [...(spec.encounter ?? []), "shade"] };
}

function toCombat(spec: TableSpec, stop: Parameters<typeof until>[2]) {
  const built = table(spec);
  return { ...built, state: until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, stop) };
}

const defenseWindow = (state: ScenarioState) => state.window?.kind === "defense";

describe("enemies kept from attacking one player", () => {
  it("bars an enemy just engaged from attacking its player until the end of the round (Coney in a Trap), and not another player", () => {
    const built = table({ seatCount: 2, cards: [hero("a", { sphere: "lore" }), hero("b"), enemy("orc", { engagementCost: 10 }), event("17009", "lore")], effects: recordsOf(RECORDS, "17009"), heroes: [{ code: "a" }, { code: "b", seat: 1 }], hand: [{ code: "17009" }], staging: [{ code: "orc" }] });
    const engaged = send(built.state, { type: "Engage", enemyId: built.ids.orc! }, built.ctx);
    expect(offered(legalIntents(engaged, built.ctx), "17009:response:1")).toBe(true);
    const trapped = send(engaged, { type: "Trigger", cardId: built.ids["17009"]!, effectId: "17009:response:1", payments: [] }, built.ctx);
    expect(attackBarred(trapped, built.ids.orc!, 0)).toBe(true);
    expect(attackBarred(trapped, built.ids.orc!, 1)).toBe(false);
  });
});

describe("Forced effects after a character defends", () => {
  it("makes Winged Guardian's player pay 1 Tactics resource or discard it, and Watcher of the Bruinen's player discard it or a card", () => {
    const { state, ids, ctx } = toCombat(
      stopped({ cards: [hero("a", { sphere: "tactics" }), ally("02004", { defense: 3, keywords: { sentinel: true } }), ally("04056", { defense: 3, keywords: { sentinel: true } }), enemy("orc", { attack: 2, engagementCost: 40 }), enemy("goblin", { attack: 2, engagementCost: 10 }), ally("filler", { cost: 9 }), shade], effects: recordsOf(RECORDS, "02004", "04056"), heroes: [{ code: "a" }], allies: [{ code: "02004" }, { code: "04056" }], hand: [{ code: "filler" }], enemies: [{ code: "orc" }, { code: "goblin" }], encounter: ["shade", "shade"] }),
      (current) => current.window?.kind === "chooseEnemy",
    );
    const orcAttack = until(send(state, { type: "ChooseEnemy", enemyId: ids.orc! }, ctx), ctx, defenseWindow);
    const guarded = send(orcAttack, { type: "DeclareDefender", defenderId: ids["02004"]! }, ctx);
    expect(guarded.window).toEqual({ kind: "choose", seat: 0, options: ["pay", "discard"] });
    const paid = send(guarded, { type: "Choose", optionId: "pay" }, ctx);
    expect(paid.cards[ids.a!]?.resources).toBe(2);
    expect(paid.cards[ids["02004"]!]?.zone).toBe("play");
    const goblinAttack = until(paid, ctx, defenseWindow);
    const watched = send(goblinAttack, { type: "DeclareDefender", defenderId: ids["04056"]! }, ctx);
    expect(watched.window).toEqual({ kind: "choose", seat: 0, options: ["discard", "hand"] });
    const kept = send(watched, { type: "Choose", optionId: "hand" }, ctx);
    expect(kept.cards[ids.filler!]?.zone).toBe("discard");
    expect(kept.cards[ids["04056"]!]?.zone).toBe("play");
  });
});

describe("after an attack the attached hero defended", () => {
  it("declares Andúril's hero as an attacker against the enemy that just attacked, and readies Armored Destrier's hero", () => {
    const sword = definePrinted({ code: "142014", name: "Andúril", type: "attachment", sphere: "neutral", cost: 3 });
    const mount = definePrinted({ code: "12059", name: "Armored Destrier", type: "attachment", sphere: "leadership", cost: 2 });
    const { state, ids, ctx } = toCombat(
      stopped({ cards: [hero("aragorn", { attack: 4, defense: 3, health: 9 }), sword, mount, enemy("orc", { attack: 2, defense: 1, health: 9 }), shade], effects: recordsOf(RECORDS, "142014", "12059"), heroes: [{ code: "aragorn" }], attachments: [{ code: "142014", host: "aragorn" }, { code: "12059", host: "aragorn" }], enemies: [{ code: "orc" }], encounter: ["shade"] }),
      defenseWindow,
    );
    const defended = send(state, { type: "DeclareDefender", defenderId: ids.aragorn! }, ctx);
    expect(offered(legalIntents(defended, ctx), "142014:response:1")).toBe(true);
    const struck = send(defended, { type: "Trigger", cardId: ids["142014"]!, effectId: "142014:response:1" }, ctx);
    expect(struck.cards[ids.orc!]?.damage).toBe(3);
    const readied = send(struck, { type: "Trigger", cardId: ids["12059"]!, effectId: "12059:response:1" }, ctx);
    expect(readied.cards[ids.aragorn!]?.exhausted).toBe(false);
    // The second player's enemy is another enemy, but not one engaged with the defending player: its shadow card stays.
    expect(readied.cards[ids["deck:shade"]!]?.zone).toBe("shadow");
  });

  it("gives The Day's Rising's hero a resource when it defends and takes no damage", () => {
    const song = definePrinted({ code: "08139", name: "The Day's Rising", type: "attachment", sphere: "leadership", cost: 1 });
    const { state, ids, ctx } = toCombat(stopped({ cards: [hero("a", { defense: 3, keywords: { sentinel: true } }), song, enemy("orc", { attack: 2 }), shade], effects: recordsOf(RECORDS, "08139"), heroes: [{ code: "a" }], attachments: [{ code: "08139", host: "a" }], enemies: [{ code: "orc" }], encounter: ["shade"] }), defenseWindow);
    const defended = send(state, { type: "DeclareDefender", defenderId: ids.a! }, ctx);
    expect(send(defended, { type: "Trigger", cardId: ids["08139"]!, effectId: "08139:response:1" }, ctx).cards[ids.a!]?.resources).toBe(4);
  });
});

describe("a change of control, a picked player's heroes, events held to their combat step", () => {
  it("lets Rider of the Mark discard a shadow card of an enemy engaged with its new controller", () => {
    const give: Effect = { id: "04033:action:9", cardCode: "04033", lines: ["04033:A:1"], timing: "action", instructions: [{ verb: "GiveControl" }] };
    const { state, ids, ctx } = toCombat({ seatCount: 2, cards: [hero("a"), hero("b"), ally("04033", { sphere: "spirit" }), enemy("orc"), shade], effects: [...recordsOf(RECORDS, "04033"), give], heroes: [{ code: "a" }, { code: "b", seat: 1 }], allies: [{ code: "04033" }], enemies: [{ code: "orc", seat: 1 }], encounter: ["shade"] }, (current, legal) => current.phase === "Combat" && offered(legal, "04033:action:9"));
    const given = send(state, { type: "Trigger", cardId: ids["04033"]!, effectId: "04033:action:9" }, ctx);
    expect(given.cards[ids["04033"]!]?.controller).toBe(1);
    const at = until(given, ctx, (_current, legal) => offered(legal, "04033:response:1"));
    const discarded = send(at, { type: "Trigger", cardId: ids["04033"]!, effectId: "04033:response:1" }, ctx);
    expect(discarded.cards[ids["deck:shade"]!]?.zone).toBe("encounterDiscard");
  });

  it("keeps each hero of the chosen player from exhausting to attack or defend with Hour of Wrath's Valour Action", () => {
    const built = table({ seatCount: 2, cards: [hero("a"), hero("b"), hero("c"), ally("d"), event("10144")], effects: recordsOf(RECORDS, "10144"), heroes: [{ code: "a" }, { code: "b", seat: 1 }, { code: "c", seat: 1 }], allies: [{ code: "d", seat: 1 }], hand: [{ code: "10144" }], threat: 40 });
    const planning = { ...built.state, phase: "Planning" as const, mode: "planning" as const, window: { kind: "pass" as const }, planningSeat: 0 };
    const asked = send(planning, { type: "PlayCard", cardId: built.ids["10144"]!, payments: [] }, built.ctx);
    const valour = asked.window?.kind === "choose" && asked.window.options.includes("seat:1") ? asked : send(asked, { type: "Choose", optionId: "seat:1" }, built.ctx);
    const done = valour.window?.kind === "choose" ? send(valour, { type: "Choose", optionId: "seat:1" }, built.ctx) : valour;
    expect(flagged(done, built.ids.b!, "noExhaustDefend")).toBe(true);
    expect(flagged(done, built.ids.c!, "noExhaustAttack")).toBe(true);
    expect(flagged(done, built.ids.d!, "noExhaustDefend")).toBe(false);
  });

  it("offers Tireless Hunters only before enemy attacks and Helm! Helm! only after them", () => {
    const { state, ids, ctx } = toCombat(stopped({ cards: [hero("a", { attack: 0 }), event("09008"), event("143012", "tactics"), enemy("orc", { attack: 1 }), enemy("far", { engagementCost: 45 }), shade], effects: recordsOf(RECORDS, "09008", "143012"), heroes: [{ code: "a" }], hand: [{ code: "09008" }, { code: "143012" }], enemies: [{ code: "orc" }], staging: [{ code: "far" }], encounter: ["shade"] }), (current) => current.phase === "Combat" && current.window?.kind === "frameAction");
    const plays = (current: ScenarioState) => legalIntents(current, ctx).flatMap((intent) => (intent.type === "PlayCard" ? [intent.cardId] : []));
    expect(state.mode).toBe("combatActions");
    expect(plays(state)).toContain(ids["09008"]);
    expect(plays(state)).not.toContain(ids["143012"]);
  });
});
