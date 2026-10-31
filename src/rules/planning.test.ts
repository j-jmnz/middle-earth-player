import { describe, expect, it } from "vitest";

import type { Effect } from "../catalog/boundary.ts";
import { cardMap, expectOk, fixtureDefinition, hero } from "./fixture.ts";
import { legalIntents, legalTargets, reduce } from "./reduce.ts";
import { definePrinted } from "./printed.ts";
import { blankScenario, updateCard, withThreat, type ScenarioState } from "./state.ts";
import { spawn } from "./zones.ts";

const leadership = hero("aragorn", "leadership");
const ally = definePrinted({ code: "ally", name: "Faramir", type: "ally", sphere: "leadership", cost: 2, willpower: 2 });
const spirit = definePrinted({ code: "spirit", name: "Unexpected", type: "event", sphere: "spirit", cost: 2 });
const neutral = definePrinted({ code: "neutral", name: "Gandalf", type: "ally", sphere: "neutral", cost: 2 });
const unique = definePrinted({
  code: "unique",
  name: "Faramir",
  type: "ally",
  sphere: "leadership",
  cost: 2,
  isUnique: true,
});

function planning(cardCode: string, resources = 5): { state: ScenarioState; heroId: string; cardId: string } {
  let state = blankScenario({ seatCount: 1, seed: 3, definition: fixtureDefinition(["stage"]) });
  const heroSpawn = spawn(state, "aragorn", { zone: "heroes", seat: 0 });
  state = updateCard(heroSpawn.state, heroSpawn.id, { resources });
  const cardSpawn = spawn(state, cardCode, { zone: "hand", seat: 0 });
  state = {
    ...cardSpawn.state,
    phase: "Planning",
    mode: "planning",
    window: { kind: "pass" },
    activeSeat: 0,
  };
  return { state, heroId: heroSpawn.id, cardId: cardSpawn.id };
}

const freeSpirit = definePrinted({ code: "freeSpirit", name: "Free", type: "ally", sphere: "spirit", cost: 0 });
const freeNeutral = definePrinted({ code: "freeNeutral", name: "Loose", type: "ally", sphere: "neutral", cost: 0 });
const cards = cardMap([leadership, ally, spirit, neutral, unique, freeSpirit, freeNeutral]);
const ctx = { effects: [], cards };

describe("planning costs", () => {
  it("needs a hero of the card's sphere for a 0-cost card, and none for a neutral one (rr.resource-match)", () => {
    const off = planning("freeSpirit");
    const refused = reduce(off.state, { type: "PlayCard", cardId: off.cardId, payments: [] }, ctx);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe("No hero matches that card's sphere");
    expect(legalIntents(off.state, ctx).some((intent) => intent.type === "PlayCard")).toBe(false);
    const loose = planning("freeNeutral");
    expect(expectOk(reduce(loose.state, { type: "PlayCard", cardId: loose.cardId, payments: [] }, ctx)).state.cards[loose.cardId]?.zone).toBe("play");
  });

  it("removes exactly the printed cost", () => {
    const { state, heroId, cardId } = planning("ally");
    const played = expectOk(reduce(state, { type: "PlayCard", cardId, payments: [{ heroId, amount: 2 }] }, ctx));
    expect(played.state.cards[heroId]?.resources).toBe(3);
    expect(played.state.cards[cardId]?.zone).toBe("play");
    expect(played.state.cards[cardId]?.exhausted).toBe(false);
    expect(played.state.seats[0].hand).not.toContain(cardId);
  });

  it("rejects the wrong sphere, overpay, and underpay without changing state", () => {
    const wrong = planning("spirit");
    const wrongResult = reduce(wrong.state, {
      type: "PlayCard",
      cardId: wrong.cardId,
      payments: [{ heroId: wrong.heroId, amount: 2 }],
    }, ctx);
    expect(wrongResult.ok).toBe(false);
    if (!wrongResult.ok) {
      expect(wrongResult.reason).toBe("No hero matches that card's sphere");
      expect(wrongResult.state).toBe(wrong.state);
    }

    const over = planning("ally");
    const overResult = reduce(over.state, {
      type: "PlayCard",
      cardId: over.cardId,
      payments: [{ heroId: over.heroId, amount: 3 }],
    }, ctx);
    expect(overResult.ok).toBe(false);
    if (!overResult.ok) {
      expect(overResult.reason).toBe("Overpay");
      expect(overResult.state).toBe(over.state);
    }

    const under = planning("ally");
    const underResult = reduce(under.state, {
      type: "PlayCard",
      cardId: under.cardId,
      payments: [{ heroId: under.heroId, amount: 1 }],
    }, ctx);
    expect(underResult.ok).toBe(false);
    if (!underResult.ok) {
      expect(underResult.reason).toBe("Underpay");
      expect(underResult.state).toBe(under.state);
    }
  });

  it("lets any sphere pay a neutral card and discards an event", () => {
    const { state, heroId, cardId } = planning("neutral");
    const played = expectOk(reduce(state, { type: "PlayCard", cardId, payments: [{ heroId, amount: 2 }] }, ctx));
    expect(played.state.cards[cardId]?.zone).toBe("play");

    const event = planning("spirit");
    const spiritHero = hero("eowyn", "spirit");
    const spiritCards = cardMap([spiritHero, spirit]);
    let spiritState = event.state;
    spiritState = updateCard(spiritState, event.heroId, { code: "eowyn" });
    // The event's Action has a record, so it can be played (rr.triggered-ability): it lowers the player's threat.
    const lower: Effect = { id: "spirit:action:1", cardCode: "spirit", lines: ["spirit:A:1"], timing: "action", instructions: [{ verb: "LowerThreat", amount: 1, who: "actor" }] };
    const paid = expectOk(
      reduce(spiritState, { type: "PlayCard", cardId: event.cardId, payments: [{ heroId: event.heroId, amount: 2 }] }, {
        effects: [lower],
        cards: spiritCards,
      }),
    );
    expect(paid.state.cards[event.cardId]?.zone).toBe("discard");
    expect(paid.state.cards[event.heroId]?.resources).toBe(3);
  });

  it("refuses an event with no record: its Action could not change the game state as the engine applies it", () => {
    // Rules: rr.triggered-ability. Before 2026-10-26 such an event was paid for and discarded with no effect.
    const event = planning("spirit");
    const spiritCards = cardMap([hero("eowyn", "spirit"), spirit]);
    const state = updateCard(event.state, event.heroId, { code: "eowyn" });
    const context = { effects: [], cards: spiritCards };
    expect(legalIntents(state, context).some((intent) => intent.type === "PlayCard" && intent.cardId === event.cardId)).toBe(false);
    const refused = reduce(state, { type: "PlayCard", cardId: event.cardId, payments: [{ heroId: event.heroId, amount: 2 }] }, context);
    expect(refused.ok ? null : refused.reason).toBe("The app does not apply that card's text yet, so it cannot be played");
  });

  it("rejects a second unique title and does not list a host cross product", () => {
    const first = planning("unique");
    const played = expectOk(
      reduce(first.state, { type: "PlayCard", cardId: first.cardId, payments: [{ heroId: first.heroId, amount: 2 }] }, ctx),
    );
    const secondSpawn = spawn(played.state, "unique", { zone: "hand", seat: 0 });
    const blocked = reduce(secondSpawn.state, {
      type: "PlayCard",
      cardId: secondSpawn.id,
      payments: [{ heroId: first.heroId, amount: 2 }],
    }, ctx);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.state).toBe(secondSpawn.state);
    const intents = legalIntents(first.state, ctx);
    expect(intents).toContainEqual({ type: "PlayCard", cardId: first.cardId });
    expect(legalTargets(first.state, { type: "PlayCard", cardId: first.cardId }, ctx)).toEqual([]);
  });

  it("does not let a player-card effect damage an immune enemy", () => {
    const bolt = definePrinted({ code: "bolt", name: "Bolt", type: "event", sphere: "neutral", cost: 0 });
    const immune = definePrinted({
      code: "orc",
      name: "Orc",
      type: "enemy",
      health: 5,
      engagementCost: 50,
      keywords: { immuneToPlayerCardEffects: true },
    });
    const open = definePrinted({ code: "warg", name: "Warg", type: "enemy", health: 5, engagementCost: 50 });
    const local = cardMap([leadership, bolt, immune, open]);
    const built = planning("bolt", 0);
    const orc = spawn(built.state, "orc", { zone: "engaged", seat: 0 });
    const warg = spawn(orc.state, "warg", { zone: "engaged", seat: 0 });
    const played = expectOk(reduce(warg.state, { type: "PlayCard", cardId: built.cardId, payments: [] }, {
      effects: [{ id: "bolt:action:1", cardCode: "bolt", lines: ["fixture:A:1"], timing: "action", instructions: [{ verb: "DealDamage" }] }],
      cards: local,
    }));
    expect(played.state.cards[orc.id]?.damage).toBe(0);
    expect(played.state.cards[warg.id]?.damage).toBe(1);
    expect(played.state.cards[built.cardId]?.damage).toBe(0);
  });

  it("does not let a player card choose an immune character as a host", () => {
    const mount = definePrinted({
      code: "mount",
      name: "Mount",
      type: "attachment",
      sphere: "leadership",
      cost: 1,
    });
    const immuneHero = definePrinted({
      ...leadership,
      keywords: { immuneToPlayerCardEffects: true },
    });
    const guard = definePrinted({
      code: "guard",
      name: "Guard",
      type: "ally",
      sphere: "leadership",
      cost: 1,
      willpower: 1,
      health: 2,
    });
    const built = planning("mount");
    const spawned = spawn(built.state, "guard", { zone: "play", seat: 0 });
    const ready = updateCard(spawned.state, spawned.id, { exhausted: false });
    const local = { effects: [], cards: cardMap([immuneHero, mount, guard]) };
    expect(legalTargets(ready, { type: "PlayCard", cardId: built.cardId }, local)).toEqual([spawned.id]);
    const refused = reduce(ready, {
      type: "PlayCard",
      cardId: built.cardId,
      hostId: built.heroId,
      payments: [{ heroId: built.heroId, amount: 1 }],
    }, local);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.reason).toBe("Immune to player card effects");
      expect(refused.state).toBe(ready);
    }
    expect(ready.cards[built.cardId]?.zone).toBe("hand");
  });

  it("moves planning to the next living seat when a played event eliminates the active seat", () => {
    const bolt = definePrinted({ code: "bolt", name: "Bolt", type: "event", sphere: "neutral", cost: 0 });
    const second = definePrinted({ code: "second", name: "Second", type: "ally", sphere: "leadership", cost: 0 });
    const cards = cardMap([hero("aragorn", "leadership"), hero("gimli", "tactics"), bolt, second]);
    const effects = [{ id: "bolt:action:2", cardCode: "bolt", lines: ["fixture:A:1"], timing: "action" as const, instructions: [{ verb: "RaiseThreat" as const }] }];
    let state = blankScenario({ seatCount: 2, seed: 9, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    state = spawn(state, "gimli", { zone: "heroes", seat: 1 }).state;
    const event = spawn(state, "bolt", { zone: "hand", seat: 0 });
    state = event.state;
    const allyCard = spawn(state, "second", { zone: "hand", seat: 0 });
    state = withThreat(allyCard.state, 0, 49);
    state = withThreat(state, 1, 10);
    state = { ...state, phase: "Planning", mode: "planning", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0 };
    const local = { effects, cards };
    const played = expectOk(reduce(state, { type: "PlayCard", cardId: event.id, payments: [] }, local));
    expect(played.state.seats[0]?.eliminated).toBe(true);
    expect(played.state.seats[1]?.eliminated).toBe(false);
    expect(played.state.lost).toBe(false);
    expect(played.state.mode).toBe("planning");
    expect(played.state.window?.kind).toBe("pass");
    expect(played.state.activeSeat).toBe(1);
    expect(played.state.cards[event.id]?.zone).toBe("discard");
    // rr.player-elimination: the eliminated seat's hand goes to its discard pile, and the first player token passes.
    expect(played.state.cards[allyCard.id]?.zone).toBe("discard");
    expect(played.state.firstPlayer).toBe(1);
    expect(legalIntents(played.state, local).some((intent) => intent.type === "PlayCard")).toBe(false);
    const stuck = { ...played.state, activeSeat: 0 };
    expect(legalIntents(stuck, local)).toEqual([]);
    const again = reduce(stuck, { type: "PlayCard", cardId: allyCard.id, payments: [] }, local);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.reason).toBe("That seat is eliminated");
      expect(again.state).toBe(stuck);
    }
  });

  it("closes the planning window when the last seat is eliminated", () => {
    const bolt = definePrinted({ code: "bolt", name: "Bolt", type: "event", sphere: "neutral", cost: 0 });
    const second = definePrinted({ code: "second", name: "Second", type: "ally", sphere: "leadership", cost: 0 });
    const cards = cardMap([leadership, bolt, second]);
    const effects = [{ id: "bolt:action:3", cardCode: "bolt", lines: ["fixture:A:1"], timing: "action" as const, instructions: [{ verb: "RaiseThreat" as const }] }];
    const built = planning("bolt", 0);
    const allyCard = spawn(built.state, "second", { zone: "hand", seat: 0 });
    const threatened = withThreat(allyCard.state, 0, 49);
    const local = { effects, cards };
    const played = expectOk(reduce(threatened, { type: "PlayCard", cardId: built.cardId, payments: [] }, local));
    expect(played.state.seats[0]?.eliminated).toBe(true);
    expect(played.state.lost).toBe(true);
    expect(played.state.window).toBeNull();
    expect(played.state.cards[allyCard.id]?.zone).toBe("hand");
    expect(legalIntents(played.state, local)).toEqual([]);
    const again = reduce(played.state, { type: "PlayCard", cardId: allyCard.id, payments: [] }, local);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.reason).toBe("The game is lost");
      expect(again.state).toBe(played.state);
    }
  });
});

describe("planning turns and passing", () => {
  it("gives each seat its own planning window in player order, and asks a seat again after another plays (rr.step-2-2, rr.step-2-3, rr.action-windows)", () => {
    const gimli = hero("gimli", "leadership");
    const local = { effects: [], cards: cardMap([leadership, gimli, ally]) };
    let state = blankScenario({ seatCount: 2, seed: 3, definition: fixtureDefinition(["stage"]) });
    const a = spawn(state, "aragorn", { zone: "heroes", seat: 0 });
    const g = spawn(a.state, "gimli", { zone: "heroes", seat: 1 });
    state = updateCard(updateCard(g.state, a.id, { resources: 5 }), g.id, { resources: 5 });
    const mine = spawn(state, "ally", { zone: "hand", seat: 0 });
    const theirs = spawn(mine.state, "ally", { zone: "hand", seat: 1 });
    state = { ...theirs.state, phase: "Resource", mode: "resourceActions", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0, passed: [] };
    // The resource window closes; seat 0's planning window opens.
    let run = expectOk(reduce(state, { type: "Pass" }, local));
    run = expectOk(reduce(run.state, { type: "Pass" }, local));
    expect(run.state.mode).toBe("planning");
    expect(run.state.planningSeat).toBe(0);
    expect(run.state.activeSeat).toBe(0);
    // Seat 0 passes; seat 1 may act in seat 0's window but cannot play its ally there.
    run = expectOk(reduce(run.state, { type: "Pass" }, local));
    expect(run.state.activeSeat).toBe(1);
    const early = reduce(run.state, { type: "PlayCard", cardId: theirs.id, payments: [{ heroId: g.id, amount: 2 }] }, local);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.reason).toBe("Only the active player plays allies and attachments now");
    // Seat 1 passes: seat 0's window is closed and seat 1's opens.
    run = expectOk(reduce(run.state, { type: "Pass" }, local));
    expect(run.state.mode).toBe("planning");
    expect(run.state.planningSeat).toBe(1);
    expect(run.state.activeSeat).toBe(1);
    run = expectOk(reduce(run.state, { type: "PlayCard", cardId: theirs.id, payments: [{ heroId: g.id, amount: 2 }] }, local));
    // Seat 1 played, so the passes start over: seat 1 passes, seat 0 passes, and the phase moves on.
    run = expectOk(reduce(run.state, { type: "Pass" }, local));
    expect(run.state.activeSeat).toBe(0);
    expect(run.state.mode).toBe("planning");
    run = expectOk(reduce(run.state, { type: "Pass" }, local));
    expect(run.state.mode).not.toBe("planning");
    expect(run.state.planningSeat).toBeNull();
  });

  it("starts at the first player when that is seat 1, and seat 0 still has its planning window after (rr.step-2-3)", () => {
    const gimli = hero("gimli", "leadership");
    const local = { effects: [], cards: cardMap([leadership, gimli, ally]) };
    let state = blankScenario({ seatCount: 2, seed: 3, definition: fixtureDefinition(["stage"]) });
    const a = spawn(state, "aragorn", { zone: "heroes", seat: 0 });
    const g = spawn(a.state, "gimli", { zone: "heroes", seat: 1 });
    state = updateCard(updateCard(g.state, a.id, { resources: 5 }), g.id, { resources: 5 });
    const mine = spawn(state, "ally", { zone: "hand", seat: 0 });
    state = { ...mine.state, phase: "Resource", mode: "resourceActions", window: { kind: "pass" }, activeSeat: 1, firstPlayer: 1, passed: [] };
    let run = expectOk(reduce(state, { type: "Pass" }, local));
    run = expectOk(reduce(run.state, { type: "Pass" }, local));
    expect(run.state.planningSeat).toBe(1);
    expect(run.state.activeSeat).toBe(1);
    // Both pass in seat 1's window: seat 0's own window opens, and its ally can be played there.
    run = expectOk(reduce(run.state, { type: "Pass" }, local));
    run = expectOk(reduce(run.state, { type: "Pass" }, local));
    expect(run.state.mode).toBe("planning");
    expect(run.state.planningSeat).toBe(0);
    expect(run.state.activeSeat).toBe(0);
    run = expectOk(reduce(run.state, { type: "PlayCard", cardId: mine.id, payments: [{ heroId: a.id, amount: 2 }] }, local));
    expect(run.state.cards[mine.id]?.zone).toBe("play");
  });

  it("ends the phase when the last seat in player order is eliminated in its own planning window (rr.step-2-3)", () => {
    const gimli = hero("gimli", "leadership");
    const local = { effects: [], cards: cardMap([leadership, gimli]) };
    let state = blankScenario({ seatCount: 2, seed: 3, definition: fixtureDefinition(["stage"]) });
    const a = spawn(state, "aragorn", { zone: "heroes", seat: 0 });
    state = spawn(a.state, "gimli", { zone: "heroes", seat: 1 }).state;
    const seats: ScenarioState["seats"] = [state.seats[0], { ...state.seats[1], eliminated: true }];
    state = { ...state, seats, phase: "Planning", mode: "planning", window: { kind: "pass" }, activeSeat: 0, firstPlayer: 0, planningSeat: 1, passed: [] };
    const run = expectOk(reduce(state, { type: "Pass" }, local));
    expect(run.state.mode).not.toBe("planning");
    expect(run.state.planningSeat).toBeNull();
  });
});
