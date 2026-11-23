// Rules: rr.triggered-ability, rr.response, rr.defending (data/rules/entries.json); ledger lines 17006:A:2, 144008:A:2, 06062:A:1, 142001:A:1.
// "After X exhausts to defend an attack" (the condition `exhaustedToDefend`): the Response is open to a character that the declaration exhausted, not to one that was exhausted already
// when an effect added it to the defenders (AddDefender). One card of each kind that prints the words: an ally (Jubayr), an attachment (Staff of Lebethron), an event (Small Target) and a
// hero (Frodo Baggins), with the real records and the printed numbers the line reads.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { definePrinted, type PrintedCard } from "../../core/printed.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { legalIntents } from "../../engine/reduce.ts";
import { ally, enemy, hero, recordsOf, send, table, treachery, until, type Table } from "./table.ts";

// An effect of the test table: the exhausted character of the seat joins the defenders as an effect, with no exhaust (AddDefender).
const ADD_EXHAUSTED: Effect = { id: "test:add-exhausted", cardCode: "guard", lines: [], timing: "action", instructions: [{ verb: "Pick", pick: { type: "character", control: "you", state: "exhausted" } }, { verb: "AddDefender" }] };

type Scene = { table: Table; defender: string; offer: (state: ScenarioState) => boolean };

// The attack is declared on `guard`, and the character `defender` is either ready (declared a defender in the same window) or exhausted already (added by the effect).
function defended(scene: Scene, how: "declared" | "added"): boolean {
  const { table: built, defender } = scene;
  const toChoice = until(built.state, built.ctx, (current) => current.window?.kind === "defense" || current.window?.kind === "chooseEnemy");
  // With two enemies engaged, the first player chooses which attacks first: the orc.
  const defending = toChoice.window?.kind === "chooseEnemy" ? send(toChoice, { type: "ChooseEnemy", enemyId: built.ids.orc! }, built.ctx) : toChoice;
  if (how === "declared") return scene.offer(send(defending, { type: "DeclareDefender", defenderId: defender }, built.ctx));
  const tired = updateCard(defending, defender, { exhausted: true });
  const declared = send(tired, { type: "DeclareDefender", defenderId: built.ids.guard! }, built.ctx);
  const added = send(declared, { type: "Trigger", cardId: built.ids.guard!, effectId: ADD_EXHAUSTED.id }, built.ctx);
  return scene.offer(added);
}

const mist = (): PrintedCard => treachery("mist");
const orc = (extra: Parameters<typeof enemy>[1] = {}): PrintedCard => enemy("orc", { attack: 3, defense: 1, health: 6, threat: 1, ...extra });
const triggerOffered = (ctx: Table["ctx"], id: string, effectId: string) => (state: ScenarioState): boolean => legalIntents(state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === id && intent.effectId === effectId);
const scene = (built: Table, defender: string, offer: (state: ScenarioState) => boolean): Scene => ({ table: built, defender, offer });

describe("17006:A:2 Jubayr, an ally: the Response after the declaration of a defender exhausted him", () => {
  it("17006:A:2 is open when his declaration exhausted him and not when an effect added him already exhausted", () => {
    const built = table({ cards: [hero("guard"), ally("17006", { sphere: "spirit" }), orc(), mist()], effects: [...recordsOf(EFFECTS, "17006"), ADD_EXHAUSTED], heroes: [{ code: "guard" }], allies: [{ code: "17006" }], enemies: [{ code: "orc" }], encounter: ["mist"] });
    const s = scene(built, built.ids["17006"]!, triggerOffered(built.ctx, built.ids["17006"]!, "17006:response:1"));
    expect(defended(s, "declared")).toBe(true);
    expect(defended(s, "added")).toBe(false);
  });
});

describe("144008:A:2 Staff of Lebethron, an attachment: after the attached hero exhausts to defend", () => {
  it("144008:A:2 is open when the hero exhausts to defend and not when an effect adds him exhausted", () => {
    const built = table({
      cards: [hero("guard"), hero("bearer"), definePrinted({ code: "144008", name: "Staff", type: "attachment", sphere: "leadership", cost: 1 }), orc({ engagementCost: 40 }), mist()],
      effects: [...recordsOf(EFFECTS, "144008"), ADD_EXHAUSTED],
      heroes: [{ code: "guard" }, { code: "bearer" }],
      attachments: [{ code: "144008", host: "bearer" }],
      enemies: [{ code: "orc" }],
      encounter: ["mist"],
    });
    const s = scene(built, built.ids.bearer!, triggerOffered(built.ctx, built.ids["144008"]!, "144008:response:1"));
    expect(defended(s, "declared")).toBe(true);
    expect(defended(s, "added")).toBe(false);
  });
});

describe("06062:A:1 Small Target, an event: after a Hobbit hero you control exhausts to defend", () => {
  it("06062:A:1 is open when the Hobbit exhausts to defend and not when an effect adds him exhausted", () => {
    const built = table({
      cards: [hero("guard"), hero("hobbit", { sphere: "spirit", traits: ["Hobbit"] }), definePrinted({ code: "06062", name: "Small Target", type: "event", sphere: "spirit", cost: 0 }), orc(), enemy("other", { engagementCost: 25 }), mist()],
      effects: [...recordsOf(EFFECTS, "06062"), ADD_EXHAUSTED],
      heroes: [{ code: "guard" }, { code: "hobbit" }],
      hand: [{ code: "06062" }],
      enemies: [{ code: "orc" }, { code: "other" }],
      encounter: ["mist"],
    });
    const s = scene(built, built.ids.hobbit!, triggerOffered(built.ctx, built.ids["06062"]!, "06062:response:1"));
    expect(defended(s, "declared")).toBe(true);
    expect(defended(s, "added")).toBe(false);
  });
});

describe("142001:A:1 Frodo Baggins, a hero: after he exhausts to defend", () => {
  it("142001:A:1 is open when he exhausts to defend and not when an effect adds him exhausted", () => {
    const built = table({
      cards: [hero("guard"), hero("142001", { sphere: "fellowship" }), definePrinted({ code: "142091", name: "The One Ring", type: "objective" }), orc(), mist()],
      effects: [...recordsOf(EFFECTS, "142001"), ADD_EXHAUSTED],
      heroes: [{ code: "guard" }, { code: "142001" }],
      allies: [{ code: "142091" }],
      enemies: [{ code: "orc" }],
      encounter: ["mist"],
    });
    const s = scene(built, built.ids["142001"]!, triggerOffered(built.ctx, built.ids["142001"]!, "142001:response:1"));
    expect(defended(s, "declared")).toBe(true);
    expect(defended(s, "added")).toBe(false);
  });
});
