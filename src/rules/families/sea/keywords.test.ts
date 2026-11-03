import { describe, expect, it } from "vitest";

import { ruleCause } from "../../cause.ts";
import { archeryRecipients, archeryTotal } from "../../combat.ts";
import { placeDamage } from "../../keywords.ts";
import { legalIntents, reduce } from "../../reduce.ts";
import type { ScenarioState } from "../../state.ts";
import { hero, seaTable, send, ship, shipEnemy, type Table } from "./table.ts";

// Rules: dcce.archery, dcce.immune, dcce.indestructible (data/rules/entries.json). The keywords the Dream-chaser box prints, read against the engine:
// Archery X is cumulative, is dealt to characters under any player's control (ships included) as the combat phase begins, and can be gained;
// "Immune to player card effects" makes a card ignore damage from player cards; an Indestructible enemy is never destroyed by damage.

function table(): Table {
  return seaTable({
    cards: [hero("aragorn"), hero("boromir"), ship("dc", "Dream-chaser", { keywords: { sentinel: true, immuneToPlayerCardEffects: true } }), shipEnemy("battery", { keywords: { archery: 2 } }), shipEnemy("battery2", { keywords: { archery: 1 } }), shipEnemy("rock", { keywords: { indestructible: true }, health: 3 })],
    seatCount: 2,
    effects: [],
    heroes: [{ code: "aragorn" }, { code: "boromir", seat: 1 }],
    allies: [{ code: "dc", seat: 1 }],
    staging: [{ code: "battery" }, { code: "battery2" }],
    enemies: [{ code: "rock" }],
  });
}

const gains = (state: ScenarioState, id: string, amount: number): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: id, stat: "archery", amount, until: "endOfRound" }] });

describe("Archery X (dcce.archery)", () => {
  it("adds up the Archery of every card in play, whatever it is", () => {
    const { state, ctx } = table();
    expect(archeryTotal(state, ctx.cards)).toBe(3);
  });

  it("adds Archery a card gains (\"gains archery 4\") to its printed value", () => {
    const { state, ids, ctx } = table();
    const rock = gains(state, ids.rock!, 4);
    expect(archeryTotal(rock, ctx.cards)).toBe(7);
    // A card with a printed Archery gains on top of it.
    expect(archeryTotal(gains(state, ids.battery!, 1), ctx.cards)).toBe(4);
  });

  it("is dealt to characters under any player's control, ships included, divided as the players see fit, as the combat phase begins", () => {
    const { state, ids, ctx } = table();
    expect(archeryRecipients(state, ctx.cards).sort()).toEqual([ids.aragorn, ids.boromir, ids.dc].sort());
    const window: ScenarioState = { ...state, phase: "Combat", mode: "combatShadows", window: { kind: "archery", total: 3 }, activeSeat: 0 };
    expect(legalIntents(window, ctx)).toEqual([{ type: "Distribute", total: 3 }]);
    const refused = reduce(window, { type: "Distribute", assignments: [{ cardId: ids.dc!, amount: 2 }] }, ctx);
    expect(refused.ok).toBe(false);
    const dealt = send(window, { type: "Distribute", assignments: [{ cardId: ids.dc!, amount: 2 }, { cardId: ids.boromir!, amount: 1 }] }, ctx);
    expect(dealt.cards[ids.dc!]?.damage).toBe(2);
    expect(dealt.cards[ids.boromir!]?.damage).toBe(1);
    expect(dealt.cards[ids.aragorn!]?.damage).toBe(0);
  });
});

describe("Immune to player card effects (dcce.immune)", () => {
  it("ignores the damage of a player card and cannot be chosen by one, and takes the damage of the game", () => {
    const { state, ids, ctx } = table();
    const player = placeDamage(state, ids.dc!, 2, ctx.cards, [], "player", ruleCause("rr.damage"));
    expect(player.cards[ids.dc!]?.damage).toBe(0);
    const framework = placeDamage(state, ids.dc!, 2, ctx.cards, [], "framework", ruleCause("rr.damage"));
    expect(framework.cards[ids.dc!]?.damage).toBe(2);
  });
});

describe("Indestructible (dcce.indestructible)", () => {
  it("keeps its damage but is never destroyed by it, even with damage equal to its hit points", () => {
    const { state, ids, ctx } = table();
    const hit = placeDamage(state, ids.rock!, 5, ctx.cards, [], "framework", ruleCause("rr.damage"));
    expect(hit.cards[ids.rock!]?.damage).toBe(5);
    expect(hit.cards[ids.rock!]?.zone).toBe("engaged");
    // The sweep that destroys cards with damage at their hit points leaves it too.
    const swept = send({ ...hit, mode: "combatActions", phase: "Combat", boundaryPhase: "Combat", window: { kind: "pass" }, passed: [] }, { type: "Pass" }, ctx);
    expect(swept.cards[ids.rock!]?.zone).not.toBe("encounterDiscard");
  });
});
