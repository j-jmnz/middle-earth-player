// Rules: rr.shadow-effects, rr.defending-player, rr.sentinel, ltp.undefended-attack, rr.step-6-4-2, rr.step-6-4-3, rr.reveal, rr.engaged, rr.surge, rr.running-out-of-cards, rr.forced, rr.response, rr.explored, rr.in-player-order, ats.captain-enemies, faq.reveal-and-add (data/rules/entries.json); ledger lines 06149:A:2, 06151:A:1, 06154:A:1, 06155:A:1, 06155:A:2.
// The cards of The Morgul Vale that act on a real attack or a real quest, each on its moment: the Sorcerer's Shadow asks the defending player (the player attacked, not the controller of a Sentinel that defends) and treats the attack as undefended, Murzag's Forced effect reveals a card engaged with that player, Morgul Road's Response is the first player's
// choice of what can happen, and Morgul Vale returns an enemy at the end of the round and places a token when its attack destroys a character.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { dealAdditionalShadow } from "../../../rules/interpret/interpret.ts";
import { idOf, legalIntents, send } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, engagedCodes, fight, opened, table, tokens, where } from "../../../../test/scenarios/the-morgul-vale/table.ts";

const { tower, murzag, road, tracker, bodyguard, vale, fog, sorcerer, deadCity, nazgul } = CODES;
const SPEARMAN = "01029";
const BOROMIR = "05002";

// The Sorcerer, engaged with seat 1, holds a copy of itself as its shadow card (dealt by the engine's own function); the Gondorian Spearman, a Sentinel of seat 0, may defend seat 1's attack.
function sorcererAttack(effects: readonly Effect[]) {
  const t = table({ seats: 2, phase: "Combat", staging: [tower], engaged: [{ code: sorcerer, seat: 1 }], play: [{ code: SPEARMAN, seat: 0 }], deck: [sorcerer, bodyguard, bodyguard] }, effects, [SPEARMAN]);
  const dealt = dealAdditionalShadow(t.state, t.state.seats[1]?.engaged[0] ?? "", [], t.ctx);
  const defending = fight(t, opened(t, dealt), (state) => state.pendingAttack != null && state.window?.kind === "defense");
  const declared = send(defending, { type: "DeclareDefender", defenderId: idOf(defending.state, SPEARMAN) }, t.ctx);
  // The Sentinel is declared: the response window goes by, and the shadow resolves and asks.
  return { t, defending, declared: fight(t, declared, (state) => state.window?.kind === "choose" || state.pendingAttack == null) };
}

lineSpec("06149:A:2", "Shadow: the defending player (the player attacked, not the controller of the Sentinel that defends) places 1 token on To the Tower or treats the attack as undefended", (effects) => {
  const { t, defending, declared } = sorcererAttack(effects);
  expect(defending.state.pendingAttack).toMatchObject({ seat: 1 });
  expect(declared.state.window).toMatchObject({ kind: "choose", seat: 1, options: ["place", "undefended"] });
  const placed = send(declared, { type: "Choose", optionId: "place" }, t.ctx);
  expect(tokens(placed.state)).toBe(1);
  expect(placed.state.pendingAttack?.undefended).not.toBe(true);
});

lineSpec("06149:A:2", "Shadow: treating the attack as undefended takes the Sentinel out of it: the damage lands on a hero of the defending player and the Sentinel takes none", (effects) => {
  const { t, declared } = sorcererAttack(effects);
  const chosen = send(declared, { type: "Choose", optionId: "undefended" }, t.ctx);
  expect(tokens(chosen.state)).toBe(0);
  const done = fight(t, chosen, (state) => state.pendingAttack == null || state.phase !== "Combat", { heroCode: "dh3" });
  expect(done.state.cards[idOf(done.state, "dh3")]?.damage).toBeGreaterThan(0);
  expect(where(done.state, SPEARMAN)).toBe("play");
  expect(done.state.cards[idOf(done.state, SPEARMAN)]?.damage ?? 0).toBe(0);
});

lineSpec("06149:A:2", "Shadow: an attack that is already undefended asks for neither choice", (effects) => {
  const t = table({ seats: 2, phase: "Combat", staging: [tower], engaged: [{ code: sorcerer, seat: 1 }], deck: [sorcerer, bodyguard, bodyguard] }, effects);
  const dealt = dealAdditionalShadow(t.state, t.state.seats[1]?.engaged[0] ?? "", [], t.ctx);
  const defending = fight(t, opened(t, dealt), (state) => state.pendingAttack != null && state.window?.kind === "defense");
  const shield = send(defending, { type: "Undefended", heroId: idOf(defending.state, "dh3") }, t.ctx);
  expect(shield.state.window?.kind).not.toBe("choose");
  expect(tokens(shield.state)).toBe(0);
  // Defended, the same card asks: the choice is the shadow's.
  const asked = fight(t, send(defending, { type: "DeclareDefender", defenderId: idOf(defending.state, "dh3") }, t.ctx), (state) => state.window?.kind === "choose" || state.pendingAttack == null);
  expect(asked.state.window).toMatchObject({ kind: "choose", seat: 1, options: ["place", "undefended"] });
});

// Murzag is engaged with the second player; the top of the encounter deck is `deck`; the attack is left undefended.
const murzagAttack = (effects: readonly Effect[], deck: readonly string[], layout: Parameters<typeof table>[0] = {}, extra?: readonly string[]) => {
  const t = table({ seats: 2, phase: "Combat", staging: [tower], engaged: [{ code: murzag, seat: 1 }], heroes: [{ code: BOROMIR, seat: 1 }], deck, ...layout }, effects, [BOROMIR, ...(extra ?? [])]);
  return { t, start: opened(t) };
};
const stagedOrEngaged = (code: string) => (state: ScenarioState) => state.staging.some((id) => state.cards[id]?.code === code) || state.seats.some((seat) => seat.engaged.some((id) => state.cards[id]?.code === code));

lineSpec("06151:A:1", "Forced: after Murzag attacks, the top card of the encounter deck is revealed and an enemy is put into play engaged with the defending player, dealt no shadow card, and it attacks in the same combat phase", (effects) => {
  const { t, start } = murzagAttack(effects, [tracker, bodyguard]);
  const after = fight(t, start, (state) => state.pendingAttack != null && state.cards[state.pendingAttack.enemyId]?.code === tracker, { heroCode: "dh3" });
  expect(after.state.pendingAttack).toMatchObject({ seat: 1 });
  expect(after.state.cards[idOf(after.state, tracker)]).toMatchObject({ zone: "engaged", controller: 1 });
  expect(after.state.staging.map((id) => after.state.cards[id]?.code)).not.toContain(tracker);
  expect(after.state.cards[idOf(after.state, tracker)]?.shadowId).toBeNull();
});

lineSpec("06151:A:1", "Forced: the card is revealed in full: a treachery is resolved and discarded, a location goes to the staging area", (effects) => {
  const fogged = murzagAttack(effects, [fog, vale], {}, [fog]);
  const afterFog = fight(fogged.t, fogged.start, (state) => state.phase !== "Combat" || state.encounterDiscard.some((id) => state.cards[id]?.code === fog), { heroCode: "dh3", choose: () => "tokens" });
  expect(where(afterFog.state, fog)).toBe("encounterDiscard");
  expect(tokens(afterFog.state)).toBe(3);
  const located = murzagAttack(effects, [vale, bodyguard]);
  const afterVale = fight(located.t, located.start, (state) => state.phase !== "Combat" || state.staging.some((id) => state.cards[id]?.code === vale), { heroCode: "dh3" });
  expect(where(afterVale.state, vale)).toBe("staging");
});

lineSpec("06151:A:1", "Forced: the Surge of the card revealed resolves, and the card that surge reveals is staged as any other (a Dead City Looms with no token gains surge)", (effects) => {
  const { t, start } = murzagAttack(effects, [deadCity, tracker, bodyguard]);
  const after = fight(t, start, (state) => state.phase !== "Combat" || state.staging.some((id) => state.cards[id]?.code === tracker), { heroCode: "dh3" });
  expect(where(after.state, deadCity)).toBe("encounterDiscard");
  expect(where(after.state, tracker)).toBe("staging");
  expect(engagedCodes(after.state, 1)).toEqual([murzag]);
});

lineSpec("06151:A:1", "Forced: with an empty encounter deck in the combat phase nothing is revealed and the discard pile stays where it is (the deck is reset in the quest phase only)", (effects) => {
  const full = murzagAttack(effects, [tracker, bodyguard]);
  const revealed = fight(full.t, full.start, (state) => state.phase !== "Combat", { heroCode: "dh3" });
  expect(engagedCodes(revealed.state, 1)).toContain(tracker);
  const empty = murzagAttack(effects, [], { discard: [tracker, tracker] });
  const after = fight(empty.t, empty.start, (state) => state.phase !== "Combat", { heroCode: "dh3" });
  expect(engagedCodes(after.state, 1)).toEqual([murzag]);
  expect(after.state.encounterDiscard).toHaveLength(2);
});

lineSpec("06151:A:1", "Forced: the enemy is engaged with the player attacked, also when a Sentinel of the other player defended", (effects) => {
  const { t, start } = murzagAttack(effects, [tracker, bodyguard], { play: [{ code: SPEARMAN, seat: 0 }] }, [SPEARMAN]);
  const after = fight(t, start, (state) => state.phase !== "Combat" || stagedOrEngaged(tracker)(state), { defender: SPEARMAN });
  expect(engagedCodes(after.state, 1)).toContain(tracker);
  expect(engagedCodes(after.state, 0)).toEqual([]);
});

lineSpec("06151:A:1", "Forced: when the attack eliminates the player attacked, the card is still revealed: an enemy goes to the staging area (no player is left to engage), a treachery resolves, a location is staged (rr.player-elimination)", (effects) => {
  const killed = (deck: readonly string[], extra?: readonly string[]) => {
    // The only hero of the second player has taken all but 1 of its health, so the undefended attack destroys it and eliminates the seat.
    const made = murzagAttack(effects, deck, { heroes: [] }, extra);
    const hero = idOf(made.t.state, "dh3");
    made.start = opened(made.t, updateCard(made.t.state, hero, { damage: 5 }));
    return { made, after: fight(made.t, made.start, (state) => state.phase !== "Combat" || state.encounterDiscard.some((id) => deck.includes(state.cards[id]?.code ?? "")) || stagedOrEngaged(deck[0] ?? "")(state), { heroCode: "dh3" }) };
  };
  const enemy = killed([tracker, bodyguard]);
  expect(enemy.after.state.seats[1]?.eliminated).toBe(true);
  expect(where(enemy.after.state, tracker)).toBe("staging");
  expect(engagedCodes(enemy.after.state, 0)).toEqual([]);
  const place = killed([vale, bodyguard]);
  expect(where(place.after.state, vale)).toBe("staging");
  const treachery = murzagAttack(effects, [fog, vale], { heroes: [] }, [fog]);
  const hurt = opened(treachery.t, updateCard(treachery.t.state, idOf(treachery.t.state, "dh3"), { damage: 5 }));
  const afterFog = fight(treachery.t, hurt, (state) => state.phase !== "Combat" || state.encounterDiscard.some((id) => state.cards[id]?.code === fog), { heroCode: "dh3", choose: () => "tokens" });
  expect(afterFog.state.seats[1]?.eliminated).toBe(true);
  expect(where(afterFog.state, fog)).toBe("encounterDiscard");
  expect(tokens(afterFog.state)).toBe(3);
  // A Surge card reveals one more for the first living seat: Terror Drives Them is revealed, and the Tracker under it is staged too.
  const surge = killed([CODES.terror, tracker, bodyguard], [CODES.terror]);
  expect(surge.after.state.seats[1]?.eliminated).toBe(true);
  expect(where(surge.after.state, CODES.terror)).toBe("encounterDiscard");
  expect(where(surge.after.state, tracker)).toBe("staging");
});

// The quest explores Morgul Road (4 of its 5 quest points are on it and the heroes bring 2 progress): the first player's Response is offered at once.
function exploredRoad(effects: readonly Effect[], progress: number) {
  const t = table({ phase: "Quest", staging: [{ code: tower, progress }, murzag, bodyguard], active: { code: road, progress: 4 }, committed: ["dh1", "dh2"] }, effects);
  const after = fight(t, opened(t), (state) => state.phase !== "Quest" || legalIntents(state, t.ctx).some((intent) => intent.type === "Trigger"));
  const trigger = legalIntents(after.state, t.ctx).find((intent) => intent.type === "Trigger");
  return { t, after, trigger };
}

lineSpec("06154:A:1", "Response: after Morgul Road leaves play as an explored location the first player may remove 1 token from To the Tower or deal 1 damage to an enemy in play; both are offered while a token lies there and an enemy is in play", (effects) => {
  const { t, after, trigger } = exploredRoad(effects, 2);
  expect(where(after.state, road)).toBe("encounterDiscard");
  expect(trigger).toBeDefined();
  const chosen = send(after, trigger as never, t.ctx);
  expect(chosen.state.window).toMatchObject({ kind: "choose", seat: 0, options: ["remove", "damage"] });
  expect(tokens(send(chosen, { type: "Choose", optionId: "remove" }, t.ctx).state)).toBe(1);
});

lineSpec("06154:A:1", "Response: with no token on To the Tower the removal is not offered, and the damage meant for a Captain goes to the Bodyguard", (effects) => {
  const { t, after, trigger } = exploredRoad(effects, 0);
  expect(trigger).toBeDefined();
  const chosen = send(after, trigger as never, t.ctx);
  expect(chosen.state.window).toMatchObject({ kind: "choose", seat: 0, options: [idOf(chosen.state, murzag), idOf(chosen.state, bodyguard)] });
  const done = send(chosen, { type: "Choose", optionId: idOf(chosen.state, murzag) }, t.ctx);
  expect(done.state.cards[idOf(done.state, bodyguard)]?.damage).toBe(1);
  expect(done.state.cards[idOf(done.state, murzag)]?.damage).toBe(0);
});

lineSpec("06155:A:1", "Forced: at the end of the round each player, the first player first, returns 1 enemy engaged with him, of his own choice, to the staging area, a Captain too; a player with one engaged returns it without being asked", (effects) => {
  const t = table({ seats: 2, phase: "Refresh", staging: [tower, vale], engaged: [murzag, tracker, { code: bodyguard, seat: 1 }] }, effects);
  const asked = settle(opened(t).state, t.ctx, []);
  expect(asked.window).toMatchObject({ kind: "choose", seat: 0 });
  expect(where(asked, bodyguard)).toBe("staging");
  const chosen = send({ state: asked, steps: [] }, { type: "Choose", optionId: idOf(asked, murzag) }, t.ctx).state;
  expect(where(chosen, murzag)).toBe("staging");
  expect(engagedCodes(chosen, 0)).toEqual([tracker]);
  expect(chosen.cards[idOf(chosen, murzag)]?.damage).toBe(0);
});

lineSpec("06155:A:1", "Forced: each player chooses for himself: with two enemies engaged with each of them, the first player is asked first and the other player next", (effects) => {
  const t = table({ seats: 2, phase: "Refresh", staging: [tower, vale], engaged: [tracker, bodyguard, { code: tracker, seat: 1 }, { code: bodyguard, seat: 1 }] }, effects);
  const asked = settle(opened(t).state, t.ctx, []);
  expect(asked.window).toMatchObject({ kind: "choose", seat: asked.firstPlayer });
  const other = 1 - asked.firstPlayer;
  const next = send({ state: asked, steps: [] }, { type: "Choose", optionId: asked.window?.kind === "choose" ? (asked.window.options[0] ?? "") : "" }, t.ctx).state;
  expect(next.window).toMatchObject({ kind: "choose", seat: other });
  const done = send({ state: next, steps: [] }, { type: "Choose", optionId: next.window?.kind === "choose" ? (next.window.options[0] ?? "") : "" }, t.ctx).state;
  expect(engagedCodes(done, 0)).toHaveLength(1);
  expect(engagedCodes(done, 1)).toHaveLength(1);
});

// The attacker holds a Morgul Vale as the shadow card of its attack; the attack is left undefended.
function valeAttack(effects: readonly Effect[], attacker: string) {
  const t = table({ phase: "Combat", staging: [tower], engaged: [attacker], heroes: ["05002"], deck: [vale, bodyguard, bodyguard] }, effects, ["05002"]);
  const dealt = dealAdditionalShadow(t.state, t.state.seats[0]?.engaged[0] ?? "", [], t.ctx);
  return fight(t, opened(t, dealt), (state) => state.phase !== "Combat" || state.lost);
}

lineSpec("06155:A:2", "Shadow: if the attack destroys a character, 1 token goes on To the Tower; an attack that destroys none places none", (effects) => {
  const killed = valeAttack(effects, nazgul);
  expect(killed.state.cards[idOf(killed.state, "dh1")]?.zone).toBe("discard");
  expect(tokens(killed.state)).toBe(1);
  const spared = valeAttack(effects, bodyguard);
  expect(spared.state.cards[idOf(spared.state, "dh1")]?.zone).toBe("heroes");
  expect(tokens(spared.state)).toBe(0);
});
