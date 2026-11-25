// Rules: rr.damage, rr.step-6-4-1, rr.step-6-4-2, rr.step-6-4-3, rr.shadow-effects, rr.in-player-order, rr.player-elimination, faq.additional-attacks, faq.next-player, ats.captain-enemies (data/rules/entries.json); ledger lines 06148:A:1, 06148:A:2.
// The Morgul Bodyguard on the table of the scenario with real attacks: the damage meant for a Captain (a hero's attack, damage dealt by a player card and an effect, damage moved from another enemy) goes to the Bodyguard with the most damage, and the Shadow that engages the next player ends the attack with no damage
// and starts an immediate attack on him. The players outlive the attacks (a sturdy hero beside the stand-in). An eliminated player is not counted and not engaged.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { shadowCards } from "../../../rules/core/zones.ts";
import { dealAdditionalShadow } from "../../../rules/interpret/interpret.ts";
import { idOf, send } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, engagedCodes, fight, opened, playCard, run, table, where } from "../../../../test/scenarios/the-morgul-vale/table.ts";

const { tower, bodyguard, tracker, murzag, nazgul, sorcerer, rider } = CODES;
const BOROMIR = "05002";
const HAIL = "04032";
const INFIGHTING = "02058";
const DENETHOR = "01010";
const damageOf = (state: ScenarioState, code: string, nth = 0): number => Object.values(state.cards).filter((card) => card.code === code)[nth]?.damage ?? 0;
const attacks = (steps: readonly EngineStep[], id?: string) => steps.filter((step) => step.kind === "strike" && step.side === "enemy" && (id == null || step.enemyId === id));

lineSpec("06148:A:1", "damage that a hero's attack deals to Murzag goes to a Morgul Bodyguard in the staging area instead: the attack's damage, Murzag's Defense subtracted first", (effects) => {
  const t = table({ phase: "PlayerAttacks", heroes: [BOROMIR], engaged: [murzag], staging: [tower, bodyguard] }, effects, [BOROMIR]);
  const started = opened(t);
  const attacked = send(started, { type: "DeclareAttackers", enemyId: idOf(started.state, murzag), attackerIds: [idOf(started.state, BOROMIR)] }, t.ctx);
  const done = fight(t, attacked, (state) => damageOf(state, bodyguard) > 0 || state.mode !== "playerAttacks");
  expect(damageOf(done.state, bodyguard)).toBe(1);
  expect(damageOf(done.state, murzag)).toBe(0);
});

lineSpec("06148:A:1", "damage that a player card deals to a Captain goes to the Bodyguard: Hail of Stones on Murzag in the staging area, and Infighting moving damage from another enemy to him", (effects) => {
  const hail = table({ staging: [tower, murzag, bodyguard], hand: [HAIL], heroResources: 3 }, effects, [HAIL]);
  const murzagId = idOf(hail.state, murzag);
  const cast = playCard(hail, opened(hail), HAIL, (state) => (state.window?.kind === "choose" && state.window.options.includes("x1") ? "x1" : state.window?.kind === "choose" && state.window.options.includes(murzagId) ? murzagId : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")));
  expect(damageOf(cast.state, bodyguard)).toBe(1);
  expect(damageOf(cast.state, murzag)).toBe(0);
  const moved = table({ engaged: [{ code: tracker, damage: 2 }, murzag], staging: [tower, bodyguard], hand: [INFIGHTING], heroes: [{ code: DENETHOR, resources: 3 }] }, effects, [INFIGHTING, DENETHOR]);
  const trackerId = idOf(moved.state, tracker);
  const infighting = playCard(moved, opened(moved), INFIGHTING, (state) => (state.window?.kind === "choose" ? (state.window.options.includes(trackerId) ? trackerId : state.window.options.includes(idOf(moved.state, murzag)) ? idOf(moved.state, murzag) : (state.window.options.at(-1) ?? "")) : ""));
  expect(damageOf(infighting.state, murzag)).toBe(0);
  expect(damageOf(infighting.state, bodyguard)).toBe(2);
  expect(damageOf(infighting.state, tracker)).toBe(0);
});

lineSpec("06148:A:1", "damage goes whole to the Bodyguard with the most damage, the first in play on a tie, and what passes its hit points is lost; the Captain takes none of it", (effects) => {
  const t = table({ engaged: [murzag], staging: [tower, bodyguard, { code: bodyguard, damage: 2 }, { code: bodyguard, damage: 2 }] }, effects);
  const id = idOf(t.state, murzag);
  const hit = run(t, t.state, { verb: "DamageCard", amount: 2, target: "self" }, { sourceId: id });
  expect([0, 1, 2].map((nth) => damageOf(hit, bodyguard, nth))).toEqual([0, 4, 2]);
  expect(hit.cards[id]?.damage).toBe(0);
  const worn = table({ engaged: [murzag], staging: [tower, { code: bodyguard, damage: 4 }] }, effects);
  const over = run(worn, worn.state, { verb: "DamageCard", amount: 6, target: "self" }, { sourceId: idOf(worn.state, murzag) });
  expect(where(over, bodyguard)).toBe("encounterDiscard");
  expect(over.cards[idOf(over, murzag)]?.damage).toBe(0);
  expect(where(over, murzag)).toBe("engaged");
});

lineSpec("06148:A:1", "damage to an enemy that is no Captain is not redirected, and a Captain takes the damage itself once the last Bodyguard has left play", (effects) => {
  const t = table({ engaged: [murzag, tracker], staging: [tower, { code: bodyguard, damage: 5 }] }, effects);
  const trackerHit = run(t, t.state, { verb: "DamageCard", amount: 1, target: "self" }, { sourceId: idOf(t.state, tracker) });
  expect(trackerHit.cards[idOf(trackerHit, tracker)]?.damage).toBe(1);
  const gone = run(t, t.state, { verb: "DamageCard", amount: 1, target: "self" }, { sourceId: idOf(t.state, murzag) });
  expect(where(gone, bodyguard)).toBe("encounterDiscard");
  const after = run(t, gone, { verb: "DamageCard", amount: 2, target: "self" }, { sourceId: idOf(gone, murzag) });
  expect(after.cards[idOf(after, murzag)]?.damage).toBe(2);
});

lineSpec("06148:A:1", "the Bodyguard takes the damage meant for the Nazgûl unreduced, and the Nazgûl reduces damage to 1 only while no Bodyguard is in play", (effects) => {
  const alone = table({ stage: rider, engaged: [nazgul], staging: [tower] }, effects);
  const reduced = run(alone, alone.state, { verb: "DamageCard", amount: 3, target: "self" }, { sourceId: idOf(alone.state, nazgul) });
  expect(reduced.cards[idOf(reduced, nazgul)]?.damage).toBe(1);
  const guarded = table({ stage: rider, engaged: [nazgul], staging: [tower, bodyguard] }, effects);
  const full = run(guarded, guarded.state, { verb: "DamageCard", amount: 3, target: "self" }, { sourceId: idOf(guarded.state, nazgul) });
  expect(damageOf(full, bodyguard)).toBe(3);
  expect(damageOf(full, nazgul)).toBe(0);
});

// The attacker (the Morgul Tracker unless named) is engaged with the first player and holds the Bodyguard as the shadow card of its attack, dealt by the engine's own function. Every other seat has a sturdy hero, so it outlives the attacks it takes.
function switching(effects: readonly Effect[], options: { seats: 1 | 2; attacker?: string; deck?: readonly string[]; shadows?: number; eliminate?: readonly number[] }) {
  const attacker = options.attacker ?? tracker;
  const heroes = options.seats === 2 ? [{ code: BOROMIR, seat: 1 }] : [];
  const t = table({ seats: options.seats, phase: "Combat", staging: [tower], engaged: [attacker], deck: [bodyguard, ...(options.deck ?? [sorcerer, sorcerer, sorcerer])], heroes }, effects, [BOROMIR]);
  const id = t.state.seats[0]?.engaged[0] ?? "";
  let state = t.state;
  for (let dealt = 0; dealt < (options.shadows ?? 1); dealt += 1) state = dealAdditionalShadow(state, id, [], t.ctx);
  // A player is eliminated the real way: the last hero of the seat is destroyed (the seat's only stand-in or hero).
  for (const seat of options.eliminate ?? []) {
    for (const hero of [...(state.seats[seat]?.heroes ?? [])]) state = run(t, state, { verb: "DamageCard", amount: 9, target: "self" }, { sourceId: hero });
  }
  return { t, start: opened(t, state), id };
}
const untilAttackOn = (seat: number) => (state: ScenarioState) => state.pendingAttack?.seat === seat && state.window?.kind === "defense" && state.cards[state.pendingAttack.enemyId]?.zone === "engaged";

lineSpec("06148:A:2", "Shadow: the attacker engages the next player and makes an immediate attack on him with a shadow card of its own; the first attack ends with no damage, and the enemy does not attack a third time", (effects) => {
  const { t, start, id } = switching(effects, { seats: 2 });
  const first = fight(t, start, untilAttackOn(0), { heroCode: "dh1" });
  const heroDamage = first.state.cards[idOf(first.state, "dh1")]?.damage ?? 0;
  const answered = send(first, { type: "Undefended", heroId: idOf(first.state, "dh1") }, t.ctx);
  expect(answered.state.cards[idOf(answered.state, "dh1")]?.damage).toBe(heroDamage);
  expect(answered.state.cards[id]).toMatchObject({ zone: "engaged", controller: 1 });
  expect(answered.state.pendingAttack).toMatchObject({ seat: 1, enemyId: id });
  expect(shadowCards(answered.state.cards[id])).toHaveLength(1);
  expect(engagedCodes(answered.state, 0)).toEqual([]);
  const done = fight(t, answered, (state) => state.phase !== "Combat", { heroCode: "dh3" });
  expect(done.state.cards[idOf(done.state, "dh3")]?.damage ?? 0).toBeGreaterThan(0);
  expect(attacks(done.steps, id)).toHaveLength(1);
  expect(attacks(done.steps)).toHaveLength(1);
});

lineSpec("06148:A:2", "Shadow: the other shadow cards of the first attack do not resolve, and the new attack's own card replaces them", (effects) => {
  // The second card is a Morgul Tracker's Shadow: resolved against an undefended attack it would place a token on To the Tower.
  const { t, start, id } = switching(effects, { seats: 2, attacker: sorcerer, shadows: 2, deck: [tracker, sorcerer, sorcerer] });
  const first = fight(t, start, untilAttackOn(0), { heroCode: "dh1" });
  const before = shadowCards(first.state.cards[id]);
  expect(before).toHaveLength(2);
  const answered = send(first, { type: "Undefended", heroId: idOf(first.state, "dh1") }, t.ctx);
  const after = shadowCards(answered.state.cards[id]);
  expect(after).toHaveLength(1);
  expect(after).not.toContain(before[1]);
  expect(answered.state.cards[idOf(answered.state, tower)]?.progress).toBe(0);
});

lineSpec("06148:A:2", "Shadow: with one player there is no next player, the attack resolves normally and the enemy stays engaged; with two it is switched", (effects) => {
  const two = switching(effects, { seats: 2 });
  const switched = fight(two.t, two.start, (state) => state.phase !== "Combat");
  expect(attacks(switched.steps, two.id)).toHaveLength(1);
  expect(switched.state.cards[idOf(switched.state, "dh1")]?.damage ?? 0).toBe(0);
  const { t, start, id } = switching(effects, { seats: 1 });
  const done = fight(t, start, (state) => state.phase !== "Combat");
  expect(attacks(done.steps)).toHaveLength(1);
  expect(done.state.cards[idOf(done.state, "dh1")]?.damage).toBeGreaterThan(0);
  expect(done.state.cards[id]?.zone).toBe("engaged");
});

lineSpec("06148:A:2", "Shadow: an eliminated player is not counted and not engaged (the game has two seats at most, so the next player is the other one): with the other player eliminated the attack resolves normally and is not cancelled", (effects) => {
  const alive = switching(effects, { seats: 2 });
  const switched = fight(alive.t, alive.start, untilAttackOn(0), { heroCode: "dh1" });
  expect(send(switched, { type: "Undefended", heroId: idOf(switched.state, "dh1") }, alive.t.ctx).state.cards[alive.id]).toMatchObject({ controller: 1 });
  const { t, start, id } = switching(effects, { seats: 2, eliminate: [1] });
  expect(start.state.seats[1]?.eliminated).toBe(true);
  const done = fight(t, start, (state) => state.phase !== "Combat");
  expect(attacks(done.steps, id)).toHaveLength(1);
  expect(done.state.cards[idOf(done.state, "dh1")]?.damage).toBeGreaterThan(0);
  expect(done.state.cards[id]).toMatchObject({ zone: "engaged", controller: 0 });
});

lineSpec("06148:A:2", "Shadow: a Captain that attacks (Murzag) is heard once for each of his attacks by his own Forced effect: each defending player gets a card revealed engaged with him, and he attacks twice, not three times", (effects) => {
  const { t, start, id } = switching(effects, { seats: 2, attacker: murzag });
  const done = fight(t, start, (state) => state.phase !== "Combat");
  expect(engagedCodes(done.state, 0)).toEqual([sorcerer]);
  expect(engagedCodes(done.state, 1)).toEqual([murzag, sorcerer]);
  expect(attacks(done.steps, id)).toHaveLength(1);
});
