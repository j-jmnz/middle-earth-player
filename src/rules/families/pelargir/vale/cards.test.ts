// Rules: rr.response, rr.explored, rr.forced, rr.in-player-order, rr.reveal, rr.step-6-4-2, rr.step-6-4-3, ats.captain-enemies, faq.errata.06157 (data/rules/entries.json); ledger lines 06154:A:1, 06155:A:1, 06157:A:1, 06158:A:2, 06149:A:2
// The choices of The Morgul Vale's cards, each on its real moment: the first player's Response when Morgul Road is explored offers only an option that can happen, each player returns an enemy of his own choice at the end of the round, and Impenetrable Fog,
// Sleepless Malice and the Sorcerer's Shadow ask the players the choices their lines print.
import { describe, expect, it } from "vitest";

import { settle } from "../../../engine/machine.ts";
import { dealAdditionalShadow } from "../../../interpret/interpret.ts";
import { answer, idOf, legalIntents, revealFromTop, send } from "../../../../../test/harness/scene-kit.ts";
import { CODES, engagedCodes, fight, opened, table, tokens, where } from "../../../../../test/scenarios/the-morgul-vale/table.ts";

const { tower, murzag, road, tracker, bodyguard, vale, fog, malice, sorcerer } = CODES;

describe("Morgul Road explored (06154:A:1)", () => {
  // The quest explores the Road (4 of its 5 quest points are on it and the heroes bring 2 progress): the first player's Response is offered at once.
  const explored = (progress: number) => {
    const t = table({ phase: "Quest", staging: [{ code: tower, progress }, murzag, bodyguard], active: { code: road, progress: 4 }, committed: ["dh1", "dh2"] });
    const after = fight(t, opened(t), (state) => state.phase !== "Quest" || legalIntents(state, t.ctx).some((intent) => intent.type === "Trigger"));
    return { t, after };
  };

  it("offers the first player both options while a token lies on To the Tower and an enemy is in play", () => {
    const { t, after } = explored(2);
    expect(where(after.state, road)).toBe("encounterDiscard");
    const trigger = legalIntents(after.state, t.ctx).find((intent) => intent.type === "Trigger");
    expect(trigger).toBeDefined();
    const chosen = send(after, trigger as never, t.ctx);
    expect(chosen.state.window).toMatchObject({ kind: "choose", seat: 0, options: ["remove", "damage"] });
    expect(tokens(send(chosen, { type: "Choose", optionId: "remove" }, t.ctx).state)).toBe(1);
  });

  it("does not offer the removal when no token lies on To the Tower", () => {
    const { t, after } = explored(0);
    const trigger = legalIntents(after.state, t.ctx).find((intent) => intent.type === "Trigger");
    const chosen = send(after, trigger as never, t.ctx);
    // The only option left is taken without asking: the player chooses the enemy that takes the damage (the Captain and the Bodyguard are in play).
    expect(chosen.state.window).toMatchObject({ kind: "choose", seat: 0, options: [idOf(chosen.state, murzag), idOf(chosen.state, bodyguard)] });
  });

  it("deals the damage to a Captain it is aimed at as damage to the Bodyguard (06148:A:1)", () => {
    const { t, after } = explored(0);
    const trigger = legalIntents(after.state, t.ctx).find((intent) => intent.type === "Trigger");
    const chosen = send(after, trigger as never, t.ctx);
    const done = send(chosen, { type: "Choose", optionId: idOf(chosen.state, murzag) }, t.ctx);
    expect(done.state.cards[idOf(done.state, bodyguard)]?.damage).toBe(1);
    expect(done.state.cards[idOf(done.state, murzag)]?.damage).toBe(0);
  });
});

describe("Morgul Vale at the end of the round (06155:A:1)", () => {
  it("has each player return 1 enemy engaged with him, of his own choice, a Captain too; a player with one engaged returns it without being asked", () => {
    const t = table({ seats: 2, phase: "Refresh", staging: [tower, vale], engaged: [murzag, tracker, { code: bodyguard, seat: 1 }] });
    const asked = settle(opened(t).state, t.ctx, []);
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(where(asked, bodyguard)).toBe("staging");
    const chosen = send({ state: asked, steps: [] }, { type: "Choose", optionId: idOf(asked, murzag) }, t.ctx).state;
    expect(where(chosen, murzag)).toBe("staging");
    expect(engagedCodes(chosen, 0)).toEqual([tracker]);
    expect(chosen.cards[idOf(chosen, murzag)]?.damage).toBe(0);
  });
});

describe("the choices of Impenetrable Fog, Sleepless Malice and the Morgul Sorcerer's Shadow", () => {
  const players = (hand: number) => table({ seats: 2, staging: [tower, murzag], deck: [bodyguard, bodyguard, bodyguard], hand: Array.from({ length: hand }, () => "filler") }, undefined, [fog, malice]);

  it("Fog: the first player takes 3 tokens as one placement, or reveals one card for each player, not both (06157:A:1)", () => {
    const t = players(0);
    const revealed = revealFromTop(t.state, t.ctx, fog, []);
    expect(revealed.state.window).toMatchObject({ kind: "choose", seat: 0, options: ["tokens", "reveal"] });
    expect(tokens(answer({ state: revealed.state, steps: [] }, t.ctx, () => "tokens").state)).toBe(3);
    const cards = answer({ state: revealed.state, steps: [] }, t.ctx, () => "reveal").state;
    expect(tokens(cards)).toBe(0);
    expect(cards.staging.filter((id) => cards.cards[id]?.code === bodyguard)).toHaveLength(2);
  });

  it("Malice: each player chooses for himself, in turn: 3 random cards from his hand, or 1 token (06158:A:2)", () => {
    const t = players(4);
    const revealed = revealFromTop(t.state, t.ctx, malice, []);
    expect(revealed.state.window).toMatchObject({ kind: "choose", seat: 0, options: ["discard", "token"] });
    const first = send({ state: revealed.state, steps: [] }, { type: "Choose", optionId: "discard" }, t.ctx).state;
    expect(first.window).toMatchObject({ kind: "choose", seat: 1 });
    expect(first.seats[0]?.hand).toHaveLength(1);
    const second = send({ state: first, steps: [] }, { type: "Choose", optionId: "token" }, t.ctx).state;
    expect(tokens(second)).toBe(1);
    expect(second.seats[1]?.hand).toHaveLength(4);
  });

  it("Malice: a player with fewer than 3 cards may choose the discard and discards what he holds", () => {
    const t = players(2);
    const revealed = revealFromTop(t.state, t.ctx, malice, []);
    const done = answer({ state: revealed.state, steps: [] }, t.ctx, () => "discard").state;
    expect(done.seats.map((seat) => seat.hand.length)).toEqual([0, 0]);
  });

  it("Sorcerer's Shadow: the defending player places a token or treats the attack as undefended; an attack already undefended asks neither (06149:A:2)", () => {
    const t = table({ seats: 2, phase: "Combat", staging: [tower], engaged: [sorcerer], deck: [sorcerer, bodyguard] });
    // The attacker holds a Morgul Sorcerer's card as its shadow (the deck holds a copy of its code too).
    const start = opened(t, dealAdditionalShadow(t.state, t.state.seats[0]?.engaged[0] ?? "", [], t.ctx));
    const defending = fight(t, start, (state) => state.pendingAttack != null && state.window?.kind === "defense");
    expect(defending.state.pendingAttack).toMatchObject({ seat: 0 });
    const declared = send(defending, { type: "DeclareDefender", defenderId: idOf(defending.state, "dh1") }, t.ctx);
    // The defender is declared: the shadow resolves and asks the defending player to place a token or take the undefended attack.
    expect(declared.state.window).toMatchObject({ kind: "choose", seat: 0, options: ["place", "undefended"] });
    const placed = send(declared, { type: "Choose", optionId: "place" }, t.ctx);
    expect(tokens(placed.state)).toBe(1);
    expect(placed.state.pendingAttack?.undefended).not.toBe(true);
    const undefended = fight(t, start, (state) => state.pendingAttack != null && state.window?.kind === "defense");
    const shield = send(undefended, { type: "Undefended", heroId: idOf(undefended.state, "dh1") }, t.ctx);
    expect(shield.state.window?.kind).not.toBe("choose");
    expect(tokens(shield.state)).toBe(0);
  });
});
