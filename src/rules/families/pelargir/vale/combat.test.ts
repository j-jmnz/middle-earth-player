// Rules: rr.damage, rr.step-6-4-1, rr.step-6-4-2, rr.step-6-4-3, rr.shadow-effects, rr.in-player-order, faq.additional-attacks, faq.next-player, ats.captain-enemies (data/rules/entries.json); ledger lines 06148:A:1, 06148:A:2, 06153:A:2, 06151:A:1, 06152:A:1, 06152:A:2
// The damage a Morgul Bodyguard takes for a Captain and the attack its Shadow ends, on the table of the scenario with real attacks: a hero's attack on Murzag, damage dealt by an effect, and enemy attacks answered by the players.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../../core/intents.ts";
import { shadowCards } from "../../../core/zones.ts";
import { dealAdditionalShadow } from "../../../interpret/interpret.ts";
import { idOf, send } from "../../../../../test/harness/scene-kit.ts";
import { CODES, engagedCodes, fight, opened, run, table, tokens, where } from "../../../../../test/scenarios/the-morgul-vale/table.ts";

const { tower, bodyguard, tracker, murzag, nazgul, alcaron, sorcerer } = CODES;
const BOROMIR = "05002";

describe("the damage meant for a Captain (06148:A:1)", () => {
  const damageOf = (state: ReturnType<typeof table>["state"], code: string, nth = 0): number => Object.values(state.cards).filter((card) => card.code === code)[nth]?.damage ?? 0;

  it("goes to a Bodyguard in the staging area when a hero's attack hurts Murzag: the attack's damage, Murzag's Defense subtracted first", () => {
    const t = table({ phase: "PlayerAttacks", heroes: [BOROMIR], engaged: [murzag], staging: [tower, bodyguard] }, undefined, [BOROMIR]);
    const started = opened(t);
    const attacked = send(started, { type: "DeclareAttackers", enemyId: idOf(started.state, murzag), attackerIds: [idOf(started.state, BOROMIR)] }, t.ctx);
    const done = fight(t, attacked, (state) => state.window?.kind !== "pass" && state.mode !== "playerAttacks" ? true : damageOf(state, bodyguard) > 0);
    expect(damageOf(done.state, bodyguard)).toBe(1);
    expect(damageOf(done.state, murzag)).toBe(0);
  });

  it("goes whole to the Bodyguard with the most damage, the first in play on a tie, whatever the damage's source", () => {
    const t = table({ engaged: [murzag], staging: [tower, bodyguard, { code: bodyguard, damage: 2 }, { code: bodyguard, damage: 2 }] });
    const id = idOf(t.state, murzag);
    const hit = run(t, t.state, { verb: "DamageCard", amount: 2, target: "self" }, { sourceId: id });
    expect(damageOf(hit, bodyguard, 0)).toBe(0);
    expect(damageOf(hit, bodyguard, 1)).toBe(4);
    expect(damageOf(hit, bodyguard, 2)).toBe(2);
    expect(hit.cards[id]?.damage).toBe(0);
  });

  it("loses what passes the Bodyguard's hit points, and the Captain takes none of it", () => {
    const t = table({ engaged: [murzag], staging: [tower, { code: bodyguard, damage: 4 }] });
    const id = idOf(t.state, murzag);
    const hit = run(t, t.state, { verb: "DamageCard", amount: 6, target: "self" }, { sourceId: id });
    expect(where(hit, bodyguard)).toBe("encounterDiscard");
    expect(hit.cards[id]?.damage).toBe(0);
    expect(where(hit, murzag)).toBe("engaged");
  });

  it("is not redirected from an enemy that is no Captain, and the Captain takes the damage itself once the last Bodyguard has left play", () => {
    const t = table({ engaged: [murzag, tracker], staging: [tower, { code: bodyguard, damage: 5 }] });
    const trackerHit = run(t, t.state, { verb: "DamageCard", amount: 1, target: "self" }, { sourceId: idOf(t.state, tracker) });
    expect(trackerHit.cards[idOf(trackerHit, tracker)]?.damage).toBe(1);
    const gone = run(t, t.state, { verb: "DamageCard", amount: 1, target: "self" }, { sourceId: idOf(t.state, murzag) });
    expect(where(gone, bodyguard)).toBe("encounterDiscard");
    const after = run(t, gone, { verb: "DamageCard", amount: 2, target: "self" }, { sourceId: idOf(gone, murzag) });
    expect(after.cards[idOf(after, murzag)]?.damage).toBe(2);
  });

  it("takes the Nazgûl's reduction to 1 only when no Bodyguard is in play: with one, the Bodyguard takes the full damage", () => {
    const alone = table({ stage: CODES.rider, engaged: [nazgul], staging: [tower] });
    const reduced = run(alone, alone.state, { verb: "DamageCard", amount: 3, target: "self" }, { sourceId: idOf(alone.state, nazgul) });
    expect(reduced.cards[idOf(reduced, nazgul)]?.damage).toBe(1);
    const guarded = table({ stage: CODES.rider, engaged: [nazgul], staging: [tower, bodyguard] });
    const full = run(guarded, guarded.state, { verb: "DamageCard", amount: 3, target: "self" }, { sourceId: idOf(guarded.state, nazgul) });
    expect(damageOf(full, bodyguard)).toBe(3);
    expect(damageOf(full, nazgul)).toBe(0);
  });
});

describe("the Bodyguard's Shadow: the attacker engages the next player and attacks him (06148:A:2)", () => {
  // The attacker (the Morgul Tracker unless named) is engaged with the first player and holds the Bodyguard as the shadow card of its attack (dealt by the engine's own function, the one DealShadowInPlay calls).
  const switching = (options: { seats: 1 | 2; attacker?: string; deck?: readonly string[]; shadows?: number }) => {
    const attacker = options.attacker ?? tracker;
    // The second player has a sturdy hero beside the stand-in, so his seat outlives the attack Murzag makes against it.
    const t = table({ seats: options.seats, phase: "Combat", staging: [tower], engaged: [attacker], deck: [bodyguard, ...(options.deck ?? [sorcerer, sorcerer, sorcerer])], ...(options.seats === 2 ? { heroes: [{ code: BOROMIR, seat: 1 }] } : {}) }, undefined, [BOROMIR]);
    // The enemy engaged with the first player (the deck may hold other copies of its code).
    const id = t.state.seats[0]?.engaged[0] ?? "";
    let state = t.state;
    for (let dealt = 0; dealt < (options.shadows ?? 1); dealt += 1) state = dealAdditionalShadow(state, id, [], t.ctx);
    return { t, start: opened(t, state), attacker, id };
  };
  const untilAttackOn = (seat: number) => (state: ReturnType<typeof table>["state"]) => state.pendingAttack?.seat === seat && state.window?.kind === "defense" && state.cards[state.pendingAttack.enemyId]?.zone === "engaged";
  const attacks = (steps: readonly EngineStep[]) => steps.filter((step) => step.kind === "attack");

  it("ends the attack with no damage, engages the next player and makes an immediate attack against him with a shadow card of its own", () => {
    const { t, start, id } = switching({ seats: 2 });
    const first = fight(t, start, untilAttackOn(0), { heroCode: "dh1" });
    const heroDamage = first.state.cards[idOf(first.state, "dh1")]?.damage ?? 0;
    const answered = send(first, { type: "Undefended", heroId: idOf(first.state, "dh1") }, t.ctx);
    // The first attack is over: no damage on the hero it was made against, the enemy is engaged with the next player and a new attack is made against him.
    expect(answered.state.cards[idOf(answered.state, "dh1")]?.damage).toBe(heroDamage);
    expect(answered.state.cards[id]).toMatchObject({ zone: "engaged", controller: 1 });
    expect(answered.state.pendingAttack).toMatchObject({ seat: 1, enemyId: id });
    expect(shadowCards(answered.state.cards[id])).toHaveLength(1);
    expect(engagedCodes(answered.state, 0)).toEqual([]);
    // The new attack lands on the next player's hero, and the enemy does not attack a third time this phase.
    const done = fight(t, answered, (state) => state.phase !== "Combat", { heroCode: "dh3" });
    expect(done.state.cards[idOf(done.state, "dh3")]?.damage ?? 0).toBeGreaterThan(0);
    expect(attacks(done.steps)).toHaveLength(2);
  });

  it("does not resolve the shadow cards still facedown: the new attack's own card replaces them", () => {
    // The second card is a Morgul Tracker's Shadow: resolved against an undefended attack it would place a token on To the Tower.
    const { t, start, id } = switching({ seats: 2, attacker: sorcerer, shadows: 2, deck: [tracker, sorcerer, sorcerer] });
    const first = fight(t, start, untilAttackOn(0), { heroCode: "dh1" });
    const before = shadowCards(first.state.cards[id]);
    expect(before).toHaveLength(2);
    const answered = send(first, { type: "Undefended", heroId: idOf(first.state, "dh1") }, t.ctx);
    const after = shadowCards(answered.state.cards[id]);
    expect(after).toHaveLength(1);
    expect(after).not.toContain(before[1]);
    expect(tokens(answered.state)).toBe(0);
  });

  it("does nothing with one player: there is no next player, the attack resolves normally and the enemy stays engaged", () => {
    const { t, start, id } = switching({ seats: 1 });
    const done = fight(t, start, (state) => state.phase !== "Combat");
    expect(attacks(done.steps)).toHaveLength(1);
    expect(done.state.cards[idOf(done.state, "dh1")]?.damage).toBeGreaterThan(0);
    expect(done.state.cards[id]?.zone).toBe("engaged");
  });

  it("is heard by Murzag's Forced effect once for each attack: each defending player gets a card revealed engaged with him, and Murzag attacks twice, not three times", () => {
    const { t, start, id } = switching({ seats: 2, attacker: murzag });
    const done = fight(t, start, (state) => state.phase !== "Combat");
    expect(engagedCodes(done.state, 0)).toEqual([sorcerer]);
    expect(engagedCodes(done.state, 1)).toEqual([murzag, sorcerer]);
    expect(attacks(done.steps).filter((step) => step.kind === "attack" && step.enemyId === id)).toHaveLength(2);
  });

  it("gives Lord Alcaron an additional attack for each shadow card with no shadow effect, and a token on To the Tower for each attack he begins (06152:A:1, 06152:A:2)", () => {
    const t = table({ seats: 1, phase: "Combat", stage: CODES.betrayal, staging: [tower], engaged: [alcaron], deck: ["treachery", "treachery", sorcerer, sorcerer, sorcerer] });
    const id = idOf(t.state, alcaron);
    const dealt = dealAdditionalShadow(t.state, id, [], t.ctx);
    const done = fight(t, opened(t, dealt), (state) => state.phase !== "Combat" || state.lost);
    // Two blank cards, then a Sorcerer's Shadow (an effect, though it asks nothing of an undefended attack): three attacks in all, no fourth.
    expect(attacks(done.steps).filter((step) => step.kind === "attack" && step.enemyId === id)).toHaveLength(3);
    expect(tokens(done.state)).toBe(3);
  });
});
