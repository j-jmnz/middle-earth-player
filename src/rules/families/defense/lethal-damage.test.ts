import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";

import { expectOk } from "../../core/test-fixture.ts";
import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";
import { AUTHORED_EFFECTS as KINGS_QUEST } from "../../../effects/authored/the-kings-quest.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { reduce } from "../../engine/reduce.ts";
import { doRefresh } from "../../engine/refresh.ts";
import { ally, enemy, hero, table, treachery, until, send } from "./table.ts";

// Rules: rr.damage, rr.forced, rr.in-play-and-out-of-play (data/rules/entries.json).
// An effect that hears the damage of an attack runs for a character that damage destroyed, ahead of the effects that hear
// its destruction, and what it puts on that character does not wait there for the card to come back into play.

const orc = enemy("orc", { attack: 3 });

// "Forced: After a character takes damage from an attack, it cannot ready until the end of the round" (the shape of 18072:B:2).
const HOLD: Effect = { id: "lair:forced:1", cardCode: "lair", lines: ["lair:A:1"], timing: "forced", trigger: "damagedByAttack", subject: { type: "character", control: "any" }, instructions: [{ verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "endOfRound", target: "subject" }] };
// "Forced: After a character is destroyed, add 1 resource to it": the Forced of a character's destruction, one that adds a resource to its subject.
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

// The shadow card of the attacking enemy (Giant Spider 18052, the real record: the defender does not ready this round) resolves before
// damage, so the defender holds the modifier when the damage destroys it.
function shadowed(health: number, extra: Parameters<typeof table>[0]["cards"] = []) {
  const spider = treachery("18052");
  const built = table({ cards: [hero("dain"), ally("scout", { health }), orc, spider, ...extra], effects: KINGS_QUEST.filter((effect) => effect.id === "18052:shadow:1"), heroes: [{ code: "dain" }], allies: [{ code: "scout" }], enemies: [{ code: "orc" }], encounter: ["18052"] });
  const attacked = until(send(built.state, { type: "DeclineEngage" }, built.ctx), built.ctx, (state) => state.window?.kind === "defense");
  return { ...built, state: send(attacked, { type: "DeclareDefender", defenderId: built.ids.scout! }, built.ctx) };
}

function spawnHeld(state: ScenarioState) {
  const spawned = spawn(state, "held", { zone: "hand", seat: 0 });
  return { state: spawned.state, id: spawned.id };
}

const putBack = (state: ScenarioState, id: string) => updateCard(moveCard(state, id, { zone: "play", seat: 0 }), id, { exhausted: true, damage: 0 });

describe("a lasting modifier on a card that leaves play", () => {
  it("ends with its time in play: a destroyed defender put back readies in the refresh phase (rr.in-play-and-out-of-play)", () => {
    const { state, ids, ctx } = shadowed(1);
    const scout = ids.scout!;
    expect(state.cards[scout]?.zone).toBe("discard");
    expect(flagged(state, scout, "doesNotReady")).toBe(false);
    // Stands for Stand and Fight (01051): the same instance is put into play again, exhausted, in the same round.
    expect(doRefresh(putBack(state, scout), ctx, []).cards[scout]?.exhausted).toBe(false);
  });

  it("lasts to its end on a defender that survives (control)", () => {
    const { state, ids, ctx } = shadowed(5);
    const scout = ids.scout!;
    expect(state.cards[scout]?.zone).toBe("play");
    expect(flagged(state, scout, "doesNotReady")).toBe(true);
    expect(doRefresh({ ...state, cards: { ...state.cards, [scout]: { ...state.cards[scout]!, exhausted: true } } }, ctx, []).cards[scout]?.exhausted).toBe(true);
  });

  it("leaves a modifier on a card in a hand when another card leaves play", () => {
    const { state, ids } = shadowed(5, [ally("held")]);
    // A modifier made while the card is out of play stands for a cost change on a card in a hand ("the next card you play").
    const held = spawnHeld(state);
    const marked = { ...held.state, modifiers: [...held.state.modifiers, { instanceId: held.id, sourceId: ids.dain!, stat: "willpower" as const, amount: 1, until: "endOfRound" as const }] };
    const after = moveCard(marked, ids.scout!, { zone: "discard", seat: 0 });
    expect(after.modifiers.some((modifier) => modifier.instanceId === held.id)).toBe(true);
    expect(after.modifiers.some((modifier) => modifier.instanceId === ids.scout!)).toBe(false);
  });
});
