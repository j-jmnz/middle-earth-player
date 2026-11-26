import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS } from "../../../effects/authored/families/defense.ts";

import { definePrinted } from "../../core/printed.ts";
import { legalIntents } from "../../engine/reduce.ts";
import { enemy, hero, offered, recordsOf, send, table, treachery, until } from "./table.ts";

// Rules: rr.damage, rr.cancel, rr.step-6-4-3, rr.shadow-effects (data/rules/entries.json); ledger lines 19152:A:3, 41035:A:2.
// Damage a Response cancels after it was placed is not damage dealt by the attack: a shadow that reads "the damage dealt by this attack" counts what is left.

const shirt = definePrinted({ code: "19152", name: "Mithril Shirt", type: "attachment", sphere: "neutral", cost: 0 });
const omen = treachery("omen");
// Shadow: after this attack, raise your threat by 1 for each point of damage dealt by it.
const omenShadow: Effect = { id: "omen:shadow:1", cardCode: "omen", lines: ["omen:A:1"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: { dealt: true }, who: "actor" }] }] };

function threatAfterUndefended(canceling: boolean): number {
  const built = table({
    cards: [hero("a"), shirt, enemy("brute", { attack: 3 }), omen],
    effects: [...recordsOf(RECORDS, "19152"), omenShadow],
    heroes: [{ code: "a" }],
    attachments: canceling ? [{ code: "19152", host: "a" }] : [],
    enemies: [{ code: "brute" }],
    encounter: ["omen"],
    threat: 20,
  });
  const window = until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, (state) => state.window?.kind === "defense");
  let run = send(window, { type: "Undefended", heroId: built.ids.a! }, built.ctx);
  if (canceling) {
    expect(offered(legalIntents(run, built.ctx), "19152:response:1")).toBe(true);
    run = send(run, { type: "Trigger", cardId: built.ids["19152"]!, effectId: "19152:response:1" }, built.ctx);
    expect(run.cards[built.ids.a!]?.damage).toBe(2);
  }
  run = until(run, built.ctx, (state) => state.phase !== "Combat" || state.pendingAttack == null);
  return run.seats[0]!.threat;
}

describe("damage canceled after it was placed", () => {
  it("19152:A:3 counts the 2 damage left, not the 3 placed, as dealt by the attack", () => {
    expect(threatAfterUndefended(false)).toBe(23);
    expect(threatAfterUndefended(true)).toBe(22);
  });
});
