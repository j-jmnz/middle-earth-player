// Rules: rr.cannot, rr.resources (data/rules/entries.json); ledger line 05058:A:1.
// Orc Vanguard's lock (the flag cannotSpendResources on a hero with a Leadership, Spirit or Lore icon) stops every spend of that hero's resources, also the ones a card effect names directly: Rumour from the Earth (02124:A:1), Elfhelm (146006:A:1) and
// Livery of the Tower (145011:A:2). A locked hero pays nothing and the effect that needed the payment does not go on; an unlocked hero pays as before.
import { describe, expect, it } from "vitest";

import { RECORDS as DEFENSE } from "../../../effects/authored/families/defense.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Effect } from "../../../catalog/boundary.ts";
import { ally, enemy, hero, offered, recordsOf, send, table, treachery, until, type Table, type TableSpec } from "../defense/table.ts";
import { groupResources } from "../defense/conditions.ts";
import { legalIntents as legalState } from "../../engine/reduce.ts";
import { send as sendOn, idOf, legalIntents as legalOn, finish } from "../../../../test/harness/scene-kit.ts";
import { CODES, table as siege } from "../../../../test/scenarios/the-siege-of-cair-andros/table.ts";

const locked = (state: ScenarioState, id: string): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat: "cannotSpendResources", amount: 1, until: "endOfPhase" }] });

describe("Orc Vanguard's lock reaches the direct spenders", () => {
  it("Livery of the Tower (145011:A:2) is not offered for a locked host, and cancels as before with an unlocked one", () => {
    const spec = { cards: [hero("boromir", { sphere: "spirit", traits: ["Gondor"], health: 10 }), definePrinted({ code: "145011", name: "Livery of the Tower", type: "attachment", sphere: "spirit", cost: 0 }), enemy("orc", { attack: 3 }), treachery("shade")], effects: recordsOf(DEFENSE, "145011"), heroes: [{ code: "boromir" }], attachments: [{ code: "145011", host: "boromir" }], enemies: [{ code: "orc" }], encounter: ["shade"], resources: 1 };
    const attacked = (lock: boolean): { state: ScenarioState; built: Table } => {
      const built = table(spec);
      const defense = until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, (state) => state.window?.kind === "defense");
      const hit = send(defense, { type: "Undefended", heroId: built.ids.boromir ?? "" }, built.ctx);
      return { state: lock ? locked(hit, built.ids.boromir ?? "") : hit, built };
    };
    const free = attacked(false);
    const paid = send(free.state, { type: "Trigger", cardId: free.built.ids["145011"] ?? "", effectId: "145011:response:1" }, free.built.ctx);
    expect(paid.cards[free.built.ids.boromir ?? ""]).toMatchObject({ resources: 0, damage: 2 });
    const held = attacked(true);
    const hero0 = held.built.ids.boromir ?? "";
    // The effect is not offered for a locked host; the damage stays and the pool is untouched.
    expect(offered(legalState(held.state, held.built.ctx), "145011:response:1")).toBe(false);
    expect(held.state.cards[hero0]?.resources).toBe(1);
    expect(held.state.cards[hero0]?.damage).toBe(3);
  });

  // The scenario's table in the planning phase with the card in hand and a hero of the sphere the card pays from; Orc Vanguard in the staging area locks the hero.
  const planning = (code: string, hero: string, locked: boolean) => siege({ phase: "Planning", staging: locked ? [CODES.vanguard] : [], hand: [code], heroes: [{ code: hero, seat: 0, resources: 2 }] }, undefined, [code, hero]);

  it("Elfhelm (146006:A:1) does not enter play on the resource of a locked Rohan hero, and enters for it with an unlocked one", () => {
    for (const locked of [false, true]) {
      const t = planning("146006", "01002", locked);
      const hero0 = idOf(t.state, "01002");
      const elfhelm = idOf(t.state, "146006");
      const offered = legalOn(t.state, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === elfhelm);
      let state = t.state;
      // The locked hero cannot pay, so the card is not offered for it at all.
      expect(offered != null).toBe(!locked);
      if (offered) {
        state = sendOn({ state, steps: [] }, offered as Parameters<typeof sendOn>[1], t.ctx).state;
        state = finish({ state, steps: [] }, t.ctx, () => hero0).state;
      }
      expect(state.cards[hero0]?.resources).toBe(locked ? 2 : 1);
      expect(state.cards[elfhelm]?.zone).toBe(locked ? "hand" : "play");
    }
  });

  it("Rumour from the Earth (02124:A:1) pays no Lore resource from a locked hero, and the event does not return to the hand", () => {
    for (const locked of [false, true]) {
      const t = planning("02124", "01012", locked);
      const hero0 = idOf(t.state, "01012");
      const rumour = idOf(t.state, "02124");
      const intent = legalOn(t.state, t.ctx).find((entry) => entry.type === "PlayCard" && entry.cardId === rumour);
      expect(intent).toBeDefined();
      const played = finish(sendOn({ state: t.state, steps: [] }, { ...(intent as Parameters<typeof sendOn>[1]), payments: [] } as Parameters<typeof sendOn>[1], t.ctx), t.ctx, (state) => (state.window?.kind === "choose" && state.window.options.includes("return") ? "return" : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")));
      expect(played.state.cards[hero0]?.resources).toBe(locked ? 2 : 1);
      expect(played.state.cards[rumour]?.zone).toBe(locked ? "discard" : "hand");
    }
  });
});

// The lock is read before a spend: a pick or a requirement that feeds a spend leaves out a locked pool (rr.cannot), so the effect is not half paid, evaded or offered for nothing.
describe("Orc Vanguard's lock is read before the pick of a spend", () => {
  const shade = treachery("shade");
  const spite = treachery("spite");
  const spiteShadow: Effect = { id: "spite:shadow:1", cardCode: "spite", lines: ["spite:A:1"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker" }] };
  const tides = definePrinted({ code: "12007", name: "Tides of Fate", type: "event", sphere: "spirit", cost: 0 });
  const defenseWindow = (state: ScenarioState) => state.window?.kind === "defense";
  // The first player's heroes defend one enemy; a second seat holds an enemy of its own so the round goes on.
  const toDefense = (spec: TableSpec) => {
    const built = table({ ...spec, seatCount: 2, cards: [...spec.cards, hero("stopper"), enemy("brute", { attack: 1 }), shade], heroes: [...spec.heroes, { code: "stopper", seat: 1 }], enemies: [...(spec.enemies ?? []), { code: "brute", seat: 1 }], encounter: [...(spec.encounter ?? []), "shade"] });
    return { ...built, state: until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, defenseWindow) };
  };
  // Answers every pick window with the card `prefer` names first, keeping the options each window offered.
  const answerPicks = (from: ScenarioState, ctx: Table["ctx"], prefer: (asked: number, options: readonly string[]) => string) => {
    let state = from;
    const offeredAt: (readonly string[])[] = [];
    for (let guard = 0; guard < 10 && state.window?.kind === "choose"; guard += 1) {
      const options = state.window.options;
      offeredAt.push(options);
      state = send(state, { type: "Choose", optionId: prefer(offeredAt.length - 1, options) }, ctx);
    }
    return { state, offeredAt };
  };

  it("Winged Guardian (02004:A:3) is discarded when the only Tactics hero is locked, and is paid by the unlocked hero when there is one", () => {
    const spec = (heroes: readonly string[]): TableSpec => ({ cards: [...heroes.map((code) => hero(code)), ally("02004", { defense: 3, keywords: { sentinel: true } }), enemy("orc", { attack: 2, engagementCost: 40 })], effects: recordsOf(DEFENSE, "02004"), heroes: heroes.map((code) => ({ code })), allies: [{ code: "02004" }], enemies: [{ code: "orc" }] });
    const alone = toDefense(spec(["a"]));
    const guarded = send(locked(alone.state, alone.ids.a ?? ""), { type: "DeclareDefender", defenderId: alone.ids["02004"] ?? "" }, alone.ctx);
    const settled = answerPicks(guarded, alone.ctx, (_asked, options) => (options.includes("discard") ? "discard" : (options[0] ?? ""))).state;
    expect(settled.cards[alone.ids["02004"] ?? ""]?.zone).toBe("discard");
    expect(settled.cards[alone.ids.a ?? ""]?.resources).toBe(3);
    const pair = toDefense(spec(["a", "b"]));
    const paying = send(locked(pair.state, pair.ids.a ?? ""), { type: "DeclareDefender", defenderId: pair.ids["02004"] ?? "" }, pair.ctx);
    const asked = answerPicks(paying, pair.ctx, (_asked, options) => (options.includes("pay") ? "pay" : (options.find((id) => id === pair.ids.a) ?? options[0] ?? "")));
    expect(asked.offeredAt.flat()).not.toContain(pair.ids.a);
    expect(asked.state.cards[pair.ids.b ?? ""]?.resources).toBe(2);
    expect(asked.state.cards[pair.ids.a ?? ""]?.resources).toBe(3);
    expect(asked.state.cards[pair.ids["02004"] ?? ""]?.zone).toBe("play");
  });

  it("Tides of Fate (12007:A:1) is paid in full from the unlocked pool or not at all: a locked hero is never offered for the second resource", () => {
    const { state, ids, ctx } = toDefense({ cards: [hero("d", { sphere: "spirit", defense: 2, health: 9 }), hero("a"), hero("b"), enemy("orc", { attack: 3 }), tides, spite], effects: [...recordsOf(DEFENSE, "12007"), spiteShadow], heroes: [{ code: "d" }, { code: "a" }, { code: "b" }], hand: [{ code: "12007" }], enemies: [{ code: "orc" }], encounter: ["spite"] });
    const held = locked({ ...state, cards: { ...state.cards, [ids.a ?? ""]: { ...state.cards[ids.a ?? ""]!, resources: 2 } } }, ids.b ?? "");
    const raised = send(held, { type: "DeclareDefender", defenderId: ids.d ?? "" }, ctx);
    expect(offered(legalState(raised, ctx), "12007:response:1")).toBe(true);
    const played = send(raised, { type: "Trigger", cardId: ids["12007"] ?? "", effectId: "12007:response:1", payments: [] }, ctx);
    // The first pick takes the unlocked hero a, the second the locked one when it is offered: the lock makes it a hero nobody can pick.
    const ready = answerPicks(played, ctx, (asked, options) => (options.includes("ready") ? "ready" : (options.find((id) => id === (asked === 2 ? ids.b : ids.a)) ?? options[0] ?? "")));
    expect(ready.state.cards[ids.b ?? ""]?.resources).toBe(3);
    expect(ready.state.cards[ids.a ?? ""]?.resources).toBe(0);
    expect(ready.state.cards[ids.d ?? ""]?.exhausted).toBe(false);
  });

  it("Elfhelm (146006:A:1) is not offered while the only Rohan hero with resources is locked, and takes the resource of the unlocked one otherwise", () => {
    const only = siege({ phase: "Planning", staging: [CODES.vanguard], hand: ["146006"], heroes: [{ code: "01002", seat: 0, resources: 2 }] }, undefined, ["146006", "01002"]);
    const elfhelm = idOf(only.state, "146006");
    expect(legalOn(only.state, only.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === elfhelm)).toBe(false);
  });

  it("Livery of the Tower (145011:A:2) is not offered for a locked host", () => {
    const spec = { cards: [hero("boromir", { sphere: "spirit", traits: ["Gondor"], health: 10 }), definePrinted({ code: "145011", name: "Livery of the Tower", type: "attachment", sphere: "spirit", cost: 0 }), enemy("orc", { attack: 3 }), treachery("shade")], effects: recordsOf(DEFENSE, "145011"), heroes: [{ code: "boromir" }], attachments: [{ code: "145011", host: "boromir" }], enemies: [{ code: "orc" }], encounter: ["shade"], resources: 1 };
    const built = table(spec);
    const defense = until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, defenseWindow);
    const hit = send(defense, { type: "Undefended", heroId: built.ids.boromir ?? "" }, built.ctx);
    expect(offered(legalState(hit, built.ctx), "145011:response:1")).toBe(true);
    expect(offered(legalState(locked(hit, built.ids.boromir ?? ""), built.ctx), "145011:response:1")).toBe(false);
  });

  it("Rumour from the Earth (02124:A:1) does not offer the return while the only Lore hero is locked", () => {
    const t = siege({ phase: "Planning", staging: [CODES.vanguard], hand: ["02124"], heroes: [{ code: "01012", seat: 0, resources: 2 }] }, undefined, ["02124", "01012"]);
    const rumour = idOf(t.state, "02124");
    const intent = legalOn(t.state, t.ctx).find((entry) => entry.type === "PlayCard" && entry.cardId === rumour);
    expect(intent).toBeDefined();
    const asked: (readonly string[])[] = [];
    finish(sendOn({ state: t.state, steps: [] }, { ...(intent as Parameters<typeof sendOn>[1]), payments: [] } as Parameters<typeof sendOn>[1], t.ctx), t.ctx, (state) => {
      if (state.window?.kind === "choose") asked.push(state.window.options);
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    expect(asked.flat()).not.toContain("return");
  });

  it("the group payment to ready defenders (payToReady) does not count the resources of a locked hero", () => {
    const built = table({ cards: [hero("a"), hero("b")], effects: [], heroes: [{ code: "a" }, { code: "b" }] });
    expect(groupResources(built.state, [0], "tactics", built.ctx)).toBe(6);
    expect(groupResources(locked(built.state, built.ids.a ?? ""), [0], "tactics", built.ctx)).toBe(3);
  });
});
