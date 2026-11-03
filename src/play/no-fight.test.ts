// Rules: rr.step-6-8b, ltp.resolve-player-attacks (data/rules/entries.json). Éowyn's Action (145002:A:2) readies her with +9
// Attack until the end of the phase. Used in combat with no enemy engaged, no attack follows and the phase ends: the combat
// window says so before it is used.
import { describe, expect, it } from "vitest";

import { RECORDS as FOTW } from "../effects/authored/pool/FotW.ts";
import { actionWindow, fighter, table } from "../rules/families/attack/fixture.ts";
import { legalIntents } from "../rules/reduce.ts";

import { windowSheet } from "./bar-sheets.ts";

const names = { card: (id: string) => id, line: () => null };
const NO_FIGHT = "No enemy can be attacked this phase.";
const EOWYN = FOTW.filter((effect) => effect.cardCode === "145002");

describe("a combat window with nothing to attack", () => {
  it("says no attack can be made when no enemy is engaged, while Éowyn's Action is offered", () => {
    const { state, ctx } = table([{ code: "145002", at: { zone: "heroes", seat: 0 } }], EOWYN, [fighter("145002")]);
    const open = actionWindow(state);
    const legal = legalIntents(open, ctx);
    expect(legal.some((intent) => intent.type === "Trigger" && intent.effectId === "145002:action:1")).toBe(true);
    expect(windowSheet(open, ctx, legal, names).note).toContain(NO_FIGHT);
  });

  it("says nothing of it while an engaged enemy can still be attacked, even by an exhausted Éowyn she could ready", () => {
    const { state, ids, ctx } = table([{ code: "145002", at: { zone: "heroes", seat: 0 } }, { code: "orc", at: { zone: "engaged", seat: 0 } }], EOWYN, [fighter("145002")]);
    const open = actionWindow({ ...state, cards: { ...state.cards, [ids["145002"] ?? ""]: { ...state.cards[ids["145002"] ?? ""]!, exhausted: true } } });
    expect(windowSheet(open, ctx, legalIntents(open, ctx), names).note ?? "").not.toContain(NO_FIGHT);
  });
});
