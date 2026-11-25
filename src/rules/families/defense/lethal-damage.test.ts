import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { expectOk } from "../../core/test-fixture.ts";
import { flagged, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { reduce } from "../../engine/reduce.ts";
import { doRefresh } from "../../engine/refresh.ts";
import { ally, enemy, hero, table, treachery, until, send } from "./table.ts";

// Rules: rr.damage, rr.forced, rr.in-play-and-out-of-play (data/rules/entries.json).
// An effect that hears the damage of an attack runs for a character that damage destroyed, ahead of the effects that hear
// its destruction, and what it puts on that character does not wait there for the card to come back into play.

const orc = enemy("orc", { attack: 3 });

// "Forced: After a character takes damage from an attack, it cannot ready until the end of the round" (the shape of 18072:B:2).
const HOLD: Effect = { id: "lair:forced:1", cardCode: "lair", lines: ["lair:A:1"], timing: "forced", trigger: "damagedByAttack", subject: { type: "character", control: "any" }, instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "subject" }] };
// "Forced: After a character is destroyed, ..." (the shape of 142087:A:2).
const GRAVE: Effect = { id: "grave:forced:1", cardCode: "grave", lines: ["grave:A:1"], timing: "forced", trigger: "characterDestroyed", subject: { type: "character", control: "any" }, instructions: [{ verb: "AddResources", amount: 1, to: "subject" }] };
const HEARD: Effect = { id: "lair:forced:2", cardCode: "lair", lines: ["lair:A:2"], timing: "forced", trigger: "damagedByAttack", subject: { type: "character", control: "any" }, instructions: [{ verb: "AddResources", amount: 1, to: "subject" }] };

// The table at the defense window of the orc's attack; the ally with 1 hit point defends and the damage destroys it.
function killed(effects: readonly Effect[]) {
  const built = table({ cards: [hero("dain"), ally("scout", { health: 1 }), orc, treachery("lair"), treachery("grave")], effects, heroes: [{ code: "dain" }], allies: [{ code: "scout" }], enemies: [{ code: "orc" }], staging: [{ code: "lair" }, { code: "grave" }] });
  const attacked = until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, (state) => state.window?.kind === "defense");
  const result = expectOk(reduce(attacked, { type: "DeclareDefender", defenderId: built.ids.scout! }, built.ctx));
  return { ...built, state: result.state, steps: result.steps };
}

describe("a character the damage of an attack destroys", () => {
  it("announces damagedByAttack before characterDestroyed: the damage is heard first (rr.damage)", () => {
    const { state, ids, steps } = killed([HEARD, GRAVE]);
    expect(state.cards[ids.scout!]?.zone).toBe("discard");
    const heardBy = steps.flatMap((step) => (step.kind === "push" && step.frame === "forced" ? [step.cardId] : []));
    expect(heardBy).toEqual([ids.lair, ids.grave]);
  });

  it("does not carry a lasting modifier from a Forced effect into a later life: the same card readies in the refresh phase (rr.in-play-and-out-of-play)", () => {
    const { state, ids, ctx } = killed([HOLD]);
    const scout = ids.scout!;
    expect(state.cards[scout]?.zone).toBe("discard");
    expect(flagged(state, scout, "cannotReady"), "the dead character holds no modifier").toBe(false);
    // The card is put into play again (Stand and Fight, Fortune or Fate), exhausts, and the refresh phase readies it.
    const back = updateCard(moveCard(state, scout, { zone: "play", seat: 0 }), scout, { exhausted: true, damage: 0 });
    expect(doRefresh(back, ctx, []).cards[scout]?.exhausted).toBe(false);
  });

  it("still puts the modifier on a character that survives the same damage", () => {
    const built = table({ cards: [hero("dain"), ally("tough", { health: 5 }), orc, treachery("lair")], effects: [HOLD], heroes: [{ code: "dain" }], allies: [{ code: "tough" }], enemies: [{ code: "orc" }], staging: [{ code: "lair" }] });
    const attacked = until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, (state) => state.window?.kind === "defense");
    const after = send(attacked, { type: "DeclareDefender", defenderId: built.ids.tough! }, built.ctx);
    expect(flagged(after, built.ids.tough!, "cannotReady")).toBe(true);
  });
});
