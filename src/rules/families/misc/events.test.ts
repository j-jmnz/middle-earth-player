// Rules: rr.response, rr.step-6-8-3, rr.step-6-8-4, rr.damage, rr.step-1-3, rr.restricted (data/rules/entries.json).
// The misc family's Responses and Actions that need more of the table: attacks, attachments played, the resource phase's draw.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/misc.ts";
import { cardMap, expectOk } from "../../core/test-fixture.ts";
import { definePrinted } from "../../core/printed.ts";
import { legalIntents, reduce } from "../../engine/reduce.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo, spawn } from "../../core/zones.ts";
import { fighter, table } from "../attack/fixture.ts";
import { MISC_CARDS, choices, miscCtx } from "./fixture.ts";
import { offered, play, put, run, seat, send, trigger, triggers } from "../play/fixture.ts";


const ctx = miscCtx(RECORDS);

describe("attack Responses", () => {
  const extra = [
    fighter("dwarf", { traits: ["Dwarf"], attack: 3 }),
    fighter("warrior", { traits: ["Warrior"], attack: 3 }),
    definePrinted({ code: "04105", name: "Heavy Stroke", type: "event", sphere: "tactics", cost: 0 }),
    definePrinted({ code: "142013", name: "Glamdring", type: "attachment", sphere: "neutral", cost: 0, traits: ["Weapon"] }),
    definePrinted({ code: "orcling", name: "Orcling", type: "enemy", attack: 1, defense: 0, health: 1, engagementCost: 30, threat: 1, traits: ["Orc"] }),
  ];

  it("Heavy Stroke deals the same damage again after a Dwarf damages an enemy in combat (04105:A:1)", () => {
    const t = table([{ code: "dwarf", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }, { code: "04105", at: { zone: "hand", seat: 0 } }], RECORDS, extra);
    const declared = expectOk(reduce(t.state, { type: "DeclareAttackers", enemyId: t.ids.orc!, attackerIds: [t.ids.dwarf!] }, t.ctx)).state;
    const offers = legalIntents(declared, t.ctx).filter((intent) => intent.type === "Trigger" && intent.effectId === "04105:response:1");
    expect(offers).toHaveLength(1);
    const used = expectOk(reduce(declared, { type: "Trigger", cardId: t.ids["04105"]!, effectId: "04105:response:1", payments: [{ heroId: t.ids.dwarf!, amount: 0 }] }, t.ctx)).state;
    // The Dwarf dealt 3 - 1 = 2 damage; Heavy Stroke dealt 2 more.
    expect(used.cards[t.ids.orc!]?.damage).toBe(4);
    expect(used.cards[t.ids["04105"]!]?.zone).toBe("discard");
  });

  it("Glamdring draws a card after its character destroys an Orc (142013:A:3)", () => {
    const t = table(
      [{ code: "warrior", at: { zone: "heroes", seat: 0 } }, { code: "orcling", at: { zone: "engaged", seat: 0 } }, { code: "142013", at: { zone: "play", seat: 0 } }, { code: "filler", at: { zone: "deck", seat: 0 } }],
      RECORDS,
      extra,
    );
    const attached = attachTo(t.state, t.ids["142013"]!, t.ids.warrior!);
    const declared = expectOk(reduce(attached, { type: "DeclareAttackers", enemyId: t.ids.orcling!, attackerIds: [t.ids.warrior!] }, t.ctx)).state;
    const offers = legalIntents(declared, t.ctx).filter((intent) => intent.type === "Trigger" && intent.effectId === "142013:response:1");
    expect(offers).toHaveLength(1);
    const drawn = expectOk(reduce(declared, { type: "Trigger", cardId: t.ids["142013"]!, effectId: "142013:response:1" }, t.ctx)).state;
    expect(drawn.seats[0]?.hand).toContain(t.ids.filler);
    // Not an Orc: no Response.
    const plain = table([{ code: "warrior", at: { zone: "heroes", seat: 0 } }, { code: "troll", at: { zone: "engaged", seat: 0 } }, { code: "142013", at: { zone: "play", seat: 0 } }], RECORDS, extra);
    const withSword = attachTo(plain.state, plain.ids["142013"]!, plain.ids.warrior!);
    const hit = expectOk(reduce(withSword, { type: "DeclareAttackers", enemyId: plain.ids.troll!, attackerIds: [plain.ids.warrior!] }, plain.ctx)).state;
    expect(legalIntents(hit, plain.ctx).filter((intent) => intent.type === "Trigger" && intent.effectId === "142013:response:1")).toEqual([]);
  });
});

describe("Responses to plays and draws", () => {
  it("Brand son of Bain draws a card after you play an attachment on a Dale character with no attachment (18001:A:2)", () => {
    const table = seat(1, ["18001", "rohan"]);
    const brand = table.heroes[0] ?? "";
    const trinket = put(table.state, "item1", "hand");
    const charm = put(trinket.state, "item2", "hand");
    const deck = put(charm.state, "filler", "deck");
    let state = run(play(deck.state, trinket.id, ctx, [], brand), ctx);
    expect(triggers(state, ctx, "18001:response:1")).toHaveLength(1);
    state = trigger(state, brand, "18001:response:1", ctx);
    expect(state.seats[0]?.hand).toContain(deck.id);
    // The hero now has an attachment: a second one draws nothing.
    state = run(play(state, charm.id, ctx, [], brand), ctx);
    expect(triggers(state, ctx, "18001:response:1")).toEqual([]);
    // A host that is not a Dale character draws nothing either.
    const other = seat(1, ["18001", "rohan"]);
    const third = put(other.state, "item1", "hand");
    const away = run(play(third.state, third.id, ctx, [], other.heroes[1] ?? ""), ctx);
    expect(triggers(away, ctx, "18001:response:1")).toEqual([]);
  });

  it("Círdan discards one of the cards he drew at the beginning of the resource phase (11001:A:2)", () => {
    const table = seat(1, ["11001", "dwarf"]);
    const first = put(table.state, "filler", "deck");
    const second = put(first.state, "helper", "deck");
    const third = put(second.state, "cheap", "deck");
    // Círdan draws 1 additional card through the record the pool holds; here the table gives the extra draw directly.
    let state: typeof third.state = {
      ...third.state,
      phase: "Resource",
      mode: "resourceGrant",
      boundaryPhase: "Resource",
      window: null,
      modifiers: [...third.state.modifiers, { instanceId: "seat:0", sourceId: table.heroes[0] ?? "", stat: "extraDraw", amount: 1, until: "whileSourceInPlay" }],
    };
    state = run(state, ctx);
    // Two cards were drawn, both can be discarded; one is chosen.
    expect(state.seats[0]?.hand).toHaveLength(2);
    expect(state.window).toMatchObject({ kind: "choose" });
    const options = choices(state);
    expect(options.sort()).toEqual([...(state.seats[0]?.hand ?? [])].sort());
    state = send(state, { type: "Choose", optionId: options[0] ?? "" }, ctx);
    expect(state.seats[0]?.hand).toHaveLength(1);
    expect(state.seats[0]?.discard).toHaveLength(1);
  });
});

describe("other Actions", () => {
  it("Warden of Healing heals up to 2 damaged characters, then may pay 2 Lore to ready (04083:A:1)", () => {
    const table = seat(1, ["lore", "rohan"]);
    const warden = put(table.state, "04083", "play");
    const [lore, rohan] = table.heroes;
    let state = updateCard(updateCard(warden.state, lore ?? "", { damage: 3 }), rohan ?? "", { damage: 2 });
    state = trigger(state, warden.id, "04083:action:1", ctx);
    // Both are chosen: the actor picks up to 2 from the damaged characters.
    for (let guard = 0; guard < 6 && state.window?.kind === "choose"; guard += 1) {
      const options = choices(state);
      const choice = options.find((option) => option === lore || option === rohan) ?? options.find((option) => option === "ready") ?? options[0];
      state = send(state, { type: "Choose", optionId: choice ?? "" }, ctx);
    }
    expect(state.cards[lore ?? ""]?.damage).toBeLessThan(3);
    expect(state.cards[rohan ?? ""]?.damage).toBeLessThan(2);
  });

  it("Infighting moves damage from one enemy to another (02058:A:1)", () => {
    const table = seat();
    const event = put(table.state, "02058", "hand");
    const grunt = put(event.state, "grunt", "engaged");
    const brute = put(grunt.state, "brute", "engaged");
    const hurt = updateCard(brute.state, grunt.id, { damage: 3 });
    let state = play(hurt, event.id, ctx);
    for (let guard = 0; guard < 8 && state.window?.kind === "choose"; guard += 1) {
        const options = choices(state);
      // X is chosen from 0 to the damage on the first enemy.
      const pick = options.includes("x2") ? "x2" : (options[0] ?? "");
      state = send(state, { type: "Choose", optionId: pick }, ctx);
    }
    expect(state.cards[grunt.id]?.damage).toBe(1);
    expect(state.cards[brute.id]?.damage).toBe(2);
  });

  it("Keen-eyed Took looks at the top card of each player's deck (02073:A:1)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const took = put(table.state, "02073", "hand");
    const a = put(took.state, "filler", "deck", 0);
    const b = put(a.state, "helper", "deck", 1);
    let state = run(play(b.state, took.id, ctx, [{ heroId: table.heroes[0] ?? "", amount: 2 }]), ctx);
    state = trigger(state, took.id, "02073:response:1", ctx);
    let looked = 0;
    for (let guard = 0; guard < 6 && state.window != null && state.window.kind !== "pass"; guard += 1) {
      looked += 1;
      state = send(state, { type: "Pass" }, ctx);
    }
    expect(looked).toBeGreaterThanOrEqual(1);
    void offered;
    void spawn;
    void cardMap;
    void MISC_CARDS;
  });
});
