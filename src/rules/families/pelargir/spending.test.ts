// Rules: rr.cannot, rr.resources (data/rules/entries.json); ledger line 05058:A:1.
// Orc Vanguard's lock (the flag cannotSpendResources on a hero with a Leadership, Spirit or Lore icon) stops every spend of that hero's resources, also the ones a card effect names directly: Rumour from the Earth (02124:A:1), Elfhelm (146006:A:1) and
// Livery of the Tower (145011:A:2). A locked hero pays nothing and the effect that needed the payment does not go on; an unlocked hero pays as before.
import { describe, expect, it } from "vitest";

import { RECORDS as DEFENSE } from "../../../effects/authored/families/defense.ts";
import { definePrinted } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { enemy, hero, recordsOf, send, table, treachery, until, type Table } from "../defense/table.ts";
import { send as sendOn, idOf, legalIntents as legalOn, finish } from "../../../../test/harness/scene-kit.ts";
import { CODES, table as siege } from "../../../../test/scenarios/the-siege-of-cair-andros/table.ts";

const locked = (state: ScenarioState, id: string): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat: "cannotSpendResources", amount: 1, until: "endOfPhase" }] });

describe("Orc Vanguard's lock reaches the direct spenders", () => {
  it("Livery of the Tower (145011:A:2) cancels no damage with the resources of a locked host, and cancels as before with an unlocked one", () => {
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
    const tried = send(held.state, { type: "Trigger", cardId: held.built.ids["145011"] ?? "", effectId: "145011:response:1" }, held.built.ctx);
    expect(tried.cards[hero0]?.resources).toBe(1);
    expect(tried.cards[hero0]?.damage).toBe(3);
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
